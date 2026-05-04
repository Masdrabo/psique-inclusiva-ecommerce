<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductVariant extends Model
{
    protected $table = 'product_variants';

    protected $fillable = [
        'product_id',
        'sku',
        'barcode',
        'combination_key',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function values(): HasMany
    {
        return $this->hasMany(ProductVariantValue::class, 'variant_id');
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class, 'variant_id');
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class, 'variant_id');
    }

    public function availableStock(): ?int
    {
        if (!$this->product || !$this->product->managesInventory()) {
            return null;
        }

        if ($this->relationLoaded('inventories')) {
            return (int) $this->inventories->sum(function ($inventory) {
                return max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);
            });
        }

        return (int) $this->inventories()
            ->get(['qty_on_hand', 'qty_reserved'])
            ->sum(function ($inventory) {
                return max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);
            });
    }

    public function syncActiveFromInventory(): void
    {
        if (!$this->product || !$this->product->managesInventory()) {
            return;
        }

        $shouldBeActive = ($this->availableStock() ?? 0) > 0;

        if ((bool) $this->is_active !== $shouldBeActive) {
            $this->forceFill([
                'is_active' => $shouldBeActive,
            ])->saveQuietly();
        }
    }
}
