<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\WishlistItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ShopController extends Controller
{
    public function index(string $locale): Response
    {
        [$locale, $localeLanguageId, $fallbackLanguageId] = $this->resolveLocaleContext($locale);

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        $categories = Category::query()
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->with(['translations.language'])
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        $categoryItems = $categories
            ->map(function (Category $category) use ($localeLanguageId, $fallbackLanguageId) {
                $translation = $category->translations->firstWhere('language_id', $localeLanguageId)
                    ?? $category->translations->firstWhere('language_id', $fallbackLanguageId)
                    ?? $category->translations->first();

                return [
                    'id' => (int) $category->id,
                    'slug' => $category->slug,
                    'name' => $translation?->name ?? $category->slug,
                    'image' => $category->image ? asset('storage/' . $category->image) : null,
                ];
            })
            ->values();

        $recentProducts = Product::query()
            ->where('is_active', true)
            ->orderByDesc('id')
            ->with([
                'translations.language',
                'prices.currency',
                'images.translations.language',
                'inventories',
                'variants.prices.currency',
                'variants.inventories',
            ])
            ->limit(24)
            ->get();

        $productItems = $recentProducts
            ->map(function (Product $product) use ($localeLanguageId, $fallbackLanguageId, $currency) {
                return $this->mapProductCard(
                    $product,
                    $localeLanguageId,
                    $fallbackLanguageId,
                    $currency
                );
            })
            ->values();

        $bestSellingProductIds = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNotNull('orders.paid_at')
            ->whereNotNull('order_items.product_id')
            ->selectRaw('order_items.product_id, SUM(order_items.qty) as total_qty')
            ->groupBy('order_items.product_id')
            ->orderByDesc('total_qty')
            ->limit(12)
            ->pluck('product_id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $bestSellingProducts = collect();

        if ($bestSellingProductIds->isNotEmpty()) {
            $bestSellingModels = Product::query()
                ->whereIn('id', $bestSellingProductIds->all())
                ->where('is_active', true)
                ->with([
                    'translations.language',
                    'prices.currency',
                    'images.translations.language',
                    'inventories',
                    'variants.prices.currency',
                    'variants.inventories',
                ])
                ->get()
                ->keyBy('id');

            $bestSellingProducts = $bestSellingProductIds
                ->map(function (int $productId) use (
                    $bestSellingModels,
                    $localeLanguageId,
                    $fallbackLanguageId,
                    $currency
                ) {
                    $product = $bestSellingModels->get($productId);

                    if (!$product) {
                        return null;
                    }

                    return $this->mapProductCard(
                        $product,
                        $localeLanguageId,
                        $fallbackLanguageId,
                        $currency
                    );
                })
                ->filter()
                ->values();
        }

        $wishlistProductIds = auth()->check()
            ? WishlistItem::query()
                ->where('user_id', auth()->id())
                ->pluck('product_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            : [];

        return Inertia::render('Shop/Index', [
            'categories' => $categoryItems,
            'products' => $productItems,
            'bestSellingProducts' => $bestSellingProducts,
            'wishlist_product_ids' => $wishlistProductIds,
        ]);
    }

    private function resolveLocaleContext(string $locale): array
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

        return [$locale, $localeLanguageId, $fallbackLanguageId];
    }

    private function mapProductCard(
        Product $product,
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency
    ): array {
        $translation = $product->translations->firstWhere('language_id', $localeLanguageId)
            ?? $product->translations->firstWhere('language_id', $fallbackLanguageId)
            ?? $product->translations->first();

        $mainImage = $product->images->firstWhere('is_main', true)
            ?? $product->images->first();

        $alt = null;

        if ($mainImage) {
            $imageTranslation = $mainImage->translations->firstWhere('language_id', $localeLanguageId)
                ?? $mainImage->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $mainImage->translations->first();

            $alt = $imageTranslation?->alt;
        }

        $availableStock = $product->managesInventory()
            ? (int) ($product->availableStock() ?? 0)
            : null;

        $price = $this->resolveProductCardPrice($product, $currency);

        return [
            'id' => (int) $product->id,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'type' => $product->type,
            'business_type' => $product->business_type,
            'name' => $translation?->name ?? $product->slug,
            'manages_inventory' => (bool) $product->manages_inventory,
            'available_stock' => $availableStock,
            'image' => $mainImage ? [
                'url' => $mainImage->path ? asset('storage/' . $mainImage->path) : null,
                'alt' => $alt,
            ] : null,
            'price' => $price,
        ];
    }

    private function resolveProductCardPrice(Product $product, ?Currency $currency): ?array
    {
        $priceModel = null;

        if ($product->isSimple()) {
            $priceModel = $currency
                ? ($product->prices->firstWhere('currency_id', $currency->id) ?? $product->prices->first())
                : $product->prices->first();
        } else {
            $variantPrices = $product->variants
                ->flatMap(function ($variant) {
                    return $variant->prices ?? collect();
                });

            if ($currency) {
                $variantPrices = $variantPrices->filter(function ($price) use ($currency) {
                    return (int) $price->currency_id === (int) $currency->id;
                });
            }

            $priceModel = $variantPrices
                ->filter(fn ($price) => $price->amount !== null)
                ->sortBy('amount')
                ->first();

            if (!$priceModel) {
                $priceModel = $currency
                    ? ($product->prices->firstWhere('currency_id', $currency->id) ?? $product->prices->first())
                    : $product->prices->first();
            }
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
}
