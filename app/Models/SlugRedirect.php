<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SlugRedirect extends Model
{
    protected $fillable = [
        'redirectable_type',
        'redirectable_id',
        'old_slug',
        'new_slug',
        'http_code',
        'created_by',
    ];

    public function redirectable(): MorphTo
    {
        return $this->morphTo();
    }
}
