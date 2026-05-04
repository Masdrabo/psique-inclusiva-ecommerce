<?php

namespace App\Http\Controllers\Wishlist;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Order;
use App\Models\Product;
use App\Models\WishlistItem;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class WishlistController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $user = $request->user();
        abort_unless($user, 403);

        [$localeLanguageId, $fallbackLanguageId, $locale] = $this->resolveLocaleContext($locale);

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        $wishlistRows = WishlistItem::query()
            ->where('user_id', $user->id)
            ->with([
                'product.translations',
                'product.prices.currency',
                'product.images.translations',
                'product.inventories',
            ])
            ->latest('id')
            ->get();

        $wishlistProductIds = $wishlistRows
            ->pluck('product_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $items = $wishlistRows
            ->map(function (WishlistItem $wishlistItem) use (
                $localeLanguageId,
                $fallbackLanguageId,
                $currency,
                $wishlistProductIds
            ) {
                return $this->mapWishlistItem(
                    $wishlistItem,
                    $localeLanguageId,
                    $fallbackLanguageId,
                    $currency,
                    $wishlistProductIds
                );
            })
            ->filter()
            ->values();

        $recentPurchasedProducts = $this->getRecentPurchasedProducts(
            userId: (int) $user->id,
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId,
            currency: $currency,
            wishlistProductIds: $wishlistProductIds,
            limit: 6
        );

        $recentProducts = collect();

        if ($recentPurchasedProducts->isEmpty()) {
            $recentProducts = $this->getRecentProducts(
                localeLanguageId: $localeLanguageId,
                fallbackLanguageId: $fallbackLanguageId,
                currency: $currency,
                excludeProductIds: $wishlistProductIds,
                wishlistProductIds: $wishlistProductIds,
                limit: 6
            );
        }

        return Inertia::render('Wishlist/Index', [
            'items' => $items,
            'recentPurchasedProducts' => $recentPurchasedProducts,
            'recentProducts' => $recentProducts,
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

        return [$localeLanguageId, $fallbackLanguageId, $locale];
    }

    private function getRecentPurchasedProducts(
        int $userId,
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency,
        array $wishlistProductIds = [],
        int $limit = 6
    ): Collection {
        $productIds = Order::query()
            ->where('user_id', $userId)
            ->whereNotNull('paid_at')
            ->with(['items:id,order_id,product_id'])
            ->latest('paid_at')
            ->latest('id')
            ->get()
            ->flatMap(function (Order $order) {
                return $order->items->pluck('product_id');
            })
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->take($limit)
            ->values();

        if ($productIds->isEmpty()) {
            return collect();
        }

        $products = Product::query()
            ->whereIn('id', $productIds->all())
            ->where('is_active', true)
            ->with([
                'translations',
                'prices.currency',
                'images.translations',
                'inventories',
            ])
            ->get()
            ->keyBy('id');

        return $productIds
            ->map(function (int $productId) use (
                $products,
                $localeLanguageId,
                $fallbackLanguageId,
                $currency,
                $wishlistProductIds
            ) {
                $product = $products->get($productId);

                if (!$product) {
                    return null;
                }

                return $this->mapProductCard(
                    $product,
                    $localeLanguageId,
                    $fallbackLanguageId,
                    $currency,
                    $wishlistProductIds
                );
            })
            ->filter()
            ->values();
    }

    private function getRecentProducts(
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency,
        array $excludeProductIds = [],
        array $wishlistProductIds = [],
        int $limit = 6
    ): Collection {
        $products = Product::query()
            ->where('is_active', true)
            ->when(!empty($excludeProductIds), function ($query) use ($excludeProductIds) {
                $query->whereNotIn('id', $excludeProductIds);
            })
            ->with([
                'translations',
                'prices.currency',
                'images.translations',
                'inventories',
            ])
            ->latest('id')
            ->limit($limit)
            ->get();

        return $products
            ->map(function (Product $product) use (
                $localeLanguageId,
                $fallbackLanguageId,
                $currency,
                $wishlistProductIds
            ) {
                return $this->mapProductCard(
                    $product,
                    $localeLanguageId,
                    $fallbackLanguageId,
                    $currency,
                    $wishlistProductIds
                );
            })
            ->filter()
            ->values();
    }

    private function mapWishlistItem(
        WishlistItem $wishlistItem,
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency,
        array $wishlistProductIds = []
    ): ?array {
        $product = $wishlistItem->product;

        if (!$product || !$product->is_active) {
            return null;
        }

        return [
            'id' => (int) $wishlistItem->id,
            'added_at' => optional($wishlistItem->created_at)->toISOString(),
            'product' => $this->mapProductCard(
                $product,
                $localeLanguageId,
                $fallbackLanguageId,
                $currency,
                $wishlistProductIds
            ),
        ];
    }

    private function mapProductCard(
        Product $product,
        int $localeLanguageId,
        int $fallbackLanguageId,
        ?Currency $currency,
        array $wishlistProductIds = []
    ): array {
        $translation = $product->translations->firstWhere('language_id', $localeLanguageId)
            ?? $product->translations->firstWhere('language_id', $fallbackLanguageId)
            ?? $product->translations->first();

        $price = $currency
            ? ($product->prices->firstWhere('currency_id', $currency->id) ?? $product->prices->first())
            : $product->prices->first();

        $mainImage = $product->images->firstWhere('is_main', true)
            ?? $product->images->first();

        $alt = null;

        if ($mainImage) {
            $imgTr = $mainImage->translations->firstWhere('language_id', $localeLanguageId)
                ?? $mainImage->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $mainImage->translations->first();

            $alt = $imgTr?->alt;
        }

        $availableStock = $product->managesInventory()
            ? (int) ($product->availableStock() ?? 0)
            : null;

        return [
            'id' => (int) $product->id,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'name' => $translation?->name ?? $product->slug,
            'is_active' => (bool) $product->is_active,
            'is_in_wishlist' => in_array((int) $product->id, $wishlistProductIds, true),
            'manages_inventory' => (bool) $product->manages_inventory,
            'allow_quantity' => (bool) $product->allow_quantity,
            'available_stock' => $availableStock,
            'image' => $mainImage ? [
                'url' => $mainImage->path ? asset('storage/' . $mainImage->path) : null,
                'alt' => $alt,
            ] : null,
            'price' => $price ? [
                'amount' => (int) $price->amount,
                'currency' => [
                    'code' => $price->currency?->code,
                    'symbol' => $price->currency?->symbol,
                    'decimal_places' => (int) ($price->currency?->decimal_places ?? 2),
                ],
            ] : null,
        ];
    }
}
