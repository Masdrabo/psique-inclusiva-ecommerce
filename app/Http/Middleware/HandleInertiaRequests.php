<?php

namespace App\Http\Middleware;

use App\Models\Cart;
use App\Models\Language;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallback = config('app.fallback_locale', 'pt');

        $locale = $request->route('locale')
            ?? $request->cookie('locale')
            ?? $fallback;

        $locale = strtolower(substr((string) $locale, 0, 2));

        if (!in_array($locale, $supported, true)) {
            $locale = $fallback;
        }

        App::setLocale($locale);

        $ui = trans('ui');
        if (!is_array($ui)) {
            $ui = [];
        }

        return [
            ...parent::share($request),

            'auth' => [
                'user' => $request->user(),
            ],

            'locale' => $locale,

            'locales' => [
                ['code' => 'pt', 'label' => 'Português', 'flag' => '🇵🇹'],
                ['code' => 'en', 'label' => 'English', 'flag' => '🇬🇧'],
            ],

            'translations' => [
                'ui' => $ui,
            ],

            'cart' => fn () => $this->shareCart($request),

            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }

    private function shareCart(Request $request): array
    {
        $user = $request->user();

        if (!$user) {
            return $this->emptyCartPayload();
        }

        $cart = Cart::query()
            ->with([
                'items',
                'items.product',
                'items.product.translations',
                'items.product.images',
                'items.product.images.translations',
                'items.product.prices',
                'items.variant',
                'items.variant.values.attribute.translations',
                'items.variant.values.value.translations',
            ])
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$cart) {
            return $this->emptyCartPayload();
        }

        $locale = App::getLocale();

        $localeLanguageId = Language::query()
            ->where('code', $locale)
            ->value('id');

        $fallbackLanguageId = Language::query()
            ->where('code', config('app.fallback_locale', 'pt'))
            ->value('id');

        $items = $cart->items->map(function ($item) use ($localeLanguageId, $fallbackLanguageId) {
            $product = $item->product;
            $variant = $item->variant;

            $translation = $product?->translations?->firstWhere('language_id', $localeLanguageId)
                ?? $product?->translations?->firstWhere('language_id', $fallbackLanguageId)
                ?? $product?->translations?->first();

            $name = $translation?->name
                ?? $product?->slug
                ?? $product?->sku
                ?? ('Item #' . $item->id);

            $variantLabel = null;

            if ($variant && $variant->relationLoaded('values')) {
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

            $mainImage = $product?->images?->firstWhere('is_main', true)
                ?? $product?->images?->first();

            $imageTranslation = $mainImage?->translations?->firstWhere('language_id', $localeLanguageId)
                ?? $mainImage?->translations?->firstWhere('language_id', $fallbackLanguageId)
                ?? $mainImage?->translations?->first();

            $qty = (int) ($item->qty ?? 0);

            $productPrice = null;
            if ($product?->relationLoaded('prices') && $product->prices?->count()) {
                $firstPrice = $product->prices->first();
                if ($firstPrice && isset($firstPrice->amount)) {
                    $productPrice = (int) $firstPrice->amount;
                }
            }

            $unitAmount = null;
            if (isset($item->unit_amount) && $item->unit_amount !== null) {
                $unitAmount = (int) $item->unit_amount;
            } elseif (isset($item->price_amount) && $item->price_amount !== null) {
                $unitAmount = (int) $item->price_amount;
            } elseif ($productPrice !== null) {
                $unitAmount = $productPrice;
            }

            $lineTotal = null;
            if (isset($item->line_total) && $item->line_total !== null) {
                $lineTotal = (int) $item->line_total;
            } elseif (isset($item->total_amount) && $item->total_amount !== null) {
                $lineTotal = (int) $item->total_amount;
            } elseif (isset($item->subtotal_amount) && $item->subtotal_amount !== null) {
                $lineTotal = (int) $item->subtotal_amount;
            } elseif ($unitAmount !== null) {
                $lineTotal = (int) ($unitAmount * $qty);
            } else {
                $lineTotal = 0;
            }

            return [
                'id' => (int) $item->id,
                'name' => (string) $name,
                'slug' => $product?->slug,
                'qty' => $qty,
                'unit_amount' => $unitAmount,
                'line_total' => $lineTotal,
                'sku' => $product?->sku,
                'variant_sku' => $variant?->sku,
                'variant_label' => $variantLabel,
                'image' => $mainImage
                    ? [
                        'url' => $mainImage->path ? asset('storage/' . ltrim($mainImage->path, '/')) : null,
                        'alt' => $imageTranslation?->alt ?? $name,
                    ]
                    : null,
            ];
        })->values();

        $subtotal = 0;

        if (isset($cart->subtotal_amount) && $cart->subtotal_amount !== null) {
            $subtotal = (int) $cart->subtotal_amount;
        } elseif (isset($cart->total_amount) && $cart->total_amount !== null) {
            $subtotal = (int) $cart->total_amount;
        } else {
            $subtotal = (int) $items->sum('line_total');
        }

        $currencyCode = 'EUR';
        $currencySymbol = '€';
        $currencyDecimalPlaces = 2;

        if (!empty($cart->currency_id) && class_exists(\App\Models\Currency::class)) {
            $currency = \App\Models\Currency::query()->find($cart->currency_id);

            if ($currency) {
                $currencyCode = $currency->code ?? 'EUR';
                $currencySymbol = $currency->symbol ?? '€';
                $currencyDecimalPlaces = (int) ($currency->decimal_places ?? 2);
            }
        }

        return [
            'count' => (int) $cart->items->sum('qty'),
            'items' => $items->take(5)->values(),
            'amounts' => [
                'subtotal' => $subtotal,
            ],
            'currency' => [
                'code' => $currencyCode,
                'symbol' => $currencySymbol,
                'decimal_places' => $currencyDecimalPlaces,
            ],
        ];
    }

    private function emptyCartPayload(): array
    {
        return [
            'count' => 0,
            'items' => [],
            'amounts' => [
                'subtotal' => 0,
            ],
            'currency' => [
                'code' => 'EUR',
                'symbol' => '€',
                'decimal_places' => 2,
            ],
        ];
    }
}
