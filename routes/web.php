<?php

use App\Http\Controllers\Admin\AnalyticsController as AdminAnalyticsController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\Manager\CategoryController as ManagerCategoryController;
use App\Http\Controllers\Manager\InventoryController;
use App\Http\Controllers\Manager\OrderCancellationController;
use App\Http\Controllers\Manager\ProductController as ManagerProductController;
use App\Http\Controllers\Manager\ProductImageController as ManagerProductImageController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PanelController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Shop\CategoryController as ShopCategoryController;
use App\Http\Controllers\Shop\ProductController as ShopProductController;
use App\Http\Controllers\Shop\ShopController;
use App\Http\Controllers\Admin\OrderStatusController;
use App\Http\Controllers\Wishlist\WishlistController;
use App\Http\Controllers\Wishlist\WishlistItemController;
use App\Http\Controllers\Shop\ProductReviewController;
use App\Http\Controllers\CheckoutCouponController;
use App\Http\Controllers\Admin\CouponController;
use App\Http\Controllers\Admin\RefundController;
use App\Http\Controllers\Admin\ReturnController as AdminReturnController;
use App\Http\Controllers\Admin\RefundManagementController;
use App\Http\Controllers\Admin\ReturnManagementController;
use App\Http\Controllers\Shop\SearchController;
use App\Http\Controllers\Admin\OrderShipmentController;
use App\Http\Controllers\CheckoutShippingQuoteController;
use App\Http\Controllers\Manager\AttributeController;
use App\Http\Controllers\Manager\AttributeValueController;
use App\Http\Controllers\Payments\IfthenpayCallbackController;
use App\Http\Controllers\DonationController;
use App\Models\Product;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// CALLBACK IFTHENPAY (SEM LOCALE, SEM AUTH)
Route::match(['get', 'post'], '/payments/ifthenpay/callback', IfthenpayCallbackController::class)
    ->name('payments.ifthenpay.callback');

Route::get('/', function () {
    $supported = config('app.supported_locales', ['pt', 'en']);
    $fallback = config('app.fallback_locale', 'pt');

    $cookieLocale = request()->cookie('locale');
    if ($cookieLocale && in_array($cookieLocale, $supported, true)) {
        return redirect()->to("/{$cookieLocale}");
    }

    $accept = strtolower(request()->header('accept-language', ''));
    $detected = substr($accept, 0, 2);
    $locale = in_array($detected, $supported, true) ? $detected : $fallback;

    cookie()->queue(cookie('locale', $locale, 60 * 24 * 365));

    return redirect()->to("/{$locale}");
});

Route::group([
    'prefix' => '{locale}',
    'where' => [
        'locale' => implode('|', config('app.supported_locales', ['pt', 'en'])),
    ],
    'middleware' => ['setlocale'],
], function () {
    /**
     * HOME do site (por locale) -> Loja
     * /pt => /pt/shop
     * /en => /en/shop
     */
    Route::get('/', function (string $locale) {
        return redirect()->route('shop.index', ['locale' => $locale]);
    })->name('home');

    /*
    |--------------------------------------------------------------------------
    | Shop (Front Office)
    |--------------------------------------------------------------------------
    */
    Route::get('/shop', [ShopController::class, 'index'])->name('shop.index');

    Route::get('/shop/products/{product}', [ShopProductController::class, 'show'])
        ->middleware('slug.redirect:product,product')
        ->name('shop.products.show');

    Route::get('/shop/c/{category}', [ShopCategoryController::class, 'show'])
        ->middleware('slug.redirect:category,category')
        ->name('shop.categories.show');

    Route::get('/search', [\App\Http\Controllers\Shop\SearchController::class, 'index'])
    ->name('shop.search');

    /*
    |--------------------------------------------------------------------------
    | Donations
    |--------------------------------------------------------------------------
    */
    Route::get('/donativos', function () {
        return Inertia::render('Donations');
    })->name('donations');

    Route::post('/donativos', [DonationController::class, 'store'])
        ->name('donations.store');

    Route::get('/donativos/{donation}/obrigado', [DonationController::class, 'thankYou'])
        ->name('donations.thankyou');

    Route::get('/donativos/{donation}/comprovativo', [DonationController::class, 'receipt'])
        ->name('donations.receipt');
    /*
    |--------------------------------------------------------------------------
    | Purpose Page
    |--------------------------------------------------------------------------
    */
    Route::get('/proposito', function () {
        return Inertia::render('Purpose/Index');
    })->name('purpose.index');
    /*
    |--------------------------------------------------------------------------
    | Static Pages
    |--------------------------------------------------------------------------
    */
    Route::get('/terms', function () {
        return Inertia::render('Terms');
    })->name('terms');

    Route::get('/privacy', function () {
        return Inertia::render('Privacy');
    })->name('privacy');

    Route::get('/faq', function () {
        return Inertia::render('Faq');
    })->name('faq');

    Route::get('/disputes', function () {
        return Inertia::render('Disputes');
    })->name('disputes');

    Route::get('/shipping-returns', function () {
        return Inertia::render('ShippingReturns');
    })->name('shipping_returns');
    /*
    |--------------------------------------------------------------------------
    | Manager
    |--------------------------------------------------------------------------
    */
    Route::prefix('manager')
        ->name('manager.')
        ->middleware(['auth', 'role:admin,manager'])
        ->group(function () {
            Route::get('/', function () {
                $products = Product::query()
                    ->with('inventories')
                    ->get()
                    ->map(function (Product $product) {
                        $availableStock = $product->availableStock();

                        return [
                            'available_stock' => $availableStock,
                            'is_out_of_stock' => $availableStock <= 0,
                            'is_low_stock' => $availableStock > 0 && $availableStock <= 5,
                        ];
                    });

                $inventoryCards = [
                    'out_of_stock_products' => (int) $products->filter(fn ($p) => $p['is_out_of_stock'])->count(),
                    'low_stock_products' => (int) $products->filter(fn ($p) => $p['is_low_stock'])->count(),
                    'total_units' => (int) $products->sum('available_stock'),
                ];

                return Inertia::render('Manager/Dashboard', [
                    'inventoryCards' => $inventoryCards,
                ]);
            })->name('dashboard');

            // Categories
            Route::get('/categories', [ManagerCategoryController::class, 'index'])->name('categories.index');
            Route::get('/categories/create', [ManagerCategoryController::class, 'create'])->name('categories.create');
            Route::post('/categories', [ManagerCategoryController::class, 'store'])->name('categories.store');
            Route::get('/categories/{category}/edit', [ManagerCategoryController::class, 'edit'])->name('categories.edit');
            Route::put('/categories/{category}', [ManagerCategoryController::class, 'update'])->name('categories.update');
            Route::delete('/categories/{category}', [ManagerCategoryController::class, 'destroy'])->name('categories.destroy');

            // Products
            Route::get('/products', [ManagerProductController::class, 'index'])->name('products.index');
            Route::get('/products/export', [ManagerProductController::class, 'export'])->name('products.export');
            Route::get('/products/create', [ManagerProductController::class, 'create'])->name('products.create');
            Route::post('/products', [ManagerProductController::class, 'store'])->name('products.store');
            Route::get('/products/{product}/edit', [ManagerProductController::class, 'edit'])->name('products.edit');
            Route::put('/products/{product}', [ManagerProductController::class, 'update'])->name('products.update');
            Route::delete('/products/{product}', [ManagerProductController::class, 'destroy'])->name('products.destroy');

            // Product Images
            Route::post('/products/{product}/images', [ManagerProductImageController::class, 'store'])->name('products.images.store');
            Route::patch('/products/{product}/images/{image}/main', [ManagerProductImageController::class, 'setMain'])->name('products.images.main');
            Route::patch('/products/{product}/images/reorder', [ManagerProductImageController::class, 'reorder'])->name('products.images.reorder');
            Route::patch('/products/{product}/images/{image}', [ManagerProductImageController::class, 'updateAlt'])->name('products.images.update');
            Route::delete('/products/{product}/images/{image}', [ManagerProductImageController::class, 'destroy'])->name('products.images.destroy');

            // Inventory
            Route::get('/inventories', [InventoryController::class, 'index'])->name('inventories.index');
            Route::put('/inventories/{product}', [InventoryController::class, 'update'])->name('inventories.update');

            // Attributes
            Route::get('/attributes', [AttributeController::class, 'index'])
                ->name('attributes.index');

            Route::post('/attributes', [AttributeController::class, 'store'])
                ->name('attributes.store');

            Route::put('/attributes/{attribute}', [AttributeController::class, 'update'])
                ->name('attributes.update');

            Route::delete('/attributes/{attribute}', [AttributeController::class, 'destroy'])
                ->name('attributes.destroy');

            Route::post('/attributes/{attribute}/values', [AttributeValueController::class, 'store'])
                ->name('attributes.values.store');

            Route::put('/attributes/{attribute}/values/{value}', [AttributeValueController::class, 'update'])
                ->name('attributes.values.update');

            Route::delete('/attributes/{attribute}/values/{value}', [AttributeValueController::class, 'destroy'])
                ->name('attributes.values.destroy');

            // Route::post('/orders/{order}/cancel', [OrderCancellationController::class, 'store'])->name('orders.cancel');
        });

    /*
    |--------------------------------------------------------------------------
    | Cart + Checkout + Orders
    |--------------------------------------------------------------------------
    */
    Route::middleware(['auth'])->group(function () {
        Route::get('/cart', [CartController::class, 'index'])->name('cart.index');

        Route::post('/cart/items', [CartController::class, 'store'])->name('cart.items.store');
        Route::patch('/cart/items/{item}', [CartController::class, 'update'])->name('cart.items.update');
        Route::delete('/cart/items/{item}', [CartController::class, 'destroy'])->name('cart.items.destroy');

        Route::get('/checkout', [CheckoutController::class, 'index'])->name('checkout.index');
        Route::post('/checkout', [CheckoutController::class, 'store'])->name('checkout.store');

        Route::get('/checkout/shipping/quote', CheckoutShippingQuoteController::class)->name('checkout.shipping.quote');

        Route::post('/checkout/coupon', [CheckoutCouponController::class, 'store'])->name('checkout.coupon.store');
        Route::delete('/checkout/coupon', [CheckoutCouponController::class, 'destroy'])->name('checkout.coupon.destroy');

        Route::get('/orders/{order}/thank-you', [OrderController::class, 'thankYou'])->name('orders.thankyou');

        Route::get('/dashboard', [PanelController::class, 'index'])
            ->middleware(['auth'])
            ->name('dashboard');

        Route::get('/dashboard/orders/{order}', [PanelController::class, 'show'])
            ->middleware(['auth', 'can:view,order'])
            ->name('panel.orders.show');

        Route::post('/dashboard/orders/{order}/reorder', [PanelController::class, 'reorder'])
            ->middleware(['auth', 'can:view,order'])
            ->name('panel.orders.reorder');

        Route::post('/dashboard/orders/{order}/returns', [\App\Http\Controllers\Panel\OrderReturnController::class, 'store'])
            ->middleware(['auth', 'can:view,order'])
            ->name('panel.orders.returns.store');

        Route::get('/dashboard/donations', [\App\Http\Controllers\Panel\DonationController::class, 'index'])
            ->middleware(['auth'])
            ->name('panel.donations.index');

        Route::get('/wishlist', [WishlistController::class, 'index'])->name('wishlist.index');

        Route::post('/wishlist/{product}', [WishlistItemController::class, 'store'])->name('wishlist.store');
        Route::delete('/wishlist/{product}', [WishlistItemController::class, 'destroy'])->name('wishlist.destroy');
        Route::post('/wishlist/{product}/toggle', [WishlistItemController::class, 'toggle'])->name('wishlist.toggle');

        Route::post('/products/{product}/reviews', [ProductReviewController::class, 'store'])->name('shop.reviews.store');
        Route::delete('/products/{product}/reviews', [ProductReviewController::class, 'destroy'])->name('shop.reviews.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Profile
    |--------------------------------------------------------------------------
    */
    Route::middleware(['auth'])->group(function () {
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Admin
    |--------------------------------------------------------------------------
    */
    Route::prefix('admin')
        ->name('admin.')
        ->middleware(['auth', 'role:admin'])
        ->group(function () {
            Route::get('/', [AdminDashboardController::class, 'index'])->name('dashboard');

            Route::get('/analytics', [AdminAnalyticsController::class, 'index'])->name('analytics.index');

            // Users / Roles / Status
            Route::get('/users', [UserController::class, 'index'])->name('users.index');
            Route::get('/users/export', [UserController::class, 'export'])->name('users.export');
            Route::patch('/users/{user}/role', [UserController::class, 'updateRole'])->name('users.role');
            Route::patch('/users/{user}/status', [UserController::class, 'updateStatus'])->name('users.status');

            // Orders
            Route::get('/orders', [\App\Http\Controllers\Admin\OrderController::class, 'index'])->name('orders.index');
            Route::get('/orders/export', [\App\Http\Controllers\Admin\OrderController::class, 'export'])->name('orders.export');
            Route::get('/orders/items/export', [\App\Http\Controllers\Admin\OrderController::class, 'exportItems'])->name('orders.items.export');
            Route::get('/orders/accounting/export', [\App\Http\Controllers\Admin\OrderController::class, 'exportAccounting'])->name('orders.accounting.export');
            Route::post('/orders/{order}/cancel', [OrderCancellationController::class, 'store'])->name('orders.cancel');
            Route::get('/orders/{order}', [\App\Http\Controllers\Admin\OrderController::class, 'show'])->name('orders.show');
            Route::patch('/orders/{order}/shipment', [OrderShipmentController::class, 'update'])->name('orders.shipment.update');

            Route::patch('/orders/{order}/status', [OrderStatusController::class, 'update'])->name('orders.status.update');
            Route::post('/orders/{order}/refund', [RefundController::class, 'store'])->name('orders.refunds.store');

            Route::get('/coupons', [CouponController::class, 'index'])->name('coupons.index');
            Route::get('/coupons/create', [CouponController::class, 'create'])->name('coupons.create');
            Route::post('/coupons', [CouponController::class, 'store'])->name('coupons.store');
            Route::get('/coupons/{coupon}/edit', [CouponController::class, 'edit'])->name('coupons.edit');
            Route::put('/coupons/{coupon}', [CouponController::class, 'update'])->name('coupons.update');
            Route::patch('/coupons/{coupon}/toggle', [CouponController::class, 'toggle'])->name('coupons.toggle');

            Route::post('/orders/{order}/returns', [AdminReturnController::class, 'store'])->name('orders.returns.store');
            Route::post('/orders/{order}/returns/{return}/approve', [AdminReturnController::class, 'approve'])->name('orders.returns.approve');
            Route::post('/orders/{order}/returns/{return}/reject', [AdminReturnController::class, 'reject'])->name('orders.returns.reject');
            Route::post('/orders/{order}/returns/{return}/receive', [AdminReturnController::class, 'receive'])->name('orders.returns.receive');
            Route::post('/orders/{order}/returns/{return}/exchange-ship', [AdminReturnController::class, 'exchangeShip'])->name('orders.returns.exchange_ship');
            Route::post('/orders/{order}/returns/{return}/refund', [AdminReturnController::class, 'refund'])->name('orders.returns.refund');
            Route::post('/orders/{order}/returns/{return}/close', [AdminReturnController::class, 'close'])->name('orders.returns.close');

            Route::get('/returns', [ReturnManagementController::class, 'index'])->name('returns.index');
            Route::get('/refunds', [RefundManagementController::class, 'index'])->name('refunds.index');

            Route::get('/donations', [\App\Http\Controllers\Admin\DonationController::class, 'index'])
                ->name('donations.index');

            Route::get('/donations/export', [\App\Http\Controllers\Admin\DonationController::class, 'export'])
                ->name('donations.export');
        });

    require __DIR__ . '/auth.php';

    Route::get('/oops', fn () => Inertia::render('Fallback'))->name('fallback.page');

    Route::fallback(function () {
        $locale = request()->route('locale')
            ?? request()->cookie('locale')
            ?? config('app.fallback_locale', 'pt');

        return redirect()->route('fallback.page', ['locale' => $locale]);
    });
});

Route::fallback(function () {
    $supported = config('app.supported_locales', ['pt', 'en']);
    $fallback = config('app.fallback_locale', 'pt');

    $locale = request()->cookie('locale', $fallback);

    if (!in_array($locale, $supported, true)) {
        $locale = $fallback;
    }

    return redirect()->to("/{$locale}/oops");
});
