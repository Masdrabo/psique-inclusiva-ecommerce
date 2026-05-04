<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Currency;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.supported_locales' => ['pt', 'en'],
            'app.fallback_locale' => 'pt',
            'mail.order_notification_to' => 'admin@test.local',
            'mail.order_notification_locale' => 'pt',
            'queue.default' => 'sync',
            'mail.default' => 'array',
        ]);
    }

    public function test_checkout_is_idempotent_for_same_checkout_token(): void
    {
        Mail::fake();

        [$user, $paymentMethod, $shippingMethod, $product] = $this->makeCheckoutFixture();

        $token = '55555555-5555-4555-8555-555555555555';

        $payload = $this->checkoutPayload(
            checkoutToken: $token,
            paymentMethodId: $paymentMethod->id,
            shippingMethodId: $shippingMethod->id
        );

        $responseFirst = $this->actingAs($user)
            ->withSession(['checkout_token' => $token])
            ->post(route('checkout.store', ['locale' => 'pt']), $payload);

        $responseFirst->assertSessionDoesntHaveErrors();

        $order = Order::query()->first();

        $this->assertNotNull($order);

        $responseFirst->assertRedirect(route('orders.thankyou', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $this->assertSame($token, $order->checkout_token);
        $this->assertSame(1, Order::query()->count());
        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, Shipment::query()->count());

        $inventoryAfterFirst = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(3, (int) $inventoryAfterFirst->qty_on_hand);

        $responseSecond = $this->actingAs($user)
            ->withSession(['checkout_token' => $token])
            ->post(route('checkout.store', ['locale' => 'pt']), $payload);

        $orderAfterSecond = Order::query()->firstOrFail();

        $responseSecond->assertRedirect(route('orders.thankyou', [
            'locale' => 'pt',
            'order' => $orderAfterSecond->id,
        ]));

        $this->assertSame(1, Order::query()->count());
        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, Shipment::query()->count());
        $this->assertSame((int) $order->id, (int) $orderAfterSecond->id);

        $inventoryAfterSecond = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(3, (int) $inventoryAfterSecond->qty_on_hand);
    }

    public function test_checkout_rejects_mismatched_checkout_token(): void
    {
        Mail::fake();

        [$user, $paymentMethod, $shippingMethod, $product] = $this->makeCheckoutFixture();

        $sessionToken = (string) Str::uuid();
        $payloadToken = (string) Str::uuid();

        $payload = $this->checkoutPayload(
            checkoutToken: $payloadToken,
            paymentMethodId: $paymentMethod->id,
            shippingMethodId: $shippingMethod->id
        );

        $response = $this->actingAs($user)
            ->from(route('checkout.index', ['locale' => 'pt']))
            ->withSession(['checkout_token' => $sessionToken])
            ->post(route('checkout.store', ['locale' => 'pt']), $payload);

        $response->assertRedirect(route('checkout.index', ['locale' => 'pt']));
        $response->assertSessionHasErrors('checkout');

        $this->assertSame(0, Order::query()->count());
        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(0, Shipment::query()->count());

        $inventory = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventory->qty_on_hand);
    }

    private function makeCheckoutFixture(): array
    {
        $this->seedLanguages();
        $currency = $this->seedCurrency();
        $this->seedWarehouse();
        $this->seedOrderStatus('pending_payment', 'Aguarda pagamento');

        $paymentMethod = PaymentMethod::query()->create([
            'code' => 'mbway',
            'name' => 'MB WAY',
            'is_active' => true,
        ]);

        $shippingMethod = ShippingMethod::query()->create([
            'code' => 'ctt',
            'name' => 'CTT',
            'is_active' => true,
        ]);

        $zone = ShippingZone::query()->create([
            'code' => 'PT_CONTINENTAL',
            'name' => 'Portugal Continental',
            'country_code' => 'PT',
            'is_active' => true,
            'priority' => 1,
        ]);

        ShippingRate::query()->create([
            'shipping_zone_id' => $zone->id,
            'shipping_method_id' => $shippingMethod->id,
            'shipping_profile' => 'standard',
            'min_weight_grams' => 0,
            'max_weight_grams' => 500,
            'price_cents' => 530,
            'estimated_days_min' => 2,
            'estimated_days_max' => 5,
            'is_active' => true,
        ]);

        ShippingRate::query()->create([
            'shipping_zone_id' => $zone->id,
            'shipping_method_id' => $shippingMethod->id,
            'shipping_profile' => 'standard',
            'min_weight_grams' => 501,
            'max_weight_grams' => 2000,
            'price_cents' => 530,
            'estimated_days_min' => 2,
            'estimated_days_max' => 5,
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $product = Product::query()->create([
            'sku' => 'CHK-001',
            'slug' => 'produto-checkout',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
            'weight_grams' => 200,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();

        foreach ([$pt, $en] as $language) {
            ProductTranslation::query()->create([
                'product_id' => $product->id,
                'language_id' => $language->id,
                'name' => 'Produto Checkout',
                'description' => 'Produto Checkout',
                'meta_title' => 'Produto Checkout',
                'meta_description' => 'Produto Checkout',
                'is_machine_translated' => false,
            ]);
        }

        ProductPrice::query()->create([
            'product_id' => $product->id,
            'variant_id' => null,
            'currency_id' => $currency->id,
            'amount' => 1500,
        ]);

        $warehouse = Warehouse::query()->where('is_default', true)->firstOrFail();

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty_on_hand' => 5,
            'qty_reserved' => 0,
        ]);

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
            'unit_amount' => null,
            'meta' => [
                'business_type' => 'physical',
                'requires_shipping' => true,
                'manages_inventory' => true,
                'allow_quantity' => true,
            ],
        ]);

        return [$user, $paymentMethod, $shippingMethod, $product];
    }

    private function checkoutPayload(string $checkoutToken, int $paymentMethodId, int $shippingMethodId): array
    {
        return [
            'checkout_token' => $checkoutToken,
            'phone' => '910000000',
            'vat_number' => '123456789',
            'company_name' => 'Empresa Teste',
            'billing' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua Billing',
                'line2' => '',
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'region' => 'Porto',
                'country_code' => 'PT',
            ],
            'shipping' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua Shipping',
                'line2' => '',
                'city' => 'Porto',
                'postal_code' => '4000-002',
                'region' => 'Porto',
                'country_code' => 'PT',
                'shipping_zone_code' => 'PT_CONTINENTAL',
            ],
            'shipping_method_id' => $shippingMethodId,
            'payment_method_id' => $paymentMethodId,
            'accept_legal' => true,
        ];
    }

    private function seedLanguages(): void
    {
        Language::query()->firstOrCreate(
            ['code' => 'pt'],
            [
                'name' => 'Português',
                'is_default' => true,
                'is_active' => true,
            ]
        );

        Language::query()->firstOrCreate(
            ['code' => 'en'],
            [
                'name' => 'English',
                'is_default' => false,
                'is_active' => true,
            ]
        );
    }

    private function seedCurrency(): Currency
    {
        return Currency::query()->firstOrCreate(
            ['code' => 'EUR'],
            [
                'name' => 'Euro',
                'symbol' => '€',
                'decimal_places' => 2,
                'is_active' => true,
                'is_default' => true,
            ]
        );
    }

    private function seedWarehouse(): Warehouse
    {
        return Warehouse::query()->firstOrCreate(
            ['name' => 'Main Warehouse'],
            [
                'is_default' => true,
            ]
        );
    }

    private function seedOrderStatus(string $code, string $name): OrderStatus
    {
        return OrderStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => $name]
        );
    }
}
