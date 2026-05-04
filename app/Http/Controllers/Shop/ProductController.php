<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\WishlistItem;
use App\Services\ProductReviewService;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function show(string $locale, string $product, ProductReviewService $productReviewService): Response
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallbackLocale = config('app.fallback_locale', 'pt');
        $locale = in_array($locale, $supported, true) ? $locale : $fallbackLocale;

        $languages = Language::query()
            ->whereIn('code', [$fallbackLocale, $locale])
            ->get()
            ->keyBy('code');

        $fallbackLanguageId = (int) ($languages[$fallbackLocale]->id ?? 0);
        $localeLanguageId = (int) ($languages[$locale]->id ?? $fallbackLanguageId);

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        $p = Product::query()
            ->where('slug', $product)
            ->where('is_active', true)
            ->with([
                'translations.language',
                'categories.translations.language',
                'prices.currency',
                'images.translations.language',
                'inventories',
                'businessDetail',
                'reviews.user',
                'variants.values.value.translations.language',
                'variants.values.attribute.translations.language',
                'variants.prices.currency',
                'variants.inventories',
            ])
            ->firstOrFail();

        $tr = $p->translations->firstWhere('language_id', $localeLanguageId)
            ?? $p->translations->firstWhere('language_id', $fallbackLanguageId)
            ?? $p->translations->first();

        $images = $p->images->map(function ($img) use ($localeLanguageId, $fallbackLanguageId) {
            $imgTr = $img->translations->firstWhere('language_id', $localeLanguageId)
                ?? $img->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $img->translations->first();

            return [
                'id' => (int) $img->id,
                'url' => $img->path ? "/storage/{$img->path}" : null,
                'is_main' => (bool) $img->is_main,
                'position' => (int) ($img->position ?? 0),
                'alt' => $imgTr?->alt,
            ];
        })->values();

        $mainImageId = (int) ($images->firstWhere('is_main', true)['id'] ?? ($images->first()['id'] ?? 0));

        $categories = $p->categories->map(function ($c) use ($localeLanguageId, $fallbackLanguageId) {
            $ct = $c->translations->firstWhere('language_id', $localeLanguageId)
                ?? $c->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $c->translations->first();

            return [
                'id' => (int) $c->id,
                'slug' => $c->slug,
                'name' => $ct?->name ?? $c->slug,
            ];
        })->values();

        $availableStock = $p->managesInventory() ? $p->availableStock() : null;

        $variants = $this->mapVariants(
            product: $p,
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId,
            currency: $currency
        );

        $variantAttributes = $this->buildVariantAttributes(
            variants: $variants,
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId
        );

        $selectedVariant = $this->resolveDefaultVariant($variants);

        $price = $this->resolveProductDisplayPrice(
            product: $p,
            variants: $variants,
            currency: $currency
        );

        $isInWishlist = auth()->check()
            ? WishlistItem::query()
                ->where('user_id', auth()->id())
                ->where('product_id', $p->id)
                ->exists()
            : false;

        $canReview = auth()->check()
            ? $productReviewService->canReview(auth()->user(), $p)
            : false;

        $myReview = auth()->check()
            ? $p->reviews
                ->where('user_id', auth()->id())
                ->where('is_visible', true)
                ->first()
            : null;

        $reviews = $p->reviews
            ->where('is_visible', true)
            ->sortByDesc('id')
            ->values()
            ->map(function ($review) {
                return [
                    'id' => (int) $review->id,
                    'rating' => (int) $review->rating,
                    'title' => $review->title,
                    'body' => $review->body,
                    'is_verified_purchase' => (bool) $review->is_verified_purchase,
                    'created_at' => optional($review->created_at)->toISOString(),
                    'user' => [
                        'id' => $review->user?->id,
                        'name' => $review->user?->name,
                    ],
                ];
            })
            ->values();

        return Inertia::render('Shop/ProductShow', [
            'product' => [
                'id' => (int) $p->id,
                'slug' => $p->slug,
                'sku' => $p->sku,
                'type' => $p->type,
                'business_type' => $p->business_type,
                'allow_quantity' => (bool) $p->allow_quantity,
                'requires_shipping' => (bool) $p->requires_shipping,
                'manages_inventory' => (bool) $p->manages_inventory,
                'max_per_order' => $p->max_per_order,
                'available_stock' => $availableStock,
                'name' => $tr?->name ?? $p->slug,
                'description' => $tr?->description,
                'meta_title' => $tr?->meta_title,
                'meta_description' => $tr?->meta_description,
                'price' => $price,
                'categories' => $categories,
                'images' => $images,
                'main_image_id' => $mainImageId,
                'variant_attributes' => $variantAttributes,
                'variants' => $variants,
                'selected_variant_id' => $selectedVariant['id'] ?? null,
                'business_detail' => $p->businessDetail ? [
                    'membership_period_unit' => $p->businessDetail->membership_period_unit,
                    'membership_period_value' => $p->businessDetail->membership_period_value,
                    'membership_renews_manually' => (bool) $p->businessDetail->membership_renews_manually,
                    'delivery_mode' => $p->businessDetail->delivery_mode,
                    'service_kind' => $p->businessDetail->service_kind,
                    'access_instructions' => $p->businessDetail->access_instructions,
                ] : null,
            ],
            'is_in_wishlist' => $isInWishlist,
            'reviews' => $reviews,
            'reviews_summary' => [
                'count' => (int) $reviews->count(),
                'average_rating' => $productReviewService->averageRating($p),
            ],
            'can_review' => $canReview,
            'my_review' => $myReview ? [
                'id' => (int) $myReview->id,
                'rating' => (int) $myReview->rating,
                'title' => $myReview->title,
                'body' => $myReview->body,
            ] : null,
        ]);
    }

    private function resolveProductDisplayPrice(Product $product, Collection $variants, ?Currency $currency): ?array
    {
        $priceModel = null;

        if ($product->isSimple()) {
            $priceModel = $currency
                ? ($product->prices->firstWhere('currency_id', $currency->id) ?? $product->prices->first())
                : $product->prices->first();
        } else {
            $variantWithPrice = $variants
                ->filter(fn ($variant) => !empty($variant['price']))
                ->sortBy(fn ($variant) => (int) $variant['price']['amount'])
                ->first();

            if ($variantWithPrice) {
                return $variantWithPrice['price'];
            }

            $priceModel = $currency
                ? ($product->prices->firstWhere('currency_id', $currency->id) ?? $product->prices->first())
                : $product->prices->first();
        }

        if (!$priceModel) {
            return null;
        }

        return [
            'amount' => (int) $priceModel->amount,
            'compare_at_amount' => $priceModel->compare_at_amount !== null
                ? (int) $priceModel->compare_at_amount
                : null,
            'currency' => [
                'code' => $priceModel->currency?->code,
                'symbol' => $priceModel->currency?->symbol,
                'decimal_places' => (int) ($priceModel->currency?->decimal_places ?? 2),
            ],
        ];
    }

    private function mapVariants(
        Product $product,
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency
    ): Collection {
        return $product->variants
            ->sortBy('id')
            ->values()
            ->map(function ($variant) use ($product, $localeLanguageId, $fallbackLanguageId, $currency) {
                $priceModel = $currency
                    ? ($variant->prices->firstWhere('currency_id', $currency->id) ?? $variant->prices->first())
                    : $variant->prices->first();

                $availableStock = $product->managesInventory()
                    ? (int) max(
                        0,
                        $variant->inventories->sum(function ($inventory) {
                            return (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved;
                        })
                    )
                    : null;

                $values = collect($variant->values)
                    ->sortBy('attribute_id')
                    ->map(function ($row) use ($localeLanguageId, $fallbackLanguageId) {
                        $attribute = $row->attribute;
                        $value = $row->value;

                        $attributeTranslation = $attribute?->translations?->firstWhere('language_id', $localeLanguageId)
                            ?? $attribute?->translations?->firstWhere('language_id', $fallbackLanguageId)
                            ?? $attribute?->translations?->first();

                        $valueTranslation = $value?->translations?->firstWhere('language_id', $localeLanguageId)
                            ?? $value?->translations?->firstWhere('language_id', $fallbackLanguageId)
                            ?? $value?->translations?->first();

                        return [
                            'attribute_id' => (int) $row->attribute_id,
                            'attribute_code' => $attribute?->code,
                            'attribute_name' => $attributeTranslation?->name ?? $attribute?->code,
                            'attribute_value_id' => (int) $row->attribute_value_id,
                            'attribute_value_code' => $value?->code,
                            'attribute_value_name' => $valueTranslation?->name ?? $value?->code,
                        ];
                    })
                    ->values();

                return [
                    'id' => (int) $variant->id,
                    'sku' => $variant->sku,
                    'barcode' => $variant->barcode,
                    'is_active' => (bool) $variant->is_active,
                    'available_stock' => $availableStock,
                    'values' => $values,
                    'price' => $priceModel ? [
                        'amount' => (int) $priceModel->amount,
                        'compare_at_amount' => $priceModel->compare_at_amount !== null
                            ? (int) $priceModel->compare_at_amount
                            : null,
                        'currency' => [
                            'code' => $priceModel->currency?->code,
                            'symbol' => $priceModel->currency?->symbol,
                            'decimal_places' => (int) ($priceModel->currency?->decimal_places ?? 2),
                        ],
                    ] : null,
                ];
            });
    }

    private function buildVariantAttributes(
        Collection $variants,
        int $localeLanguageId,
        int $fallbackLanguageId
    ): Collection {
        $grouped = [];

        foreach ($variants as $variant) {
            foreach (($variant['values'] ?? []) as $valueRow) {
                $attributeId = (int) ($valueRow['attribute_id'] ?? 0);
                $valueId = (int) ($valueRow['attribute_value_id'] ?? 0);

                if ($attributeId <= 0 || $valueId <= 0) {
                    continue;
                }

                if (!isset($grouped[$attributeId])) {
                    $grouped[$attributeId] = [
                        'id' => $attributeId,
                        'code' => $valueRow['attribute_code'] ?? null,
                        'name' => $valueRow['attribute_name'] ?? null,
                        'values' => [],
                    ];
                }

                if (!isset($grouped[$attributeId]['values'][$valueId])) {
                    $grouped[$attributeId]['values'][$valueId] = [
                        'id' => $valueId,
                        'code' => $valueRow['attribute_value_code'] ?? null,
                        'name' => $valueRow['attribute_value_name'] ?? null,
                    ];
                }
            }
        }

        return collect($grouped)
            ->sortBy('id')
            ->map(function ($attribute) {
                $attribute['values'] = collect($attribute['values'])
                    ->sortBy('id')
                    ->values();

                return $attribute;
            })
            ->values();
    }

    private function resolveDefaultVariant(Collection $variants): ?array
    {
        if ($variants->isEmpty()) {
            return null;
        }

        $preferred = $variants->first(function ($variant) {
            if (!($variant['is_active'] ?? false)) {
                return false;
            }

            if ($variant['available_stock'] === null) {
                return true;
            }

            return (int) $variant['available_stock'] > 0;
        });

        return $preferred ?? $variants->first();
    }
}
