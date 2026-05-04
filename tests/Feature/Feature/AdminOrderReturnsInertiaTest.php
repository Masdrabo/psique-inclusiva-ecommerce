<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\ReturnItem;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminOrderReturnsInertiaTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_order_show_exposes_returns_history_and_item_return_quantities(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $return = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-0001',
            'status' => 'received',
            'reason' => 'Cliente devolveu artigo',
            'notes' => 'Recebido no armazém',
            'requested_by_user_id' => $admin->id,
            'approved_by_user_id' => $admin->id,
            'received_by_user_id' => $admin->id,
            'requested_at' => now()->subDays(3),
            'approved_at' => now()->subDays(2),
            'received_at' => now()->subDay(),
            'closed_at' => null,
        ]);

        ReturnItem::query()->create([
            'return_id' => $return->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 1,
            'restock_qty' => 1,
            'reason' => 'Tamanho errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->update([
                'qty_on_hand' => 11,
            ]);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->where('order.id', $order->id)
                ->where('order.order_number', $order->order_number)
                ->where('order.status.code', 'delivered')
                ->where('order.payment.status', 'paid')
                ->has('order.items', 2)
                ->where('order.items.0.id', $orderItemA->id)
                ->where('order.items.0.returned_qty', 1)
                ->where('order.items.0.remaining_returnable_qty', 1)
                ->where('order.items.0.is_inventory_product', true)
                ->where('order.items.1.id', $orderItemB->id)
                ->where('order.items.1.returned_qty', 0)
                ->where('order.items.1.remaining_returnable_qty', 2)
                ->where('order.items.1.is_inventory_product', false)
                ->has('order.returns', 1)
                ->where('order.returns.0.id', $return->id)
                ->where('order.returns.0.return_number', 'RET-0001')
                ->where('order.returns.0.status', 'received')
                ->where('order.returns.0.reason', 'Cliente devolveu artigo')
                ->where('order.returns.0.notes', 'Recebido no armazém')
                ->where('order.returns.0.requested_by.name', $admin->name)
                ->where('order.returns.0.approved_by.name', $admin->name)
                ->where('order.returns.0.received_by.name', $admin->name)
                ->has('order.returns.0.items', 1)
                ->where('order.returns.0.items.0.order_item_id', $orderItemA->id)
                ->where('order.returns.0.items.0.qty', 1)
                ->where('order.returns.0.items.0.received_qty', 1)
                ->where('order.returns.0.items.0.restock_qty', 1)
                ->where('order.returns.0.items.0.reason', 'Tamanho errado')
                ->where('order.returns.0.items.0.condition', 'opened')
                ->where('order.returns.0.items.0.resolution', 'refund')
                ->where('order.returns.0.items.0.item_name', 'Produto A')
                ->where('order.returns.0.items.0.item_sku', 'PROD-A')
                ->where('order.returns.0.items.0.is_inventory_product', true)
            );
    }

    public function test_admin_order_show_exposes_empty_returns_array_when_order_has_no_returns(): void
    {
        [$admin, $order, $orderItemA, $orderItemB] = $this->makeOrderFixture();

        $this->actingAs($admin)
            ->get(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->where('order.id', $order->id)
                ->has('order.items', 2)
                ->where('order.items.0.returned_qty', 0)
                ->where('order.items.0.remaining_returnable_qty', 2)
                ->where('order.items.1.returned_qty', 0)
                ->where('order.items.1.remaining_returnable_qty', 2)
                ->has('order.returns', 0)
            );
    }

    public function test_admin_order_show_exposes_multiple_returns_in_desc_order(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $olderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-0001',
            'status' => 'approved',
            'reason' => 'Primeira devolução',
            'notes' => 'Primeiro registo',
            'requested_by_user_id' => $admin->id,
            'approved_by_user_id' => $admin->id,
            'received_by_user_id' => null,
            'requested_at' => now()->subDays(5),
            'approved_at' => now()->subDays(4),
            'received_at' => null,
            'closed_at' => null,
        ]);

        ReturnItem::query()->create([
            'return_id' => $olderReturn->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Primeiro motivo',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $newerReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-0002',
            'status' => 'requested',
            'reason' => 'Segunda devolução',
            'notes' => 'Segundo registo',
            'requested_by_user_id' => $admin->id,
            'approved_by_user_id' => null,
            'received_by_user_id' => null,
            'requested_at' => now()->subDay(),
            'approved_at' => null,
            'received_at' => null,
            'closed_at' => null,
        ]);

        ReturnItem::query()->create([
            'return_id' => $newerReturn->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Segundo motivo',
            'condition' => 'sealed',
            'resolution' => 'exchange',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->has('order.returns', 2)
                ->where('order.returns.0.id', $newerReturn->id)
                ->where('order.returns.0.return_number', 'RET-0002')
                ->where('order.returns.0.status', 'requested')
                ->where('order.returns.1.id', $olderReturn->id)
                ->where('order.returns.1.return_number', 'RET-0001')
                ->where('order.returns.1.status', 'approved')
            );
    }

    public function test_admin_order_show_keeps_refunds_and_returns_separated(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $return = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-0001',
            'status' => 'requested',
            'reason' => 'Devolução separada',
            'notes' => 'Não é refund',
            'requested_by_user_id' => $admin->id,
            'approved_by_user_id' => null,
            'received_by_user_id' => null,
            'requested_at' => now(),
            'approved_at' => null,
            'received_at' => null,
            'closed_at' => null,
        ]);

        ReturnItem::query()->create([
            'return_id' => $return->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Motivo devolução',
            'condition' => 'opened',
            'resolution' => 'exchange',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->has('order.refunds', 0)
                ->has('order.returns', 1)
                ->where('order.returns.0.status', 'requested')
            );
    }

    public function test_customer_cannot_access_admin_order_show_for_returns_ui(): void
    {
        [$admin, $order] = $this->makeOrderFixture();

        $customer = User::factory()->create([
            'role' => 'customer',
        ]);

        $this->actingAs($customer)
            ->get(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->assertRedirect(route('fallback.page', [
                'locale' => 'pt',
            ]));
    }

    private function makeOrderFixture(): array
    {
        $this->seedLanguages();
        $currency = $this->seedCurrency();
        $warehouse = $this->seedWarehouse();
        $status = $this->seedOrderStatus('delivered', 'Entregue');

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

        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $customerUser = User::factory()->create([
            'role' => 'customer',
        ]);

        $customer = Customer::query()->create([
            'user_id' => $customerUser->id,
        ]);

        $productA = Product::query()->create([
            'sku' => 'PROD-A',
            'slug' => 'produto-a',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $productB = Product::query()->create([
            'sku' => 'PROD-B',
            'slug' => 'produto-b',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => false,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();

        foreach ([$pt, $en] as $language) {
            ProductTranslation::query()->create([
                'product_id' => $productA->id,
                'language_id' => $language->id,
                'name' => 'Produto A',
                'description' => 'Produto A',
                'meta_title' => 'Produto A',
                'meta_description' => 'Produto A',
                'is_machine_translated' => false,
            ]);

            ProductTranslation::query()->create([
                'product_id' => $productB->id,
                'language_id' => $language->id,
                'name' => 'Produto B',
                'description' => 'Produto B',
                'meta_title' => 'Produto B',
                'meta_description' => 'Produto B',
                'is_machine_translated' => false,
            ]);
        }

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'qty_on_hand' => 10,
            'qty_reserved' => 0,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-RET-UI-0001',
            'user_id' => $customerUser->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente UI',
                'line1' => 'Rua UI',
                'city' => 'Braga',
                'postal_code' => '4700-001',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Cliente UI',
                'line1' => 'Rua UI',
                'city' => 'Braga',
                'postal_code' => '4700-001',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 8000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 8000,
            'paid_at' => now(),
        ]);

        $orderItemA = OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'name' => 'Produto A',
            'sku' => 'PROD-A',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => [
                'business_type' => 'physical',
            ],
        ]);

        $orderItemB = OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'name' => 'Produto B',
            'sku' => 'PROD-B',
            'qty' => 2,
            'unit_amount' => 3000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 6000,
            'meta' => [
                'business_type' => 'physical',
            ],
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 8000,
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $shippingMethod->id,
            'status' => 'delivered',
            'shipped_at' => now()->subDay(),
            'delivered_at' => now(),
        ]);

        return [$admin, $order, $orderItemA, $orderItemB, $productA, $productB];
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
