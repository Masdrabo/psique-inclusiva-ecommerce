<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductBusinessDetail extends Model
{
    protected $fillable = [
        'product_id',
        'membership_period_unit',
        'membership_period_value',
        'membership_renews_manually',
        'delivery_mode',
        'service_kind',
        'access_instructions',
        'capacity',
        'starts_at',
        'ends_at',
        'location',
        'meeting_url',
    ];

    protected $casts = [
        'membership_renews_manually' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
