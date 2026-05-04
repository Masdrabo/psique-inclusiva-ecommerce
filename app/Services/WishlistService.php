<?php

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use App\Models\WishlistItem;

class WishlistService
{
    public function add(User $user, Product $product): WishlistItem
    {
        return WishlistItem::query()->firstOrCreate([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);
    }

    public function remove(User $user, Product $product): void
    {
        WishlistItem::query()
            ->where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->delete();
    }

    public function has(User $user, Product $product): bool
    {
        return WishlistItem::query()
            ->where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->exists();
    }

    public function toggle(User $user, Product $product): bool
    {
        $existing = WishlistItem::query()
            ->where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->first();

        if ($existing) {
            $existing->delete();
            return false;
        }

        WishlistItem::query()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        return true;
    }
}
