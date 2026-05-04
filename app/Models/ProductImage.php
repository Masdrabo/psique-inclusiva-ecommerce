<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductImage extends Model
{
    protected $fillable = [
        'product_id',
        'path',
        'alt',       // legacy (podes manter)
        'position',
        'is_main',
    ];

    protected $casts = [
        'is_main' => 'boolean',
        'position' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function translations(): HasMany
    {
        return $this->hasMany(ProductImageTranslation::class, 'product_image_id');
    }
}
