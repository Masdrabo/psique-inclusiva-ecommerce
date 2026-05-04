<?php

namespace Tests\Feature;

use App\Mail\NewOrderAdminMail;
use App\Mail\OrderConfirmationMail;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Currency;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CheckoutFlowTest extends TestCase
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

    public function test_checkout_creates_order_payment_shipment_decrements_stock_and_queues_emails_for_physical_product(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        $product = $this->createProductForCheckout(
            sku: 'PHYS-001',
            businessType: 'physical',
            requiresShipping: true,
            managesInventory: true,
            allowQuantity: true,
            isActive: true,
            qtyOnHand: 10,
            priceAmount: 1999,
            weightGrams: 200
        );

        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty' => 2,
            'unit_amount' => 1999,
            'meta' => null,
        ]);

        $checkoutToken = '66666666-6666-4666-8666-666666666666';

        $response = $this->actingAs($user)
            ->withSession(['checkout_token' => $checkoutToken])
            ->post(route('checkout.store', ['locale' => 'pt']), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Checkout Test Lda',
                'billing' => [
                    'name' => 'Faturação Teste',
                    'line1' => 'Rua Billing 1',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                ],
                'shipping' => [
                    'name' => 'Envio Teste',
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

        $this->assertSame($user->id, $order->user_id);
        $this->assertSame('pending_payment', $order->status?->code);
        $this->assertSame($checkoutToken, $order->checkout_token);

        $this->assertSame(3250, (int) $order->subtotal_amount);
        $this->assertSame(748, (int) $order->tax_amount);
        $this->assertGreaterThan(0, (int) $order->shipping_amount);
        $this->assertSame(
            (int) $order->subtotal_amount + (int) $order->tax_amount + (int) $order->shipping_amount - (int) $order->discount_amount,
            (int) $order->total_amount
        );

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'user_id' => $user->id,
            'status_id' => $this->statusId('pending_payment'),
            'subtotal_amount' => 3250,
            'tax_amount' => 748,
            'checkout_token' => $checkoutToken,
        ]);

        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 2,
            'unit_amount' => 1999,
            'total_amount' => 3998,
            'sku' => 'PHYS-001',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => $order->total_amount,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('shipments', [
            'order_id' => $order->id,
            'shipping_method_id' => $shippingMethod->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('pending_payment'),
            'changed_by_user_id' => $user->id,
            'notes' => 'Encomenda criada no checkout.',
        ]);

        $inventory = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(8, (int) $inventory->qty_on_hand);

        $this->assertDatabaseHas('carts', [
            'id' => $cart->id,
            'status' => 'converted',
        ]);

        $this->assertDatabaseMissing('cart_items', [
            'cart_id' => $cart->id,
        ]);

        $this->assertSame(
            1,
            Cart::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->count()
        );

        Mail::assertQueued(OrderConfirmationMail::class, function (OrderConfirmationMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'pt';
        });

        Mail::assertQueued(NewOrderAdminMail::class, function (NewOrderAdminMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'pt';
        });

        Mail::assertQueuedCount(2);
    }

    public function test_checkout_without_shipping_requirement_creates_order_and_payment_but_not_shipment(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();

        $product = $this->createProductForCheckout(
            sku: 'DIGI-001',
            businessType: 'digital_service',
            requiresShipping: false,
            managesInventory: false,
            allowQuantity: true,
            isActive: true,
            qtyOnHand: null,
            priceAmount: 2500,
            weightGrams: null
        );

        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty' => 1,
            'unit_amount' => 2500,
            'meta' => null,
        ]);

        $checkoutToken = '77777777-7777-4777-8777-777777777777';

        $response = $this->actingAs($user)
            ->withSession(['checkout_token' => $checkoutToken])
            ->post(route('checkout.store', ['locale' => 'en']), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Digital Checkout Inc',
                'billing' => [
                    'name' => 'Billing Digital',
                    'line1' => 'Rua Billing 9',
                    'line2' => null,
                    'city' => 'Coimbra',
                    'postal_code' => '3000-001',
                    'region' => 'Coimbra',
                    'country_code' => 'PT',
                ],
                'payment_method_id' => $paymentMethod->id,
                'accept_legal' => true,
            ]);

        $response->assertSessionDoesntHaveErrors();

        $order = Order::query()->latest('id')->first();

        $this->assertNotNull($order);

        $response->assertRedirect(route('orders.thankyou', [
            'locale' => 'en',
            'order' => $order->id,
        ]));

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status_id' => $this->statusId('pending_payment'),
            'subtotal_amount' => 2033,
            'tax_amount' => 467,
            'shipping_amount' => 0,
            'total_amount' => 2500,
            'checkout_token' => $checkoutToken,
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 2500,
            'status' => 'pending',
        ]);

        $this->assertDatabaseMissing('shipments', [
            'order_id' => $order->id,
        ]);

        Mail::assertQueued(OrderConfirmationMail::class, function (OrderConfirmationMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'en';
        });

        Mail::assertQueued(NewOrderAdminMail::class, function (NewOrderAdminMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'pt';
        });
    }

    public function test_checkout_fails_when_stock_is_insufficient(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        $product = $this->createProductForCheckout(
            sku: 'LOW-001',
            businessType: 'physical',
            requiresShipping: true,
            managesInventory: true,
            allowQuantity: true,
            isActive: true,
            qtyOnHand: 1,
            priceAmount: 1999,
            weightGrams: 200
        );

        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty' => 2,
            'unit_amount' => 1999,
            'meta' => null,
        ]);

        $checkoutToken = '88888888-8888-4888-8888-888888888888';

        $response = $this->from(route('checkout.index', ['locale' => 'pt']))
            ->actingAs($user)
            ->withSession(['checkout_token' => $checkoutToken])
            ->post(route('checkout.store', ['locale' => 'pt']), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Failing Checkout Lda',
                'billing' => [
                    'name' => 'Billing',
                    'line1' => 'Rua Billing',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                ],
                'shipping' => [
                    'name' => 'Shipping',
                    'line1' => 'Rua Shipping',
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

        $response->assertRedirect(route('checkout.index', ['locale' => 'pt']));
        $response->assertSessionHasErrors('checkout');

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseHas('carts', [
            'id' => $cart->id,
            'status' => 'active',
        ]);

        $inventory = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(1, (int) $inventory->qty_on_hand);

        Mail::assertNothingQueued();
    }

    public function test_checkout_with_empty_cart_redirects_back_to_cart(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();

        Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        $response = $this->actingAs($user)->post(route('checkout.store', ['locale' => 'pt']), [
            'billing' => [
                'line1' => 'Rua Billing',
                'city' => 'Lisboa',
                'postal_code' => '1000-001',
                'country_code' => 'PT',
            ],
            'payment_method_id' => PaymentMethod::query()->where('code', 'manual')->firstOrFail()->id,
        ]);

        $response->assertRedirect(route('cart.index', ['locale' => 'pt']));
        $response->assertSessionHas('error', 'O carrinho está vazio.');

        $this->assertDatabaseCount('orders', 0);
        Mail::assertNothingQueued();
    }

    private function createProductForCheckout(
        string $sku,
        string $businessType,
        bool $requiresShipping,
        bool $managesInventory,
        bool $allowQuantity,
        bool $isActive,
        ?int $qtyOnHand,
        int $priceAmount,
        ?int $weightGrams = null,
    ): Product {
        $product = Product::query()->create([
            'sku' => $sku,
            'slug' => strtolower($sku) . '-slug',
            'type' => 'simple',
            'business_type' => $businessType,
            'is_active' => $isActive,
            'barcode' => null,
            'weight_grams' => $weightGrams,
            'requires_shipping' => $requiresShipping,
            'manages_inventory' => $managesInventory,
            'allow_quantity' => $allowQuantity,
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

        if ($managesInventory) {
            $warehouse = Warehouse::query()->where('is_default', true)->firstOrFail();

            Inventory::query()->create([
                'warehouse_id' => $warehouse->id,
                'product_id' => $product->id,
                'variant_id' => null,
                'qty_on_hand' => $qtyOnHand ?? 0,
                'qty_reserved' => 0,
            ]);
        }

        return $product->fresh([
            'translations',
            'prices.currency',
            'inventories',
        ]);
    }

    private function statusId(string $code): int
    {
        return (int) OrderStatus::query()
            ->where('code', $code)
            ->value('id');
    }

    public function test_checkout_with_pickup_creates_order_and_shipment_with_zero_shipping_amount(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $pickupMethod = ShippingMethod::query()->where('code', 'pickup')->firstOrFail();

        $product = $this->createProductForCheckout(
            sku: 'PICKUP-001',
            businessType: 'physical',
            requiresShipping: true,
            managesInventory: true,
            allowQuantity: true,
            isActive: true,
            qtyOnHand: 5,
            priceAmount: 1999,
            weightGrams: 200
        );

        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty' => 1,
            'unit_amount' => 1999,
            'meta' => null,
        ]);

        $checkoutToken = '99999999-9999-4999-8999-999999999999';

        $response = $this->actingAs($user)
            ->withSession(['checkout_token' => $checkoutToken])
            ->post(route('checkout.store', ['locale' => 'pt']), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Pickup Test Lda',
                'billing' => [
                    'name' => 'Faturação Pickup',
                    'line1' => 'Rua Billing 1',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                ],
                'shipping' => [
                    'name' => 'Levantamento em Loja',
                    'line1' => 'Loja',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                    'shipping_zone_code' => 'PT_CONTINENTAL',
                ],
                'payment_method_id' => $paymentMethod->id,
                'shipping_method_id' => $pickupMethod->id,
                'accept_legal' => true,
            ]);

        $response->assertSessionDoesntHaveErrors();

        $order = Order::query()->latest('id')->first();

        $this->assertNotNull($order);

        $response->assertRedirect(route('orders.thankyou', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $this->assertSame('pending_payment', $order->status?->code);
        $this->assertSame(0, (int) $order->shipping_amount);
        $this->assertSame(
            (int) $order->subtotal_amount + (int) $order->tax_amount - (int) $order->discount_amount,
            (int) $order->total_amount
        );

        $this->assertDatabaseMissing('shipments', [
            'order_id' => $order->id,
        ]);

        $inventory = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(4, (int) $inventory->qty_on_hand);

        Mail::assertQueued(OrderConfirmationMail::class, function (OrderConfirmationMail $mail) use ($order) {
            return $mail->order->id === $order->id;
        });

        Mail::assertQueued(NewOrderAdminMail::class, function (NewOrderAdminMail $mail) use ($order) {
            return $mail->order->id === $order->id;
        });
    }

    public function test_checkout_fails_when_shipping_zone_code_is_invalid(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        $product = $this->createProductForCheckout(
            sku: 'ZONE-001',
            businessType: 'physical',
            requiresShipping: true,
            managesInventory: true,
            allowQuantity: true,
            isActive: true,
            qtyOnHand: 5,
            priceAmount: 1999,
            weightGrams: 200
        );

        $cart = Cart::query()->create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'status' => 'active',
        ]);

        CartItem::query()->create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty' => 1,
            'unit_amount' => 1999,
            'meta' => null,
        ]);

        $checkoutToken = '12121212-1212-4121-8121-121212121212';

        $response = $this->from(route('checkout.index', ['locale' => 'pt']))
            ->actingAs($user)
            ->withSession(['checkout_token' => $checkoutToken])
            ->post(route('checkout.store', ['locale' => 'pt']), [
                'checkout_token' => $checkoutToken,
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Zone Test Lda',
                'billing' => [
                    'name' => 'Billing',
                    'line1' => 'Rua Billing',
                    'line2' => null,
                    'city' => 'Lisboa',
                    'postal_code' => '1000-001',
                    'region' => 'Lisboa',
                    'country_code' => 'PT',
                ],
                'shipping' => [
                    'name' => 'Shipping',
                    'line1' => 'Rua Shipping',
                    'line2' => null,
                    'city' => 'Porto',
                    'postal_code' => '4000-001',
                    'region' => 'Porto',
                    'country_code' => 'PT',
                    'shipping_zone_code' => 'INVALID_ZONE',
                ],
                'payment_method_id' => $paymentMethod->id,
                'shipping_method_id' => $shippingMethod->id,
                'accept_legal' => true,
            ]);

        $response->assertRedirect(route('checkout.index', ['locale' => 'pt']));
        $response->assertSessionHasErrors(['shipping.shipping_zone_code']);

        $this->assertDatabaseCount('orders', 0);

        $inventory = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventory->qty_on_hand);

        Mail::assertNothingQueued();
    }
}
