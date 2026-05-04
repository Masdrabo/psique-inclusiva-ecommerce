<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'variant_id',
        'name',
        'sku',
        'qty',
        'unit_amount',
        'discount_amount',
        'tax_amount',
        'total_amount',
        'meta',
    ];

    protected $casts = [
        'qty' => 'integer',
        'unit_amount' => 'integer',
        'discount_amount' => 'integer',
        'tax_amount' => 'integer',
        'total_amount' => 'integer',
        'meta' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function refundItems(): HasMany
    {
        return $this->hasMany(RefundItem::class);
    }

    public function returnItems(): HasMany
    {
        return $this->hasMany(ReturnItem::class);
    }

    public function shipmentItems(): HasMany
    {
        return $this->hasMany(ShipmentItem::class);
    }

    public function getTaxRateAttribute(): ?float
    {
        $value = data_get($this->meta, 'tax_rate');

        return $value === null ? null : (float) $value;
    }

    public function getPriceIncludesTaxAttribute(): bool
    {
        return (bool) data_get($this->meta, 'price_includes_tax', false);
    }
}
