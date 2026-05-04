<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductReviewRequest;
use App\Models\Product;
use App\Services\ProductReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ProductReviewController extends Controller
{
    public function store(
        string $locale,
        StoreProductReviewRequest $request,
        Product $product,
        ProductReviewService $productReviewService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $productReviewService->upsertReview(
            user: $user,
            product: $product,
            rating: (int) $request->integer('rating'),
            title: $request->input('title'),
            body: $request->input('body')
        );

        return back()->with('success', __('ui.reviews.saved'));
    }

    public function destroy(
        string $locale,
        Request $request,
        Product $product,
        ProductReviewService $productReviewService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $productReviewService->deleteReview($user, $product);

        return back()->with('success', __('ui.reviews.deleted'));
    }
}
