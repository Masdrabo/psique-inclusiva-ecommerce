<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\WishlistItem;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /*
    |--------------------------------------------------------------------------
    | Roles
    |--------------------------------------------------------------------------
    */

    public const ROLE_ADMIN = 'admin';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_CUSTOMER = 'customer';

    /*
    |--------------------------------------------------------------------------
    | Account Status
    |--------------------------------------------------------------------------
    */

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_BANNED = 'banned';

    /*
    |--------------------------------------------------------------------------
    | Mass Assignable
    |--------------------------------------------------------------------------
    */

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'suspended_until',
        'banned_at',
        'ban_reason',
        'banned_by',
    ];

    /*
    |--------------------------------------------------------------------------
    | Hidden
    |--------------------------------------------------------------------------
    */

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /*
    |--------------------------------------------------------------------------
    | Casts
    |--------------------------------------------------------------------------
    */

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'suspended_until' => 'datetime',
            'banned_at' => 'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Defaults
    |--------------------------------------------------------------------------
    */

    protected static function booted(): void
    {
        static::creating(function (self $user) {
            if (!$user->role) {
                $user->role = self::ROLE_CUSTOMER;
            }

            if (!$user->status) {
                $user->status = self::STATUS_ACTIVE;
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Static Helpers
    |--------------------------------------------------------------------------
    */

    public static function roles(): array
    {
        return [
            self::ROLE_ADMIN,
            self::ROLE_MANAGER,
            self::ROLE_CUSTOMER,
        ];
    }

    public static function statuses(): array
    {
        return [
            self::STATUS_ACTIVE,
            self::STATUS_SUSPENDED,
            self::STATUS_BANNED,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Role Helpers
    |--------------------------------------------------------------------------
    */

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isManager(): bool
    {
        return $this->role === self::ROLE_MANAGER;
    }

    public function isCustomer(): bool
    {
        return $this->role === self::ROLE_CUSTOMER;
    }

    public function hasRole(string $role): bool
    {
        return $this->role === $role;
    }

    /*
    |--------------------------------------------------------------------------
    | Status Helpers
    |--------------------------------------------------------------------------
    */

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isSuspended(): bool
    {
        return $this->status === self::STATUS_SUSPENDED && !$this->hasExpiredSuspension();
    }

    public function isBanned(): bool
    {
        return $this->status === self::STATUS_BANNED;
    }

    public function isBlocked(): bool
    {
        return $this->isSuspended() || $this->isBanned();
    }

    public function hasExpiredSuspension(): bool
    {
        return $this->status === self::STATUS_SUSPENDED
            && $this->suspended_until !== null
            && $this->suspended_until->isPast();
    }

    public function syncStatusIfSuspensionExpired(): bool
    {
        if (!$this->hasExpiredSuspension()) {
            return false;
        }

        $this->forceFill([
            'status' => self::STATUS_ACTIVE,
            'suspended_until' => null,
            'banned_at' => null,
            'ban_reason' => null,
            'banned_by' => null,
        ])->save();

        $this->refresh();

        return true;
    }

    public function suspensionEndsAtForHumans(?string $fallback = null): ?string
    {
        if (!$this->suspended_until) {
            return $fallback;
        }

        return $this->suspended_until->format('d/m/Y H:i');
    }

    /*
    |--------------------------------------------------------------------------
    | Moderation Relations
    |--------------------------------------------------------------------------
    */

    public function bannedByUser(): BelongsTo
    {
        return $this->belongsTo(self::class, 'banned_by');
    }

    /*
    |--------------------------------------------------------------------------
    | Domain Relations
    |--------------------------------------------------------------------------
    */

    public function wishlistItems(): HasMany
    {
        return $this->hasMany(WishlistItem::class);
    }

    public function productReviews(): HasMany
    {
        return $this->hasMany(\App\Models\ProductReview::class);
    }
}
