<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CartController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $cart = $this->getOrCreateActiveCart($request);

        [$localeLanguageId, $fallbackLanguageId] = $this->resolveLanguageIds($locale);

        $currency = Currency::query()
            ->select(['id', 'code', 'symbol', 'decimal_places'])
            ->find($cart->currency_id);

        $items = $cart->items()
            ->with([
                'product.translations',
                'product.prices.currency',
                'product.inventories',
                'product.images.translations',
                'variant.prices.currency',
                'variant.inventories',
                'variant.values.attribute.translations.language',
                'variant.values.value.translations.language',
            ])
            ->orderByDesc('id')
            ->get(['id', 'product_id', 'variant_id', 'qty', 'unit_amount', 'meta']);

        $mappedItems = $items->map(function (CartItem $it) use ($localeLanguageId, $fallbackLanguageId, $currency) {
            $product = $it->product;
            $variant = $it->variant;

            $translation = $product?->translations?->firstWhere('language_id', $localeLanguageId)
                ?? $product?->translations?->firstWhere('language_id', $fallbackLanguageId)
                ?? $product?->translations?->first();

            $baseName =
                $translation?->name
                ?? $product?->slug
                ?? $product?->sku
                ?? ('Item #' . $it->id);

            $variantLabel = null;
            if ($variant) {
                $variantLabel = $variant->values
                    ->map(function ($row) use ($localeLanguageId, $fallbackLanguageId) {
                        $attributeName = $row->attribute?->translations?->firstWhere('language_id', $localeLanguageId)?->name
                            ?? $row->attribute?->translations?->firstWhere('language_id', $fallbackLanguageId)?->name
                            ?? $row->attribute?->translations?->first()?->name
                            ?? $row->attribute?->code;

                        $valueName = $row->value?->translations?->firstWhere('language_id', $localeLanguageId)?->name
                            ?? $row->value?->translations?->firstWhere('language_id', $fallbackLanguageId)?->name
                            ?? $row->value?->translations?->first()?->name
                            ?? $row->value?->code;

                        if (!$attributeName || !$valueName) {
                            return null;
                        }

                        return $attributeName . ': ' . $valueName;
                    })
                    ->filter()
                    ->values()
                    ->implode(' · ');
            }

            $name = $variantLabel
                ? ($baseName . ' (' . $variantLabel . ')')
                : $baseName;

            $sku = $variant?->sku ?? $product?->sku ?? null;
            $slug = $product?->slug ?? null;

            $priceSource = 'snapshot';
            $storedUnitAmount = $it->unit_amount;

            if (is_null($storedUnitAmount)) {
                $priceSource = 'current';

                if ($variant) {
                    $price = $variant->prices?->firstWhere('currency_id', $currency?->id)
                        ?? $variant->prices?->first();
                } else {
                    $price = $product?->prices?->firstWhere('currency_id', $currency?->id)
                        ?? $product->prices?->first();
                }

                $storedUnitAmount = $price?->amount;

                if (is_null($storedUnitAmount)) {
                    $priceSource = 'unknown';
                }
            }

            $storedUnitAmount = is_null($storedUnitAmount) ? null : (int) $storedUnitAmount;
            $qty = (int) $it->qty;

            $taxRate = (float) ($product?->tax_rate ?? 0);
            $taxBasisPoints = $this->taxRateToBasisPoints($taxRate);
            $priceIncludesTax = (bool) ($product?->price_includes_tax ?? false);

            $displayUnitAmount = null;
            $lineSubtotal = 0;
            $lineTax = 0;
            $lineTotal = null;

            if (!is_null($storedUnitAmount)) {
                if ($priceIncludesTax) {
                    $displayUnitAmount = $storedUnitAmount;
                    $lineTotal = $storedUnitAmount * $qty;
                    $lineSubtotal = $this->extractNetFromGross($lineTotal, $taxBasisPoints);
                    $lineTax = $lineTotal - $lineSubtotal;
                } else {
                    $displayUnitAmount = $this->grossFromNet($storedUnitAmount, $taxBasisPoints);
                    $lineSubtotal = $storedUnitAmount * $qty;
                    $lineTax = $this->calculateTaxFromNet($lineSubtotal, $taxBasisPoints);
                    $lineTotal = $lineSubtotal + $lineTax;
                }
            }

            $availableStock = null;
            if ($variant && $product?->managesInventory()) {
                $availableStock = $variant->availableStock();
            } elseif ($product?->managesInventory()) {
                $availableStock = $product->availableStock();
            }

            $reorderOrderId = data_get($it->meta, 'reordered_from_order_id');
            $reorderOrderItemId = data_get($it->meta, 'reordered_from_order_item_id');

            $mainImage = $product?->images?->firstWhere('is_main', true)
                ?? $product?->images?->first();

            $imageAlt = null;

            if ($mainImage) {
                $imgTranslation = $mainImage->translations?->firstWhere('language_id', $localeLanguageId)
                    ?? $mainImage->translations?->firstWhere('language_id', $fallbackLanguageId)
                    ?? $mainImage->translations?->first();

                $imageAlt = $imgTranslation?->alt;
            }

            return [
                'id' => (int) $it->id,
                'product_id' => $product?->id ? (int) $product->id : null,
                'variant_id' => $variant?->id ? (int) $variant->id : null,
                'name' => (string) $name,
                'variant_label' => $variantLabel,
                'slug' => $slug,
                'sku' => $sku,
                'qty' => $qty,

                'unit_amount' => $displayUnitAmount,
                'line_total' => $lineTotal,

                'subtotal_amount' => (int) $lineSubtotal,
                'tax_amount' => (int) $lineTax,
                'tax_rate' => $taxRate,
                'price_includes_tax' => $priceIncludesTax,

                'price_source' => $priceSource,
                'business_type' => $product?->business_type,
                'requires_shipping' => (bool) ($product?->requires_shipping ?? false),
                'manages_inventory' => (bool) ($product?->manages_inventory ?? false),
                'allow_quantity' => (bool) ($product?->allow_quantity ?? true),
                'max_per_order' => $product?->max_per_order,
                'available_stock' => is_null($availableStock) ? null : (int) $availableStock,
                'image' => $mainImage ? [
                    'url' => $mainImage->path ? asset('storage/' . $mainImage->path) : null,
                    'alt' => $imageAlt,
                ] : null,
                'reorder' => $reorderOrderId ? [
                    'order_id' => (int) $reorderOrderId,
                    'order_item_id' => $reorderOrderItemId ? (int) $reorderOrderItemId : null,
                ] : null,
            ];
        })->values();

        $subtotal = (int) $mappedItems->sum('subtotal_amount');
        $tax = (int) $mappedItems->sum('tax_amount');
        $total = (int) $mappedItems->sum(function ($it) {
            return (int) ($it['line_total'] ?? 0);
        });

        $pricesIncludeTax = $mappedItems->contains(function ($it) {
            return (bool) ($it['price_includes_tax'] ?? false);
        });

        return Inertia::render('Cart/Index', [
            'cart' => [
                'id' => (int) $cart->id,
                'count' => (int) $cart->items()->sum('qty'),
                'currency' => $currency ? [
                    'code' => $currency->code,
                    'symbol' => $currency->symbol,
                    'decimal_places' => (int) $currency->decimal_places,
                ] : [
                    'code' => 'EUR',
                    'symbol' => '€',
                    'decimal_places' => 2,
                ],
                'amounts' => [
                    'subtotal' => $subtotal,
                    'tax' => $tax,
                    'total' => $total,
                ],
                'prices_include_tax' => $pricesIncludeTax,
                'items' => $mappedItems,
            ],
        ]);
    }

    public function store(string $locale, Request $request, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => ['nullable', 'integer'],
            'variant_id' => ['nullable', 'integer'],
            'qty' => ['required', 'integer', 'min:1'],
        ]);

        $hasProduct = !empty($data['product_id']);
        $hasVariant = !empty($data['variant_id']);

        if (($hasProduct && $hasVariant) || (!$hasProduct && !$hasVariant)) {
            return back()->withErrors([
                'item' => __('ui.cart.errors.product_or_variant_required'),
            ]);
        }

        $product = null;
        $variant = null;

        if ($hasVariant) {
            $variant = ProductVariant::query()
                ->with(['product', 'prices.currency', 'inventories'])
                ->find($data['variant_id']);

            $product = $variant?->product;

            if (
                !$variant ||
                !$product ||
                !$product->is_active ||
                !$product->isCurrentlyAvailable() ||
                !$variant->is_active
            ) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.product_unavailable'),
                ]);
            }
        } else {
            $product = Product::query()
                ->with(['prices.currency', 'inventories'])
                ->find($data['product_id']);

            if (
                !$product ||
                !$product->is_active ||
                !$product->isCurrentlyAvailable()
            ) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.product_unavailable'),
                ]);
            }

            if ($product->isVariable()) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.variant_required'),
                ]);
            }
        }

        $cart = $this->getOrCreateActiveCart($request);
        $variantKey = $variant?->id ? (int) $variant->id : 0;

        $item = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->where('variant_key', $variantKey)
            ->first();

        $existingQty = (int) ($item?->qty ?? 0);
        $requestedQty = (int) $data['qty'];
        $newQty = $existingQty + $requestedQty;

        if (!$product->canSetQuantity($newQty)) {
            return back()->withErrors([
                'item' => __('ui.cart.errors.invalid_quantity'),
            ]);
        }

        if ($variant && $product->managesInventory()) {
            $available = $inventoryService->availableForVariant($variant);

            if (($available ?? 0) <= 0) {
                $variant->update(['is_active' => false]);
                $product->refresh();
                $product->syncActiveFromInventory();

                return back()->withErrors([
                    'item' => __('ui.cart.errors.out_of_stock'),
                ]);
            }

            if ($newQty > $available) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.insufficient_stock', [
                        'available' => $available,
                    ]),
                ]);
            }
        } elseif ($product->managesInventory()) {
            $available = $inventoryService->availableForProduct($product);

            if (($available ?? 0) <= 0) {
                $product->update(['is_active' => false]);

                return back()->withErrors([
                    'item' => __('ui.cart.errors.out_of_stock'),
                ]);
            }

            if ($newQty > $available) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.insufficient_stock', [
                        'available' => $available,
                    ]),
                ]);
            }
        }

        $cartCurrency = Currency::query()->find($cart->currency_id);
        $unitAmount = null;

        if ($variant) {
            $variantPrice = $variant->prices->firstWhere('currency_id', $cartCurrency?->id)
                ?? $variant->prices->first();

            $unitAmount = $variantPrice?->amount;
        } else {
            $productPrice = $product->prices->firstWhere('currency_id', $cartCurrency?->id)
                ?? $product->prices->first();

            $unitAmount = $productPrice?->amount;
        }

        $metaPayload = [
            'business_type' => $product->business_type,
            'requires_shipping' => (bool) $product->requires_shipping,
            'manages_inventory' => (bool) $product->manages_inventory,
            'allow_quantity' => (bool) $product->allow_quantity,
            'tax_rate' => (float) ($product->tax_rate ?? 0),
            'price_includes_tax' => (bool) ($product->price_includes_tax ?? false),
        ];

        if ($variant) {
            $metaPayload['variant_id'] = (int) $variant->id;
            $metaPayload['variant_sku'] = $variant->sku;
        }

        if ($item) {
            $item->qty = $newQty;
            $item->unit_amount = $unitAmount;
            $item->variant_id = $variant?->id ? (int) $variant->id : null;
            $item->variant_key = $variantKey;
            $item->meta = array_merge($item->meta ?? [], $metaPayload);
            $item->save();
        } else {
            CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => (int) $product->id,
                'variant_id' => $variant?->id ? (int) $variant->id : null,
                'variant_key' => $variantKey,
                'qty' => $product->allow_quantity ? $requestedQty : 1,
                'unit_amount' => $unitAmount,
                'meta' => $metaPayload,
            ]);
        }

        return back()->with('success', __('ui.cart.item_added'));
    }

    public function update(string $locale, Request $request, CartItem $item, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validate([
            'qty' => ['required', 'integer', 'min:1'],
        ]);

        $cart = $this->getOrCreateActiveCart($request);

        if ((int) $item->cart_id !== (int) $cart->id) {
            abort(403);
        }

        $item->load([
            'product.prices.currency',
            'product.inventories',
            'variant.prices.currency',
            'variant.inventories',
        ]);

        $product = $item->product;
        $variant = $item->variant;

        if (!$product || !$product->is_active || !$product->isCurrentlyAvailable()) {
            return back()->withErrors([
                'item' => __('ui.cart.errors.product_unavailable'),
            ]);
        }

        if ($variant && !$variant->is_active) {
            return back()->withErrors([
                'item' => __('ui.cart.errors.product_unavailable'),
            ]);
        }

        $targetQty = (int) $data['qty'];

        if (!$product->canSetQuantity($targetQty)) {
            return back()->withErrors([
                'item' => __('ui.cart.errors.invalid_quantity'),
            ]);
        }

        if ($variant && $product->managesInventory()) {
            $available = $inventoryService->availableForVariant($variant);

            if (($available ?? 0) <= 0) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.out_of_stock'),
                ]);
            }

            if ($targetQty > $available) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.insufficient_stock', [
                        'available' => $available,
                    ]),
                ]);
            }
        } elseif ($product->managesInventory()) {
            $available = $inventoryService->availableForProduct($product);

            if (($available ?? 0) <= 0) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.out_of_stock'),
                ]);
            }

            if ($targetQty > $available) {
                return back()->withErrors([
                    'item' => __('ui.cart.errors.insufficient_stock', [
                        'available' => $available,
                    ]),
                ]);
            }
        }

        $item->qty = $targetQty;
        $item->variant_key = $variant?->id ? (int) $variant->id : 0;
        $item->meta = array_merge($item->meta ?? [], [
            'business_type' => $product->business_type,
            'requires_shipping' => (bool) $product->requires_shipping,
            'manages_inventory' => (bool) $product->manages_inventory,
            'allow_quantity' => (bool) $product->allow_quantity,
            'tax_rate' => (float) ($product->tax_rate ?? 0),
            'price_includes_tax' => (bool) ($product->price_includes_tax ?? false),
            'variant_id' => $variant?->id,
            'variant_sku' => $variant?->sku,
        ]);
        $item->save();

        return back()->with('success', __('ui.cart.updated'));
    }

    public function destroy(string $locale, Request $request, CartItem $item): RedirectResponse
    {
        $cart = $this->getOrCreateActiveCart($request);

        if ((int) $item->cart_id !== (int) $cart->id) {
            abort(403);
        }

        $item->delete();

        return back()->with('success', __('ui.cart.item_removed'));
    }

    private function taxRateToBasisPoints(float $rate): int
    {
        return (int) round($rate * 100);
    }

    private function calculateTaxFromNet(int $netAmount, int $taxBasisPoints): int
    {
        if ($taxBasisPoints <= 0 || $netAmount <= 0) {
            return 0;
        }

        return (int) round(($netAmount * $taxBasisPoints) / 10000);
    }

    private function grossFromNet(int $netAmount, int $taxBasisPoints): int
    {
        return $netAmount + $this->calculateTaxFromNet($netAmount, $taxBasisPoints);
    }

    private function extractNetFromGross(int $grossAmount, int $taxBasisPoints): int
    {
        if ($taxBasisPoints <= 0 || $grossAmount <= 0) {
            return max(0, $grossAmount);
        }

        return (int) round(($grossAmount * 10000) / (10000 + $taxBasisPoints));
    }

    private function getOrCreateActiveCart(Request $request): Cart
    {
        $user = $request->user();
        abort_unless($user, 403);

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($cart) {
            return $cart;
        }

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first()
            ?? $this->createDefaultCurrency();

        return Cart::create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);
    }

    private function createDefaultCurrency(): Currency
    {
        Currency::query()->update(['is_default' => false]);

        return Currency::query()->create([
            'code' => 'EUR',
            'symbol' => '€',
            'decimal_places' => 2,
            'is_default' => true,
            'is_active' => true,
        ]);
    }

    private function resolveLanguageIds(string $locale): array
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

        return [$localeLanguageId, $fallbackLanguageId];
    }
}
