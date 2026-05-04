<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ProductReviewService
{
    public function canReview(User $user, Product $product): bool
    {
        return Order::query()
            ->where('user_id', $user->id)
            ->whereHas('status', fn ($q) => $q->where('code', 'delivered'))
            ->whereHas('items', fn ($q) => $q->where('product_id', $product->id))
            ->exists();
    }

    public function upsertReview(
        User $user,
        Product $product,
        int $rating,
        ?string $title = null,
        ?string $body = null
    ): ProductReview {
        if (!$this->canReview($user, $product)) {
            throw ValidationException::withMessages([
                'review' => __('ui.reviews.verified_purchase_required'),
            ]);
        }

        return ProductReview::query()->updateOrCreate(
            [
                'product_id' => $product->id,
                'user_id' => $user->id,
            ],
            [
                'rating' => $rating,
                'title' => $title,
                'body' => $body,
                'is_verified_purchase' => true,
                'is_visible' => true,
            ]
        );
    }

    public function deleteReview(User $user, Product $product): void
    {
        ProductReview::query()
            ->where('product_id', $product->id)
            ->where('user_id', $user->id)
            ->delete();
    }

    public function averageRating(Product $product): ?float
    {
        $avg = ProductReview::query()
            ->where('product_id', $product->id)
            ->where('is_visible', true)
            ->avg('rating');

        return $avg !== null ? round((float) $avg, 2) : null;
    }
}
