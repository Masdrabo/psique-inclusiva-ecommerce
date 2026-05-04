<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\Currency;
use App\Services\CouponService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CheckoutCouponController extends Controller
{
    public function store(string $locale, Request $request, CouponService $couponService): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'coupon_code' => ['required', 'string', 'max:64'],
        ]);

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        abort_unless($currency, 500, 'Não existe moeda ativa (currencies).');

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->with([
                'items.product.prices',
            ])
            ->first();

        if (!$cart || $cart->items->isEmpty()) {
            return back()->withErrors([
                'coupon_code' => __('ui.coupons.empty_cart'),
            ]);
        }

        $subtotal = (int) $cart->items->sum(function ($item) use ($currency) {
            $product = $item->product;

            if (!$product) {
                return 0;
            }

            $price = $product->prices->firstWhere('currency_id', $currency->id)
                ?? $product->prices->first();

            $unitAmount = (int) ($price?->amount ?? $item->unit_amount ?? 0);

            return $unitAmount * (int) $item->qty;
        });

        $coupon = $couponService->findByCode($data['coupon_code']);

        if (!$coupon) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.not_found'),
            ]);
        }

        $couponService->validateForUserAndSubtotal($coupon, $user, $subtotal);

        session()->put('checkout_coupon_code', $coupon->code);

        return back()->with('success', __('ui.coupons.applied'));
    }

    public function destroy(string $locale, Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        session()->forget('checkout_coupon_code');

        return back()->with('success', __('ui.coupons.removed'));
    }
}
