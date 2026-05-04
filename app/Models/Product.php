<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Product extends Model
{
    protected $fillable = [
        'sku',
        'slug',
        'type',
        'business_type',
        'is_active',
        'barcode',
        'weight_grams',
        'tax_rate',
        'price_includes_tax',
        'requires_shipping',
        'manages_inventory',
        'allow_quantity',
        'requires_customer_notes',
        'max_per_order',
        'available_from',
        'available_until',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'tax_rate' => 'decimal:2',
        'price_includes_tax' => 'boolean',
        'requires_shipping' => 'boolean',
        'manages_inventory' => 'boolean',
        'allow_quantity' => 'boolean',
        'requires_customer_notes' => 'boolean',
        'available_from' => 'datetime',
        'available_until' => 'datetime',
    ];

    public function translations(): HasMany
    {
        return $this->hasMany(ProductTranslation::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_product');
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function activeVariants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->where('is_active', true);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function businessDetail(): HasOne
    {
        return $this->hasOne(ProductBusinessDetail::class);
    }

    /**
     * 🔁 Slug redirects (SEO safe slug changes)
     */
    public function slugRedirects(): MorphMany
    {
        return $this->morphMany(SlugRedirect::class, 'redirectable');
    }

    public function wishlistItems(): HasMany
    {
        return $this->hasMany(WishlistItem::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class)->latest('id');
    }

    public function isSimple(): bool
    {
        return $this->type === 'simple';
    }

    public function isVariable(): bool
    {
        return $this->type === 'variable';
    }

    public function isPhysical(): bool
    {
        return $this->business_type === 'physical';
    }

    public function isMembershipFee(): bool
    {
        return $this->business_type === 'membership_fee';
    }

    public function isDigitalService(): bool
    {
        return $this->business_type === 'digital_service';
    }

    public function requiresShipping(): bool
    {
        return (bool) $this->requires_shipping;
    }

    public function managesInventory(): bool
    {
        return (bool) $this->manages_inventory;
    }

    public function priceIncludesTax(): bool
    {
        return (bool) $this->price_includes_tax;
    }

    public function taxRatePercent(): float
    {
        return (float) $this->tax_rate;
    }

    public function canSetQuantity(int $qty): bool
    {
        if ($qty < 1) {
            return false;
        }

        if (!$this->allow_quantity && $qty > 1) {
            return false;
        }

        if (!is_null($this->max_per_order) && $qty > $this->max_per_order) {
            return false;
        }

        return true;
    }

    public function isCurrentlyAvailable(): bool
    {
        $now = now();

        if ($this->available_from && $now->lt($this->available_from)) {
            return false;
        }

        if ($this->available_until && $now->gt($this->available_until)) {
            return false;
        }

        return true;
    }

    public function availableStock(): ?int
    {
        if (!$this->managesInventory()) {
            return null;
        }

        if ($this->isVariable()) {
            if ($this->relationLoaded('variants')) {
                return (int) $this->variants->sum(function ($variant) {
                    if (!$variant->relationLoaded('inventories')) {
                        return $variant->availableStock() ?? 0;
                    }

                    return (int) $variant->inventories->sum(function ($inventory) {
                        return max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);
                    });
                });
            }

            return (int) $this->variants()
                ->with('inventories:id,variant_id,qty_on_hand,qty_reserved')
                ->get()
                ->sum(function ($variant) {
                    return (int) $variant->inventories->sum(function ($inventory) {
                        return max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);
                    });
                });
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
        if (!$this->managesInventory()) {
            return;
        }

        if ($this->isVariable()) {
            $hasAnyActiveVariant = $this->variants()
                ->where('is_active', true)
                ->exists();

            if ((bool) $this->is_active !== $hasAnyActiveVariant) {
                $this->forceFill([
                    'is_active' => $hasAnyActiveVariant,
                ])->saveQuietly();
            }

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
