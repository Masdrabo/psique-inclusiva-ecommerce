<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\ShippingMethod;
use App\Models\Shipment;
use App\Models\User;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PanelRefundViewTest extends TestCase
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

    public function test_dashboard_shows_partial_refund_order_for_owner(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            orderStatusCode: 'processing',
            paymentStatus: 'partially_refunded'
        );

        $this->createRefund($order, [
            ['order_item_id' => $order->items[0]->id, 'qty' => 1, 'amount' => 1000],
        ], 1000);

        $response = $this->actingAs($user)->get(route('dashboard', [
            'locale' => 'pt',
        ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('summary.total_orders', 1)
            ->where('orders.data.0.id', $order->id)
            ->where('orders.data.0.order_number', $order->order_number)
            ->where('orders.data.0.status.code', 'processing')
            ->where('orders.data.0.payment.status', 'partially_refunded')
            ->where('orders.data.0.refunded_total_amount', 1000)
            ->where('orders.data.0.remaining_refundable_amount', 7000)
        );
    }

    public function test_dashboard_shows_full_refund_order_for_owner(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            orderStatusCode: 'delivered',
            paymentStatus: 'refunded'
        );

        $this->createRefund($order, [
            ['order_item_id' => $order->items[0]->id, 'qty' => 2, 'amount' => 2000],
            ['order_item_id' => $order->items[1]->id, 'qty' => 3, 'amount' => 6000],
        ], 8000);

        $response = $this->actingAs($user)->get(route('dashboard', [
            'locale' => 'pt',
        ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('summary.total_orders', 1)
            ->where('orders.data.0.id', $order->id)
            ->where('orders.data.0.status.code', 'delivered')
            ->where('orders.data.0.payment.status', 'refunded')
            ->where('orders.data.0.refunded_total_amount', 8000)
            ->where('orders.data.0.remaining_refundable_amount', 0)
        );
    }

    public function test_order_detail_shows_refund_totals_history_and_item_quantities(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            orderStatusCode: 'shipped',
            paymentStatus: 'partially_refunded'
        );

        $refund = $this->createRefund($order, [
            ['order_item_id' => $order->items[0]->id, 'qty' => 1, 'amount' => 1000],
            ['order_item_id' => $order->items[1]->id, 'qty' => 1, 'amount' => 2000],
        ], 3000, 'Refund parcial', 'Teste painel');

        $response = $this->actingAs($user)->get(route('panel.orders.show', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Panel/OrderShow')
            ->where('order.id', $order->id)
            ->where('order.order_number', $order->order_number)
            ->where('order.status.code', 'shipped')
            ->where('order.payment.status', 'partially_refunded')
            ->where('order.amounts.total', 8000)
            ->where('order.refunded_total_amount', 3000)
            ->where('order.remaining_refundable_amount', 5000)
            ->has('order.items', 2)
            ->where('order.items.0.refunded_qty', 1)
            ->where('order.items.0.remaining_refundable_qty', 1)
            ->where('order.items.1.refunded_qty', 1)
            ->where('order.items.1.remaining_refundable_qty', 2)
            ->has('order.refunds', 1)
            ->where('order.refunds.0.id', $refund->id)
            ->where('order.refunds.0.amount', 3000)
            ->where('order.refunds.0.reason', 'Refund parcial')
            ->where('order.refunds.0.notes', 'Teste painel')
            ->has('order.refunds.0.items', 2)
        );
    }

    public function test_user_cannot_view_order_of_another_user(): void
    {
        $owner = User::factory()->create([
            'role' => 'customer',
        ]);

        $otherUser = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $owner,
            orderStatusCode: 'processing',
            paymentStatus: 'paid'
        );

        $response = $this->actingAs($otherUser)->get(route('panel.orders.show', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $response->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));
    }

    public function test_dashboard_can_filter_by_processing_even_when_payment_is_partially_refunded(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $matchingOrder = $this->makeOrderForUser(
            user: $user,
            orderStatusCode: 'processing',
            paymentStatus: 'partially_refunded'
        );

        $this->createRefund($matchingOrder, [
            ['order_item_id' => $matchingOrder->items[0]->id, 'qty' => 1, 'amount' => 1000],
        ], 1000);

        $otherOrder = $this->makeOrderForUser(
            user: $user,
            orderStatusCode: 'delivered',
            paymentStatus: 'refunded'
        );

        $this->createRefund($otherOrder, [
            ['order_item_id' => $otherOrder->items[0]->id, 'qty' => 2, 'amount' => 2000],
            ['order_item_id' => $otherOrder->items[1]->id, 'qty' => 3, 'amount' => 6000],
        ], 8000);

        $response = $this->actingAs($user)->get(route('dashboard', [
            'locale' => 'pt',
            'status' => 'processing',
        ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('filters.status', 'processing')
            ->has('orders.data', 1)
            ->where('orders.data.0.id', $matchingOrder->id)
            ->where('orders.data.0.status.code', 'processing')
            ->where('orders.data.0.payment.status', 'partially_refunded')
        );
    }

    private function makeOrderForUser(
        User $user,
        string $orderStatusCode = 'processing',
        string $paymentStatus = 'paid'
    ): Order {
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $shippingMethod = ShippingMethod::query()->where('code', 'standard')->firstOrFail();
        $status = OrderStatus::query()->where('code', $orderStatusCode)->firstOrFail();
        $ptLanguage = \App\Models\Language::query()->where('code', 'pt')->firstOrFail();

        $customer = Customer::query()->create([
            'user_id' => $user->id,
            'phone' => '910000000',
        ]);

        $productA = Product::query()->create([
            'sku' => 'PANEL-REF-A-' . strtoupper(str()->random(4)),
            'slug' => 'panel-ref-a-' . strtolower(str()->random(6)),
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => false,
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

        $productB = Product::query()->create([
            'sku' => 'PANEL-REF-B-' . strtoupper(str()->random(4)),
            'slug' => 'panel-ref-b-' . strtolower(str()->random(6)),
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => false,
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

        $order = Order::query()->create([
            'order_number' => 'ORD-PANEL-' . strtoupper(str()->random(6)),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => $user->name,
                'line1' => 'Rua Teste',
                'city' => 'Lisboa',
                'postal_code' => '1000-000',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => $user->name,
                'line1' => 'Rua Teste',
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
            'status' => $paymentStatus,
            'provider_payment_id' => null,
            'payload' => null,
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $shippingMethod->id,
            'tracking_number' => 'TRACK-' . strtoupper(str()->random(6)),
            'status' => $orderStatusCode === 'delivered'
                ? 'delivered'
                : ($orderStatusCode === 'shipped' ? 'shipped' : 'pending'),
            'shipped_at' => in_array($orderStatusCode, ['shipped', 'delivered'], true) ? now() : null,
            'delivered_at' => $orderStatusCode === 'delivered' ? now() : null,
        ]);

        return $order->fresh([
            'status',
            'currency',
            'items',
            'payment.method',
            'shipment.method',
            'refunds.items.orderItem',
        ]);
    }

    private function createRefund(
        Order $order,
        array $items,
        int $amount,
        ?string $reason = null,
        ?string $notes = null
    ): Refund {
        $refund = Refund::query()->create([
            'order_id' => $order->id,
            'payment_id' => $order->payment->id,
            'amount' => $amount,
            'reason' => $reason,
            'notes' => $notes,
            'created_by_user_id' => null,
        ]);

        foreach ($items as $item) {
            RefundItem::query()->create([
                'refund_id' => $refund->id,
                'order_item_id' => $item['order_item_id'],
                'qty' => $item['qty'],
                'amount' => $item['amount'],
            ]);
        }

        return $refund->fresh(['items.orderItem']);
    }
}
