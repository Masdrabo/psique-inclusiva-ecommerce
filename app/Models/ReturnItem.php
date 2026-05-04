<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnItem extends Model
{
    protected $fillable = [
        'return_id',
        'order_item_id',
        'qty',
        'received_qty',
        'restock_qty',
        'exchange_shipped_qty',
        'exchange_tracking_number',
        'exchange_shipped_at',
        'exchange_notes',
        'reason',
        'condition',
        'resolution',
    ];

    protected $casts = [
        'qty' => 'integer',
        'received_qty' => 'integer',
        'restock_qty' => 'integer',
        'exchange_shipped_qty' => 'integer',
        'exchange_shipped_at' => 'datetime',
    ];

    public function return(): BelongsTo
    {
        return $this->belongsTo(OrderReturn::class, 'return_id');
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
