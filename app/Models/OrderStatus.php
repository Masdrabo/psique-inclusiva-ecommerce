<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderStatus extends Model
{
    protected $fillable = ['code', 'name'];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'status_id');
    }

    public function historyEntries(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class, 'status_id');
    }
}
