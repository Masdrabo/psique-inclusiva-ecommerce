<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttributeValue extends Model
{
    protected $table = 'attribute_values';

    protected $fillable = [
        'attribute_id',
        'code',
    ];

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class, 'attribute_id');
    }

    public function translations(): HasMany
    {
        return $this->hasMany(AttributeValueTranslation::class, 'attribute_value_id');
    }

    public function variantValues(): HasMany
    {
        return $this->hasMany(ProductVariantValue::class, 'attribute_value_id');
    }
}
