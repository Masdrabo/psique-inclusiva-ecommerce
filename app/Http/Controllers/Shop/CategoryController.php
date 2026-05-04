<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\WishlistItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function show(string $locale, Request $request, string $category): Response
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

        $cat = Category::query()
            ->where('slug', $category)
            ->where('is_active', true)
            ->with([
                'translations.language',
                'parent.translations.language',
                'parent.parent.translations.language',
                'parent.parent.parent.translations.language',
                'parent.parent.parent.parent.translations.language',
                'children.translations.language',
                'children.parent.translations.language',
                'children.parent.parent.translations.language',
                'children.parent.parent.parent.translations.language',
                'children.parent.parent.parent.parent.translations.language',
            ])
            ->firstOrFail();

        $catTr = $cat->translations->firstWhere('language_id', $localeLanguageId)
            ?? $cat->translations->firstWhere('language_id', $fallbackLanguageId)
            ?? $cat->translations->first();

        $parent = null;
        if ($cat->parent) {
            $pTr = $cat->parent->translations->firstWhere('language_id', $localeLanguageId)
                ?? $cat->parent->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $cat->parent->translations->first();

            $parent = [
                'id' => $cat->parent->id,
                'slug' => $cat->parent->slug,
                'name' => $pTr?->name ?? $cat->parent->slug,
                'image' => $this->categoryImageUrl($cat->parent->image),
            ];
        }

        $children = $cat->children
            ->where('is_active', true)
            ->map(function (Category $c) use ($localeLanguageId, $fallbackLanguageId) {
                $ct = $c->translations->firstWhere('language_id', $localeLanguageId)
                    ?? $c->translations->firstWhere('language_id', $fallbackLanguageId)
                    ?? $c->translations->first();

                return [
                    'id' => $c->id,
                    'slug' => $c->slug,
                    'name' => $ct?->name ?? $c->slug,
                    'image' => $this->categoryImageUrl($c->image),
                    'ancestors' => $this->buildAncestorTree($c, $localeLanguageId, $fallbackLanguageId),
                ];
            })
            ->values();

        $productsQuery = $cat->products()
            ->where('products.is_active', true)
            ->with([
                'translations.language',
                'prices.currency',
                'images.translations.language',
                'inventories',
                'variants.prices.currency',
                'variants.inventories',
                'variants.values.attribute.translations.language',
                'variants.values.value.translations.language',
            ])
            ->orderByDesc('products.id');

        $paginator = $productsQuery->paginate(24)->withQueryString();

        $items = collect($paginator->items())
            ->map(function (Product $p) use ($localeLanguageId, $fallbackLanguageId, $currency) {
                return $this->mapProductCard(
                    product: $p,
                    localeLanguageId: $localeLanguageId,
                    fallbackLanguageId: $fallbackLanguageId,
                    currency: $currency
                );
            })
            ->values();

        $wishlistProductIds = auth()->check()
            ? WishlistItem::query()
                ->where('user_id', auth()->id())
                ->pluck('product_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            : [];

        return Inertia::render('Shop/CategoryShow', [
            'category' => [
                'id' => $cat->id,
                'slug' => $cat->slug,
                'name' => $catTr?->name ?? $cat->slug,
                'description' => $catTr?->description,
                'meta_title' => $catTr?->meta_title,
                'meta_description' => $catTr?->meta_description,
                'image' => $this->categoryImageUrl($cat->image),
                'parent' => $parent,
                'ancestors' => $this->buildAncestorTree($cat, $localeLanguageId, $fallbackLanguageId),
                'children' => $children,
            ],
            'products' => [
                'data' => $items,
                'meta' => [
                    'current_page' => (int) $paginator->currentPage(),
                    'last_page' => (int) $paginator->lastPage(),
                    'per_page' => (int) $paginator->perPage(),
                    'total' => (int) $paginator->total(),
                ],
                'links' => $paginator->linkCollection(),
            ],
            'wishlist_product_ids' => $wishlistProductIds,
        ]);
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

        $main = $product->images->firstWhere('is_main', true) ?? $product->images->first();
        $alt = null;

        if ($main) {
            $imgTr = $main->translations->firstWhere('language_id', $localeLanguageId)
                ?? $main->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $main->translations->first();

            $alt = $imgTr?->alt;
        }

        $resolvedPrice = $this->resolveProductDisplayPrice($product, $currency);

        $availableStock = $product->managesInventory()
            ? (int) ($product->availableStock() ?? 0)
            : null;

        return [
            'id' => (int) $product->id,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'type' => $product->type,
            'name' => $translation?->name ?? $product->slug,
            'manages_inventory' => (bool) $product->manages_inventory,
            'available_stock' => $availableStock,
            'image' => $main ? [
                'url' => $main->path ? asset('storage/' . $main->path) : null,
                'alt' => $alt,
            ] : null,
            'price' => $resolvedPrice ? [
                'amount' => (int) $resolvedPrice->amount,
                'currency' => [
                    'code' => $resolvedPrice->currency?->code,
                    'symbol' => $resolvedPrice->currency?->symbol,
                    'decimal_places' => (int) ($resolvedPrice->currency?->decimal_places ?? 2),
                ],
            ] : null,
            'has_variants' => $product->isVariable(),
        ];
    }

    private function resolveProductDisplayPrice(Product $product, ?Currency $currency)
    {
        if ($product->isVariable()) {
            $variantPrices = $product->variants
                ->flatMap(function ($variant) {
                    return $variant->prices;
                });

            if ($currency) {
                return $variantPrices
                    ->where('currency_id', $currency->id)
                    ->sortBy('amount')
                    ->first()
                    ?? $variantPrices->sortBy('amount')->first();
            }

            return $variantPrices->sortBy('amount')->first();
        }

        if ($currency) {
            return $product->prices->firstWhere('currency_id', $currency->id)
                ?? $product->prices->first();
        }

        return $product->prices->first();
    }

    private function buildAncestorTree(Category $category, int $localeLanguageId, int $fallbackLanguageId): array
    {
        $ancestors = [];
        $visited = [];
        $current = $category->parent;

        while ($current && !in_array($current->id, $visited, true)) {
            $visited[] = $current->id;

            $translation = $current->translations->firstWhere('language_id', $localeLanguageId)
                ?? $current->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $current->translations->first();

            $ancestors[] = [
                'id' => $current->id,
                'slug' => $current->slug,
                'name' => $translation?->name ?? $current->slug,
                'image' => $this->categoryImageUrl($current->image),
            ];

            $current = $current->parent;
        }

        return array_reverse($ancestors);
    }

    private function categoryImageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return asset('storage/' . $path);
    }
}
