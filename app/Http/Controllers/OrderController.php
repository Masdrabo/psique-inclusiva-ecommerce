<?php

namespace App\Http\Controllers;

use App\Models\Language;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function thankYou(string $locale, Request $request, Order $order): Response
{
    $user = $request->user();
    abort_unless($user, 403);

    abort_unless((int) $order->user_id === (int) $user->id, 403);

    [$localeLanguageId, $fallbackLanguageId] = $this->resolveLanguageIds($locale);

    $order->load([
        'items.product.translations',
        'items.product.images.translations',
        'status',
        'currency',
        'payment.method',
        'shipment.method',
    ]);

    $payment = $order->payment;
    $shipment = $order->shipment;
    $isPickup = (($shipment?->method?->code ?? null) === 'pickup');

    $mappedItems = $order->items->map(function ($it) use ($localeLanguageId, $fallbackLanguageId) {
        $product = $it->product;

        $mainImage = $product?->images?->firstWhere('is_main', true)
            ?? $product?->images?->first();

        $imageTranslation = $mainImage?->translations?->firstWhere('language_id', $localeLanguageId)
            ?? $mainImage?->translations?->firstWhere('language_id', $fallbackLanguageId)
            ?? $mainImage?->translations?->first();

        $meta = is_array($it->meta) ? $it->meta : [];

        return [
            'id' => $it->id,
            'name' => $it->name,
            'sku' => $it->sku,
            'qty' => (int) $it->qty,
            'unit_amount' => (int) $it->unit_amount,
            'discount_amount' => (int) $it->discount_amount,
            'tax_amount' => (int) $it->tax_amount,
            'total_amount' => (int) $it->total_amount,
            'slug' => $product?->slug,
            'meta' => $meta,
            'image' => $mainImage ? [
                'url' => $mainImage->path ? asset('storage/' . ltrim($mainImage->path, '/')) : null,
                'alt' => $imageTranslation?->alt ?? $it->name,
            ] : null,
        ];
    })->values();

    $pricesIncludeTax = $mappedItems->contains(function ($item) {
        return (bool) data_get($item, 'meta.price_includes_tax', false);
    });

    return Inertia::render('Orders/ThankYou', [
        'order' => [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'created_at' => optional($order->created_at)?->toISOString(),
            'paid_at' => optional($order->paid_at)?->toISOString(),

            'is_pickup' => $isPickup,
            'shipping_label' => $isPickup
                ? __('ui.orders.pickup_in_store')
                : ($shipment?->method?->name ?? null),

            'status' => [
                'code' => $order->status?->code,
                'name' => $order->status?->name,
            ],

            'amounts' => [
                'subtotal' => (int) $order->subtotal_amount,
                'shipping' => (int) $order->shipping_amount,
                'tax' => (int) $order->tax_amount,
                'discount' => (int) $order->discount_amount,
                'total' => (int) $order->total_amount,
            ],

            'currency' => [
                'code' => $order->currency?->code,
                'symbol' => $order->currency?->symbol,
                'decimal_places' => (int) ($order->currency?->decimal_places ?? 2),
            ],

            'billing_address' => $order->billing_address,
            'shipping_address' => $order->shipping_address,
            'prices_include_tax' => $pricesIncludeTax,

            'items' => $mappedItems,

            'payment' => $payment ? [
                'status' => $payment->status,
                'amount' => (int) $payment->amount,
                'provider' => $payment->provider,
                'entity' => $payment->entity,
                'reference' => $payment->reference,
                'expires_at' => optional($payment->expires_at)?->toISOString(),
                'provider_payment_id' => $payment->provider_payment_id,
                'payload' => $payment->payload,
                'method' => [
                    'code' => $payment->method?->code,
                    'name' => $payment->method?->name,
                ],
                'mbway' => $payment->method?->code === 'ifthenpay_mbway' ? [
                    'phone' => data_get($payment->payload, 'mbway_phone'),
                    'expires_at' => optional($payment->expires_at)?->toISOString(),
                ] : null,
            ] : null,

            'shipment' => $shipment ? [
                'status' => $shipment->status,
                'method' => [
                    'code' => $shipment->method?->code,
                    'name' => $shipment->method?->name,
                ],
                'tracking_number' => $shipment->tracking_number,
            ] : null,
        ],
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
