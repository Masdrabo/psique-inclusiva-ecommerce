<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Category extends Model
{
    protected $fillable = [
        'parent_id',
        'slug',
        'image',
        'is_active',
        'position',
    ];

    public function translations()
    {
        return $this->hasMany(CategoryTranslation::class);
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'category_product');
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function slugRedirects(): MorphMany
    {
        return $this->morphMany(SlugRedirect::class, 'redirectable');
    }

    public function imageUrl(): ?string
    {
        if (!$this->image) {
            return null;
        }

        return asset("storage/{$this->image}");
    }

    public static function nextPositionForParent($parentId): int
    {
        $maxPosition = static::query()
            ->where('parent_id', $parentId)
            ->max('position');

        return is_null($maxPosition) ? 0 : ((int) $maxPosition + 1);
    }
}
