<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class Donation extends Model
{
    use HasFactory;

    protected $fillable = [
        'donation_number',
        'public_token',
        'user_id',
        'currency_id',
        'payment_method_id',
        'amount',
        'status',
        'donor_name',
        'donor_email',
        'donor_phone',
        'provider',
        'entity',
        'reference',
        'provider_payment_id',
        'expires_at',
        'payload',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'payload' => 'array',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Boot
    |--------------------------------------------------------------------------
    */

    protected static function booted(): void
    {
        static::creating(function (Donation $donation) {
            if (empty($donation->public_token)) {
                $donation->public_token = (string) Str::uuid();
            }

            if (empty($donation->donation_number)) {
                $donation->donation_number = self::generateDonationNumber();
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function getFormattedAmountAttribute(): string
    {
        return number_format($this->amount / 100, 2, ',', '.') . ' €';
    }

    private static function generateDonationNumber(): string
    {
        for ($i = 0; $i < 5; $i++) {
            $number = 'DON-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));

            if (! self::query()->where('donation_number', $number)->exists()) {
                return $number;
            }
        }

        return 'DON-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(8));
    }
}
