<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'user_id',
        'customer_id',
        'currency_id',
        'status_id',
        'coupon_id',
        'coupon_code',
        'checkout_token',
        'accepted_terms_at',
        'accepted_privacy_at',
        'accepted_terms_version',
        'accepted_privacy_version',
        'billing_address',
        'shipping_address',
        'subtotal_amount',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'total_amount',
        'paid_at',
    ];

    protected $casts = [
        'billing_address' => 'array',
        'shipping_address' => 'array',
        'paid_at' => 'datetime',
        'accepted_terms_at' => 'datetime',
        'accepted_privacy_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(OrderStatus::class, 'status_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * Mantém compatibilidade com o teu fluxo atual de 1 envio principal.
     */
    public function shipment(): HasOne
    {
        return $this->hasOne(Shipment::class);
    }

    /**
     * Prepara o modelo para múltiplos envios no futuro.
     */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->latest('id');
    }

    public function statusNotifications(): HasMany
    {
        return $this->hasMany(OrderStatusNotification::class)->latest('id');
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function couponRedemption(): HasOne
    {
        return $this->hasOne(CouponRedemption::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(OrderReturn::class, 'order_id');
    }
}
