<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'code',
        'name',
        'type',
        'amount',
        'percentage',
        'minimum_subtotal_amount',
        'max_total_uses',
        'max_uses_per_user',
        'total_uses',
        'is_active',
        'starts_at',
        'ends_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'percentage' => 'decimal:2',
        'minimum_subtotal_amount' => 'integer',
        'max_total_uses' => 'integer',
        'max_uses_per_user' => 'integer',
        'total_uses' => 'integer',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    public function isCurrentlyValid(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = now();

        if ($this->starts_at && $now->lt($this->starts_at)) {
            return false;
        }

        if ($this->ends_at && $now->gt($this->ends_at)) {
            return false;
        }

        return true;
    }
}
