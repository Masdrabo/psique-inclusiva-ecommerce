<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\Currency;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutCouponFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('queue.default', 'sync');
        config()->set('mail.default', 'array');
        config()->set('app.locale', 'pt');
        config()->set('app.fallback_locale', 'en');
        config()->set('mail.order_notification_to', 'admin@example.test');
        config()->set('mail.order_notification_locale', 'pt');

        $this->seed(EcommerceBaseSeeder::class);
    }

    public function test_user_can_apply_valid_fixed_amount_coupon_to_checkout(): void
    {
        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();

        $product = $this->createCouponProduct(
            sku: 'COUPON-001',
            priceAmount: 3000,
            qtyOnHand: 10
        );

        $this->createActiveCartWithItem(
            user: $user,
            currencyId: $currency->id,
            productId: $product->id,
            qty: 1,
            unitAmount: 3000
        );

        Coupon::query()->create([
            'code' => 'SAVE10',
            'name' => 'Save 10 EUR',
            'type' => 'fixed_amount',
            'amount' => 1000,
            'percentage' => null,
            'minimum_subtotal_amount' => 2000,
            'max_total_uses' => null,
            'max_uses_per_user' => null,
            'total_uses' => 0,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $response = $this->actingAs($user)->post(route('checkout.coupon.store', [
            'locale' => 'pt',
        ]), [
            'coupon_code' => 'save10',
        ]);

        $response->assertRedirect();

        $this->assertSame('SAVE10', session('checkout_coupon_code'));

        $checkoutResponse = $this->actingAs($user)->get(route('checkout.index', [
            'locale' => 'pt',
        ]));

        $checkoutResponse->assertOk();
        $checkoutResponse->assertInertia(fn ($page) => $page
            ->component('Checkout/Index')
            ->where('appliedCoupon.code', 'SAVE10')
            ->where('totals.subtotal', 2439)
            ->where('totals.shipping', 0)
            ->where('totals.tax', 374)
            ->where('totals.discount', 813)
            ->where('totals.total', 2000)
        );
    }

    public function test_user_cannot_apply_non_existing_coupon(): void
    {
        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();

        $product = $this->createCouponProduct(
            sku: 'COUPON-002',
            priceAmount: 2500,
            qtyOnHand: 10
        );

        $this->createActiveCartWithItem(
            user: $user,
            currencyId: $currency->id,
            productId: $product->id,
            qty: 1,
            unitAmount: 2500
        );

        $response = $this->from(route('checkout.index', ['locale' => 'pt']))
            ->actingAs($user)
            ->post(route('checkout.coupon.store', [
                'locale' => 'pt',
            ]), [
                'coupon_code' => 'NOT-FOUND',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('coupon_code');

        $this->assertNull(session('checkout_coupon_code'));
    }

    public function test_user_cannot_apply_inactive_coupon(): void
    {
        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();

        $product = $this->createCouponProduct(
            sku: 'COUPON-003',
            priceAmount: 2500,
            qtyOnHand: 10
        );

        $this->createActiveCartWithItem(
            user: $user,
            currencyId: $currency->id,
            productId: $product->id,
            qty: 1,
            unitAmount: 2500
        );

        Coupon::query()->create([
            'code' => 'OFFLINE',
            'name' => 'Inactive coupon',
            'type' => 'fixed_amount',
            'amount' => 500,
            'percentage' => null,
            'minimum_subtotal_amount' => 0,
            'max_total_uses' => null,
            'max_uses_per_user' => null,
            'total_uses' => 0,
            'is_active' => false,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $response = $this->from(route('checkout.index', ['locale' => 'pt']))
            ->actingAs($user)
            ->post(route('checkout.coupon.store', [
                'locale' => 'pt',
            ]), [
                'coupon_code' => 'OFFLINE',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('coupon_code');

        $this->assertNull(session('checkout_coupon_code'));
    }

    public function test_user_cannot_apply_coupon_when_minimum_subtotal_is_not_met(): void
    {
        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();

        $product = $this->createCouponProduct(
            sku: 'COUPON-004',
            priceAmount: 1500,
            qtyOnHand: 10
        );

        $this->createActiveCartWithItem(
            user: $user,
            currencyId: $currency->id,
            productId: $product->id,
            qty: 1,
            unitAmount: 1500
        );

        Coupon::query()->create([
            'code' => 'MIN5000',
            'name' => 'Minimum 50 EUR',
            'type' => 'fixed_amount',
            'amount' => 500,
            'percentage' => null,
            'minimum_subtotal_amount' => 5000,
            'max_total_uses' => null,
            'max_uses_per_user' => null,
            'total_uses' => 0,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $response = $this->from(route('checkout.index', ['locale' => 'pt']))
            ->actingAs($user)
            ->post(route('checkout.coupon.store', [
                'locale' => 'pt',
            ]), [
                'coupon_code' => 'MIN5000',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('coupon_code');

        $this->assertNull(session('checkout_coupon_code'));
    }

    public function test_checkout_with_percentage_coupon_persists_discount_and_redemption(): void
    {
        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        $product = $this->createCouponProduct(
            sku: 'COUPON-005',
            priceAmount: 4000,
            qtyOnHand: 10
        );

        $this->createActiveCartWithItem(
            user: $user,
            currencyId: $currency->id,
            productId: $product->id,
            qty: 2,
            unitAmount: 4000
        );

        $coupon = Coupon::query()->create([
            'code' => 'PERC25',
            'name' => '25 percent',
            'type' => 'percentage',
            'amount' => null,
            'percentage' => 25.00,
            'minimum_subtotal_amount' => 0,
            'max_total_uses' => null,
            'max_uses_per_user' => null,
            'total_uses' => 0,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $this->actingAs($user)->post(route('checkout.coupon.store', [
            'locale' => 'pt',
        ]), [
            'coupon_code' => 'PERC25',
        ])->assertRedirect();

        $checkoutPage = $this->actingAs($user)->get(route('checkout.index', [
            'locale' => 'pt',
        ]));

        $checkoutPage->assertOk();

        $checkoutToken = session('checkout_token');

        $this->assertNotNull($checkoutToken);

        $response = $this->actingAs($user)
            ->withSession([
                'checkout_token' => $checkoutToken,
                'checkout_coupon_code' => 'PERC25',
            ])
            ->post(route('checkout.store', [
                'locale' => 'pt',
            ]), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Coupons Test Lda',
                'billing' => [
                    'name' => 'Billing Test',
                    'line1' => 'Rua Billing 1',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                ],
                'shipping' => [
                    'name' => 'Shipping Test',
                    'line1' => 'Rua Shipping 1',
                    'line2' => null,
                    'city' => 'Porto',
                    'postal_code' => '4000-001',
                    'region' => 'Porto',
                    'country_code' => 'PT',
                    'shipping_zone_code' => 'PT_CONTINENTAL',
                ],
                'payment_method_id' => $paymentMethod->id,
                'shipping_method_id' => $shippingMethod->id,
                'accept_legal' => true,
            ]);

        $response->assertSessionDoesntHaveErrors();

        $order = Order::query()->latest('id')->first();

        $this->assertNotNull($order);

        $response->assertRedirect(route('orders.thankyou', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $this->assertSame($coupon->id, $order->coupon_id);
        $this->assertSame('PERC25', $order->coupon_code);
        $this->assertSame(6504, (int) $order->subtotal_amount);
        $this->assertSame(1626, (int) $order->discount_amount);
        $this->assertSame(1122, (int) $order->tax_amount);
        $this->assertGreaterThanOrEqual(0, (int) $order->shipping_amount);
        $this->assertSame(
            (int) $order->subtotal_amount + (int) $order->shipping_amount + (int) $order->tax_amount - (int) $order->discount_amount,
            (int) $order->total_amount
        );

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'coupon_id' => $coupon->id,
            'coupon_code' => 'PERC25',
            'subtotal_amount' => 6504,
            'discount_amount' => 1626,
            'tax_amount' => 1122,
        ]);

        $this->assertDatabaseHas('coupon_redemptions', [
            'coupon_id' => $coupon->id,
            'order_id' => $order->id,
            'user_id' => $user->id,
            'coupon_code' => 'PERC25',
            'discount_amount' => 1626,
        ]);

        $coupon->refresh();
        $this->assertSame(1, (int) $coupon->total_uses);

        $this->assertNull(session('checkout_coupon_code'));
    }

    public function test_user_can_remove_coupon_from_checkout_session(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['checkout_coupon_code' => 'SAVE10'])
            ->delete(route('checkout.coupon.destroy', [
                'locale' => 'pt',
            ]))
            ->assertRedirect();

        $this->assertNull(session('checkout_coupon_code'));
    }

    private function createCouponProduct(
        string $sku,
        int $priceAmount,
        int $qtyOnHand
    ): Product {
        $product = Product::query()->create([
            'sku' => $sku,
            'slug' => strtolower($sku) . '-slug',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'barcode' => null,
            'weight_grams' => 200,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
            'available_from' => null,
            'available_until' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();
        $eur = Currency::query()->where('code', 'EUR')->firstOrFail();

        ProductTranslation::query()->create([
            'product_id' => $product->id,
            'language_id' => $pt->id,
            'name' => 'Produto ' . $sku,
            'description' => 'Descrição PT',
            'meta_title' => 'Meta PT',
            'meta_description' => 'Meta desc PT',
            'is_machine_translated' => false,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $product->id,
            'language_id' => $en->id,
            'name' => 'Product ' . $sku,
            'description' => 'Description EN',
            'meta_title' => 'Meta EN',
            'meta_description' => 'Meta desc EN',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'currency_id' => $eur->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'amount' => $priceAmount,
            'compare_at_amount' => null,
        ]);

        $warehouse = Warehouse::query()->where('is_default', true)->firstOrFail();

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty_on_hand' => $qtyOnHand,
            'qty_reserved' => 0,
        ]);

        return $product->fresh([
            'translations',
            'prices.currency',
            'inventories',
        ]);
    }

    private function createActiveCartWithItem(
        User $user,
        int $currencyId,
        int $productId,
        int $qty,
        int $unitAmount
    ): Cart {
        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currencyId,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $productId,
            'variant_id' => null,
            'qty' => $qty,
            'unit_amount' => $unitAmount,
            'meta' => null,
        ]);

        return $cart;
    }
}
