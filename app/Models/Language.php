<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Language extends Model
{
    protected $fillable = [
        'code',
        'name',
        'is_default',
        'is_active',
    ];

    public function categoryTranslations()
    {
        return $this->hasMany(CategoryTranslation::class);
    }

    public function productTranslations()
    {
        return $this->hasMany(ProductTranslation::class);
    }
}
