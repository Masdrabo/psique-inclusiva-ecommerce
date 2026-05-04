<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $fillable = [
        'warehouse_id',
        'product_id',
        'variant_id',
        'qty_on_hand',
        'qty_reserved',
    ];

    protected $casts = [
        'qty_on_hand' => 'integer',
        'qty_reserved' => 'integer',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function getAvailableQtyAttribute(): int
    {
        return max(0, (int) $this->qty_on_hand - (int) $this->qty_reserved);
    }
}
