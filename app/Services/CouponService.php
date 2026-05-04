<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CouponService
{
    public function findByCode(string $code): ?Coupon
    {
        $normalized = strtoupper(trim($code));

        if ($normalized === '') {
            return null;
        }

        return Coupon::query()
            ->where('code', $normalized)
            ->first();
    }

    public function validateForUserAndSubtotal(Coupon $coupon, ?User $user, int $subtotalAmount): void
    {
        if (!$coupon->isCurrentlyValid()) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.invalid_or_inactive'),
            ]);
        }

        if ($subtotalAmount < (int) $coupon->minimum_subtotal_amount) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.minimum_not_met'),
            ]);
        }

        if (!is_null($coupon->max_total_uses) && (int) $coupon->total_uses >= (int) $coupon->max_total_uses) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.usage_limit_reached'),
            ]);
        }

        if ($user && !is_null($coupon->max_uses_per_user)) {
            $userUses = $coupon->redemptions()
                ->where('user_id', $user->id)
                ->count();

            if ($userUses >= (int) $coupon->max_uses_per_user) {
                throw ValidationException::withMessages([
                    'coupon_code' => __('ui.coupons.user_limit_reached'),
                ]);
            }
        }

        if ($coupon->type === 'fixed_amount' && (is_null($coupon->amount) || (int) $coupon->amount <= 0)) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.invalid_or_inactive'),
            ]);
        }

        if ($coupon->type === 'percentage' && ((float) $coupon->percentage <= 0 || (float) $coupon->percentage > 100)) {
            throw ValidationException::withMessages([
                'coupon_code' => __('ui.coupons.invalid_or_inactive'),
            ]);
        }
    }

    public function calculateDiscountAmount(Coupon $coupon, int $subtotalAmount): int
    {
        if ($subtotalAmount <= 0) {
            return 0;
        }

        if ($coupon->type === 'fixed_amount') {
            return min($subtotalAmount, (int) $coupon->amount);
        }

        if ($coupon->type === 'percentage') {
            $discount = (int) round($subtotalAmount * ((float) $coupon->percentage / 100));
            return min($subtotalAmount, max(0, $discount));
        }

        return 0;
    }
}
