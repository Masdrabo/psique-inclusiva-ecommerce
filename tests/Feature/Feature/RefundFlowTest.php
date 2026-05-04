<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\Refund;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(EcommerceBaseSeeder::class);

        OrderStatus::query()->firstOrCreate(
            ['code' => 'partially_refunded'],
            ['name' => 'Parcialmente reembolsada']
        );

        OrderStatus::query()->firstOrCreate(
            ['code' => 'refunded'],
            ['name' => 'Reembolsada']
        );
    }

    public function test_admin_can_create_partial_refund_and_keep_inventory_unchanged(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $order = $this->makePaidOrderWithTwoInventoryItems(statusCode: 'processing');

        $itemA = $order->items()->where('sku', 'REF-A')->firstOrFail();
        $itemB = $order->items()->where('sku', 'REF-B')->firstOrFail();

        $inventoryA = Inventory::query()->where('product_id', $itemA->product_id)->firstOrFail();
        $inventoryB = Inventory::query()->where('product_id', $itemB->product_id)->firstOrFail();

        $this->assertSame(8, (int) $inventoryA->qty_on_hand);
        $this->assertSame(7, (int) $inventoryB->qty_on_hand);

        $response = $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Cliente desistiu de 1 unidade',
            'notes' => 'Refund parcial de teste',
            'items' => [
                [
                    'order_item_id' => $itemA->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $response->assertRedirect();

        $order->refresh();
        $order->load(['payment', 'refunds', 'items.refundItems', 'status']);

        $inventoryA->refresh();
        $inventoryB->refresh();

        $this->assertDatabaseCount('refunds', 1);
        $this->assertDatabaseHas('refunds', [
            'order_id' => $order->id,
            'amount' => 1000,
            'reason' => 'Cliente desistiu de 1 unidade',
        ]);

        $refund = Refund::query()->where('order_id', $order->id)->firstOrFail();

        $this->assertDatabaseHas('refund_items', [
            'refund_id' => $refund->id,
            'order_item_id' => $itemA->id,
            'qty' => 1,
            'amount' => 1000,
        ]);

        $this->assertSame('partially_refunded', $order->payment?->status);
        $this->assertSame('processing', $order->status?->code);

        $this->assertSame(8, (int) $inventoryA->qty_on_hand);
        $this->assertSame(7, (int) $inventoryB->qty_on_hand);

        $this->assertSame(1, (int) $itemA->refundItems->sum('qty'));
        $this->assertSame(0, (int) $itemB->refundItems->sum('qty'));
    }

    public function test_admin_can_create_full_refund_and_mark_order_as_refunded(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $order = $this->makePaidOrderWithTwoInventoryItems(statusCode: 'delivered');

        $itemA = $order->items()->where('sku', 'REF-A')->firstOrFail();
        $itemB = $order->items()->where('sku', 'REF-B')->firstOrFail();

        $inventoryA = Inventory::query()->where('product_id', $itemA->product_id)->firstOrFail();
        $inventoryB = Inventory::query()->where('product_id', $itemB->product_id)->firstOrFail();

        $this->assertSame(8, (int) $inventoryA->qty_on_hand);
        $this->assertSame(7, (int) $inventoryB->qty_on_hand);

        $response = $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Refund total',
            'notes' => 'Teste full refund',
            'items' => [
                [
                    'order_item_id' => $itemA->id,
                    'qty' => 2,
                ],
                [
                    'order_item_id' => $itemB->id,
                    'qty' => 3,
                ],
            ],
        ]);

        $response->assertRedirect();

        $order->refresh();
        $order->load(['payment', 'refunds', 'status']);

        $inventoryA->refresh();
        $inventoryB->refresh();

        $this->assertDatabaseHas('refunds', [
            'order_id' => $order->id,
            'amount' => 8000,
        ]);

        $this->assertSame('refunded', $order->payment?->status);
        $this->assertSame('refunded', $order->status?->code);

        $this->assertSame(8, (int) $inventoryA->qty_on_hand);
        $this->assertSame(7, (int) $inventoryB->qty_on_hand);
    }

    public function test_admin_cannot_refund_more_than_remaining_qty(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $order = $this->makePaidOrderWithTwoInventoryItems(statusCode: 'processing');

        $itemA = $order->items()->where('sku', 'REF-A')->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Primeiro refund',
            'items' => [
                [
                    'order_item_id' => $itemA->id,
                    'qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->post(route('admin.orders.refunds.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'idempotency_key' => (string) Str::uuid(),
                'reason' => 'Refund inválido',
                'items' => [
                    [
                        'order_item_id' => $itemA->id,
                        'qty' => 2,
                    ],
                ],
            ]);

        $response->assertRedirect(route('admin.orders.show', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $response->assertSessionHasErrors('refund');

        $this->assertDatabaseCount('refunds', 1);
        $this->assertDatabaseCount('refund_items', 1);
    }

    public function test_customer_cannot_access_admin_refund_route(): void
    {
        $customerUser = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makePaidOrderWithTwoInventoryItems(statusCode: 'processing');
        $itemA = $order->items()->where('sku', 'REF-A')->firstOrFail();

        $response = $this->actingAs($customerUser)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Não devia entrar',
            'items' => [
                [
                    'order_item_id' => $itemA->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $response->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));
    }

    private function makePaidOrderWithTwoInventoryItems(string $statusCode = 'processing'): Order
    {
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();
        $warehouse = Warehouse::query()->where('is_default', true)->firstOrFail();
        $status = OrderStatus::query()->where('code', $statusCode)->firstOrFail();
        $ptLanguage = \App\Models\Language::query()->where('code', 'pt')->firstOrFail();

        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $customer = Customer::query()->create([
            'user_id' => $user->id,
            'phone' => '910000000',
        ]);

        $productA = Product::query()->create([
            'sku' => 'REF-A',
            'slug' => 'refund-a',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $productA->id,
            'language_id' => $ptLanguage->id,
            'name' => 'Produto A',
            'description' => 'Produto A',
            'meta_title' => 'Produto A',
            'meta_description' => 'Produto A',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'currency_id' => $currency->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'amount' => 1000,
            'compare_at_amount' => null,
        ]);

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'qty_on_hand' => 8,
            'qty_reserved' => 0,
        ]);

        $productB = Product::query()->create([
            'sku' => 'REF-B',
            'slug' => 'refund-b',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $productB->id,
            'language_id' => $ptLanguage->id,
            'name' => 'Produto B',
            'description' => 'Produto B',
            'meta_title' => 'Produto B',
            'meta_description' => 'Produto B',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'currency_id' => $currency->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'amount' => 2000,
            'compare_at_amount' => null,
        ]);

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'qty_on_hand' => 7,
            'qty_reserved' => 0,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-REF-' . strtoupper(str()->random(6)),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua A',
                'city' => 'Lisboa',
                'postal_code' => '1000-000',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua A',
                'city' => 'Lisboa',
                'postal_code' => '1000-000',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 8000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 8000,
            'paid_at' => now(),
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'name' => 'Produto A',
            'sku' => 'REF-A',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => null,
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'name' => 'Produto B',
            'sku' => 'REF-B',
            'qty' => 3,
            'unit_amount' => 2000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 6000,
            'meta' => null,
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 8000,
            'status' => 'paid',
            'provider_payment_id' => null,
            'payload' => null,
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $shippingMethod->id,
            'tracking_number' => 'TRACK-' . strtoupper(str()->random(6)),
            'status' => in_array($statusCode, ['shipped', 'delivered'], true) ? $statusCode : 'pending',
            'shipped_at' => in_array($statusCode, ['shipped', 'delivered'], true) ? now() : null,
            'delivered_at' => $statusCode === 'delivered' ? now() : null,
        ]);

        return $order->fresh([
            'status',
            'payment',
            'shipment',
            'items',
        ]);
    }
}
