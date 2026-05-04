<?php

namespace App\Http\Controllers\Wishlist;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\WishlistService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class WishlistItemController extends Controller
{
    public function store(
        string $locale,
        Request $request,
        Product $product,
        WishlistService $wishlistService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $wishlistService->add($user, $product);

        return back()->with('success', __('ui.wishlist.added'));
    }

    public function destroy(
        string $locale,
        Request $request,
        Product $product,
        WishlistService $wishlistService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $wishlistService->remove($user, $product);

        return back()->with('success', __('ui.wishlist.removed'));
    }

    public function toggle(
        string $locale,
        Request $request,
        Product $product,
        WishlistService $wishlistService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $added = $wishlistService->toggle($user, $product);

        return back()->with(
            'success',
            $added ? __('ui.wishlist.added') : __('ui.wishlist.removed')
        );
    }
}
