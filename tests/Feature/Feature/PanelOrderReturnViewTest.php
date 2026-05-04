<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PanelOrderReturnViewTest extends TestCase
{
    use RefreshDatabase;

    protected Currency $currency;
    protected Language $languagePt;
    protected OrderStatus $statusPendingPayment;
    protected OrderStatus $statusPaid;
    protected OrderStatus $statusProcessing;
    protected OrderStatus $statusShipped;
    protected OrderStatus $statusDelivered;
    protected PaymentMethod $paymentMethod;
    protected ShippingMethod $shippingMethod;

    protected function setUp(): void
    {
        parent::setUp();

        $this->currency = Currency::query()->create([
            'code' => 'EUR',
            'symbol' => '€',
            'decimal_places' => 2,
            'is_active' => true,
            'is_default' => true,
        ]);

        $this->languagePt = Language::query()->create([
            'code' => 'pt',
            'name' => 'Português',
            'is_active' => true,
        ]);

        $this->statusPendingPayment = OrderStatus::query()->create([
            'code' => 'pending_payment',
            'name' => 'A aguardar pagamento',
        ]);

        $this->statusPaid = OrderStatus::query()->create([
            'code' => 'paid',
            'name' => 'Pago',
        ]);

        $this->statusProcessing = OrderStatus::query()->create([
            'code' => 'processing',
            'name' => 'Em processamento',
        ]);

        $this->statusShipped = OrderStatus::query()->create([
            'code' => 'shipped',
            'name' => 'Enviado',
        ]);

        $this->statusDelivered = OrderStatus::query()->create([
            'code' => 'delivered',
            'name' => 'Entregue',
        ]);

        $this->paymentMethod = PaymentMethod::query()->create([
            'code' => 'manual',
            'name' => 'Manual',
            'is_active' => true,
        ]);

        $this->shippingMethod = ShippingMethod::query()->create([
            'code' => 'standard',
            'name' => 'Standard',
            'is_active' => true,
        ]);
    }

    public function test_dashboard_shows_order_with_open_returns_for_owner(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusShipped,
            paymentStatus: 'paid'
        );

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000001',
            'status' => 'requested',
            'reason' => 'Produto errado',
            'notes' => 'Preciso devolver',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $order->items()->first()->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Produto errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('dashboard', ['locale' => 'pt']));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('summary.total_orders', 1)
            ->where('orders.data.0.id', $order->id)
            ->where('orders.data.0.order_number', $order->order_number)
            ->where('orders.data.0.status.code', 'shipped')
            ->where('orders.data.0.payment.status', 'paid')
            ->where('orders.data.0.returns_count', 1)
            ->where('orders.data.0.open_returns_count', 1)
        );
    }

    public function test_dashboard_shows_order_with_closed_returns_for_owner(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000002',
            'status' => 'closed',
            'reason' => 'Não serviu',
            'notes' => 'Fechado',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDays(3),
            'approved_at' => now()->subDays(2),
            'received_at' => now()->subDay(),
            'closed_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $order->items()->first()->id,
            'qty' => 1,
            'received_qty' => 1,
            'restock_qty' => 1,
            'reason' => 'Não serviu',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('dashboard', ['locale' => 'pt']));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('orders.data.0.id', $order->id)
            ->where('orders.data.0.returns_count', 1)
            ->where('orders.data.0.open_returns_count', 0)
        );
    }

    public function test_order_detail_shows_return_history_and_item_quantities(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $items = $order->items()->orderBy('id')->get();
        $itemA = $items[0];
        $itemB = $items[1];

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000003',
            'status' => 'approved',
            'reason' => 'Tamanho errado',
            'notes' => 'A aguardar envio',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDays(2),
            'approved_at' => now()->subDay(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $itemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Tamanho errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $itemB->id,
            'qty' => 2,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Defeito',
            'condition' => 'damaged',
            'resolution' => 'inspection',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('panel.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Panel/OrderShow')
            ->where('order.id', $order->id)
            ->where('order.order_number', $order->order_number)
            ->where('order.status.code', 'delivered')
            ->where('order.payment.status', 'paid')
            ->where('order.can_request_return', true)
            ->has('order.items', 2)
            ->where('order.items.0.returned_qty', 1)
            ->where('order.items.0.remaining_returnable_qty', 1)
            ->where('order.items.1.returned_qty', 2)
            ->where('order.items.1.remaining_returnable_qty', 0)
            ->has('order.returns', 1)
            ->where('order.returns.0.return_number', 'RET-000003')
            ->where('order.returns.0.status', 'approved')
            ->where('order.returns.0.reason', 'Tamanho errado')
            ->has('order.returns.0.items', 2)
            ->where('order.returns.0.items.0.qty', 1)
            ->where('order.returns.0.items.0.resolution', 'refund')
            ->where('order.returns.0.items.1.qty', 2)
            ->where('order.returns.0.items.1.resolution', 'inspection')
        );
    }

    public function test_user_can_create_return_request_from_panel_order_show(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $item = $order->items()->orderBy('id')->first();

        $response = $this
            ->actingAs($user)
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Quero devolver',
                'notes' => 'Pedido feito pelo cliente',
                'items' => [
                    [
                        'order_item_id' => $item->id,
                        'qty' => 1,
                        'reason' => 'Não serve',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseCount('returns', 1);
        $this->assertDatabaseHas('returns', [
            'order_id' => $order->id,
            'status' => 'requested',
            'reason' => 'Quero devolver',
            'requested_by_user_id' => $user->id,
        ]);

        $orderReturn = OrderReturn::query()->first();

        $this->assertDatabaseHas('return_items', [
            'return_id' => $orderReturn->id,
            'order_item_id' => $item->id,
            'qty' => 1,
            'reason' => 'Não serve',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);
    }

    public function test_user_cannot_create_return_request_above_remaining_qty(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $item = $order->items()->orderBy('id')->first();

        $existingReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000004',
            'status' => 'requested',
            'reason' => 'Primeira devolução',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $existingReturn->id,
            'order_item_id' => $item->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Primeira',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($user)
            ->from(route('panel.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Segunda devolução',
                'notes' => 'A tentar devolver a mais',
                'items' => [
                    [
                        'order_item_id' => $item->id,
                        'qty' => 2,
                        'reason' => 'Demasiado',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect(route('panel.orders.show', [
            'locale' => 'pt',
            'order' => $order->id,
        ]));

        $response->assertSessionHasErrors();

        $this->assertDatabaseCount('returns', 1);
        $this->assertDatabaseCount('return_items', 1);
    }

    public function test_user_cannot_view_order_of_another_user_when_returns_exist(): void
    {
        $owner = User::factory()->create([
            'role' => 'customer',
        ]);

        $intruder = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $owner,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000005',
            'status' => 'requested',
            'reason' => 'Pedido do dono',
            'requested_by_user_id' => $owner->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $order->items()->first()->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Pedido do dono',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($intruder)
            ->get(route('panel.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]));

        $response->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));
    }

    public function test_dashboard_can_filter_by_delivered_and_still_show_return_counters(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $deliveredOrder = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'paid'
        );

        $processingOrder = $this->makeOrderForUser(
            user: $user,
            status: $this->statusProcessing,
            paymentStatus: 'paid'
        );

        $return = OrderReturn::query()->create([
            'order_id' => $deliveredOrder->id,
            'return_number' => 'RET-000006',
            'status' => 'requested',
            'reason' => 'Filtro',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $return->id,
            'order_item_id' => $deliveredOrder->items()->first()->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Filtro',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('dashboard', [
                'locale' => 'pt',
                'status' => 'delivered',
            ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('filters.status', 'delivered')
            ->has('orders.data', 1)
            ->where('orders.data.0.id', $deliveredOrder->id)
            ->where('orders.data.0.status.code', 'delivered')
            ->where('orders.data.0.returns_count', 1)
            ->where('orders.data.0.open_returns_count', 1)
        );

        $this->assertNotEquals($deliveredOrder->id, $processingOrder->id);
    }

    public function test_order_detail_keeps_returns_and_refunds_separated(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $order = $this->makeOrderForUser(
            user: $user,
            status: $this->statusDelivered,
            paymentStatus: 'partially_refunded'
        );

        $item = $order->items()->orderBy('id')->first();

        $refund = Refund::query()->create([
            'order_id' => $order->id,
            'payment_id' => $order->payment->id,
            'amount' => 1000,
            'reason' => 'Refund separado',
            'notes' => 'Refund test',
            'created_by_user_id' => $user->id,
        ]);

        RefundItem::query()->create([
            'refund_id' => $refund->id,
            'order_item_id' => $item->id,
            'qty' => 1,
            'amount' => 1000,
        ]);

        $return = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-000007',
            'status' => 'requested',
            'reason' => 'Return separado',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $return->id,
            'order_item_id' => $item->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Return separado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('panel.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Panel/OrderShow')
            ->has('order.refunds', 1)
            ->has('order.returns', 1)
            ->where('order.refunds.0.reason', 'Refund separado')
            ->where('order.returns.0.reason', 'Return separado')
        );
    }

    private function insertReturnItem(array $data): void
    {
        DB::table('return_items')->insert([
            'return_id' => $data['return_id'],
            'order_item_id' => $data['order_item_id'],
            'qty' => $data['qty'],
            'received_qty' => $data['received_qty'] ?? 0,
            'restock_qty' => $data['restock_qty'] ?? 0,
            'reason' => $data['reason'] ?? null,
            'condition' => $data['condition'] ?? null,
            'resolution' => $data['resolution'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeOrderForUser(User $user, OrderStatus $status, string $paymentStatus = 'paid'): Order
    {
        $customer = Customer::query()->create([
            'user_id' => $user->id,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-' . strtoupper(substr(md5((string) mt_rand()), 0, 10)),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $this->currency->id,
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
                'line1' => 'Rua B',
                'city' => 'Porto',
                'postal_code' => '4000-000',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 8000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 8000,
            'paid_at' => now(),
        ]);

        $productA = Product::query()->create([
            'sku' => 'SKU-A-' . $order->id . '-' . mt_rand(100, 999),
            'slug' => 'produto-a-' . $order->id . '-' . mt_rand(100, 999),
            'is_active' => true,
            'requires_shipping' => true,
            'business_type' => 'physical',
            'manages_inventory' => true,
            'allow_quantity' => true,
        ]);

        $productB = Product::query()->create([
            'sku' => 'SKU-B-' . $order->id . '-' . mt_rand(100, 999),
            'slug' => 'produto-b-' . $order->id . '-' . mt_rand(100, 999),
            'is_active' => true,
            'requires_shipping' => true,
            'business_type' => 'physical',
            'manages_inventory' => true,
            'allow_quantity' => true,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $productA->id,
            'language_id' => $this->languagePt->id,
            'name' => 'Produto A',
            'description' => 'Produto A',
            'meta_title' => 'Produto A',
            'meta_description' => 'Produto A',
            'is_machine_translated' => false,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $productB->id,
            'language_id' => $this->languagePt->id,
            'name' => 'Produto B',
            'description' => 'Produto B',
            'meta_title' => 'Produto B',
            'meta_description' => 'Produto B',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'product_id' => $productA->id,
            'currency_id' => $this->currency->id,
            'amount' => 1000,
        ]);

        ProductPrice::query()->create([
            'product_id' => $productB->id,
            'currency_id' => $this->currency->id,
            'amount' => 3000,
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'name' => 'Produto A',
            'sku' => 'SKU-A',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => [],
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'name' => 'Produto B',
            'sku' => 'SKU-B',
            'qty' => 2,
            'unit_amount' => 3000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 6000,
            'meta' => [],
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $this->paymentMethod->id,
            'amount' => 8000,
            'status' => $paymentStatus,
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $this->shippingMethod->id,
            'status' => $status->code === 'delivered'
                ? 'delivered'
                : ($status->code === 'shipped' ? 'shipped' : 'pending'),
            'tracking_number' => 'TRACK-' . $order->id,
            'shipped_at' => in_array($status->code, ['shipped', 'delivered'], true) ? now()->subDay() : null,
            'delivered_at' => $status->code === 'delivered' ? now() : null,
        ]);

        return $order->fresh([
            'items',
            'payment',
            'refunds',
            'returns',
        ]);
    }
}
