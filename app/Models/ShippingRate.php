<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingRate extends Model
{
    protected $fillable = [
        'shipping_zone_id',
        'shipping_method_id',
        'shipping_profile',
        'min_weight_grams',
        'max_weight_grams',
        'price_cents',
        'estimated_days_min',
        'estimated_days_max',
        'is_active',
    ];

    protected $casts = [
        'shipping_zone_id' => 'integer',
        'shipping_method_id' => 'integer',
        'min_weight_grams' => 'integer',
        'max_weight_grams' => 'integer',
        'price_cents' => 'integer',
        'estimated_days_min' => 'integer',
        'estimated_days_max' => 'integer',
        'is_active' => 'boolean',
    ];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(ShippingZone::class, 'shipping_zone_id');
    }

    public function shippingMethod(): BelongsTo
    {
        return $this->belongsTo(ShippingMethod::class, 'shipping_method_id');
    }
}
