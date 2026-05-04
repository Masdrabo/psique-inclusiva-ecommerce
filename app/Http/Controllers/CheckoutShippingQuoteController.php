<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\ShippingMethod;
use App\Services\Shipping\ShippingRateCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutShippingQuoteController extends Controller
{
    public function __invoke(
        Request $request,
        ShippingRateCalculatorService $shippingRateCalculatorService
    ): JsonResponse {
        $validated = $request->validate([
            'cart_id' => ['required', 'integer', 'exists:carts,id'],
            'shipping_zone_code' => ['required', 'string', 'max:64', 'exists:shipping_zones,code'],
            'shipping_method_code' => ['nullable', 'string', 'max:64'],
            'shipping_profile' => ['nullable', 'string', 'max:64'],
        ]);

        $cart = Cart::query()
            ->with(['items.product'])
            ->findOrFail($validated['cart_id']);

        $shippingMethodCode = $validated['shipping_method_code'] ?? 'standard';
        $shippingProfile = $validated['shipping_profile'] ?? 'standard';

        $shippingMethod = ShippingMethod::query()
            ->where('code', $shippingMethodCode)
            ->where('is_active', true)
            ->first();

        if (! $shippingMethod) {
            return response()->json([
                'ok' => false,
                'message' => 'shipping_method_not_found',
                'quote' => null,
            ], 422);
        }

        $quote = $shippingRateCalculatorService->quoteForZone(
            items: $cart->items,
            shippingZoneCode: $validated['shipping_zone_code'],
            shippingMethodId: $shippingMethod->id,
            shippingProfile: $shippingProfile
        );

        return response()->json([
            'ok' => ($quote['error'] ?? null) === null,
            'message' => $quote['error'] ?? null,
            'quote' => $quote,
        ]);
    }
}
