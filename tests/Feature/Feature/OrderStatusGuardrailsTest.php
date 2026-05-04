<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStatusGuardrailsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_cancel_pending_payment_order_and_restore_inventory(): void
    {
        [$admin, $order, $product] = $this->makePhysicalOrderFixture(
            orderStatusCode: 'pending_payment',
            orderStatusName: 'Aguarda pagamento',
            paymentStatus: 'pending',
            createShipment: true,
            shipmentStatus: 'pending'
        );

        $inventoryBefore = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventoryBefore->qty_on_hand);

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->patch(route('admin.orders.status.update', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'status_code' => 'cancelled',
                'notes' => 'Cancelamento de teste',
            ]);

        $response->assertRedirect();

        $order->refresh();

        $this->assertSame('cancelled', $order->status->code);

        $payment = Payment::query()->where('order_id', $order->id)->firstOrFail();
        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();

        $this->assertSame('cancelled', $payment->status);
        $this->assertSame('cancelled', $shipment->status);

        $inventoryAfter = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(7, (int) $inventoryAfter->qty_on_hand);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('cancelled', 'Cancelada'),
            'changed_by_user_id' => $admin->id,
            'notes' => 'Cancelamento de teste',
        ]);
    }

    public function test_admin_cannot_cancel_paid_order_directly(): void
    {
        [$admin, $order, $product] = $this->makePhysicalOrderFixture(
            orderStatusCode: 'paid',
            orderStatusName: 'Paga',
            paymentStatus: 'paid',
            createShipment: true,
            shipmentStatus: 'pending'
        );

        $inventoryBefore = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventoryBefore->qty_on_hand);

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->patch(route('admin.orders.status.update', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'status_code' => 'cancelled',
                'notes' => 'Não devia cancelar',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('status');

        $order->refresh();

        $this->assertSame('paid', $order->status->code);

        $payment = Payment::query()->where('order_id', $order->id)->firstOrFail();
        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();

        $this->assertSame('paid', $payment->status);
        $this->assertSame('pending', $shipment->status);

        $inventoryAfter = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventoryAfter->qty_on_hand);

        $this->assertDatabaseMissing('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('cancelled', 'Cancelada'),
            'changed_by_user_id' => $admin->id,
            'notes' => 'Não devia cancelar',
        ]);
    }

    public function test_admin_cannot_cancel_processing_order_directly(): void
    {
        [$admin, $order, $product] = $this->makePhysicalOrderFixture(
            orderStatusCode: 'processing',
            orderStatusName: 'Em processamento',
            paymentStatus: 'paid',
            createShipment: true,
            shipmentStatus: 'pending'
        );

        $inventoryBefore = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventoryBefore->qty_on_hand);

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->patch(route('admin.orders.status.update', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'status_code' => 'cancelled',
                'notes' => 'Não devia cancelar processing',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('status');

        $order->refresh();

        $this->assertSame('processing', $order->status->code);

        $payment = Payment::query()->where('order_id', $order->id)->firstOrFail();
        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();

        $this->assertSame('paid', $payment->status);
        $this->assertSame('pending', $shipment->status);

        $inventoryAfter = Inventory::query()
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(5, (int) $inventoryAfter->qty_on_hand);

        $this->assertDatabaseMissing('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('cancelled', 'Cancelada'),
            'changed_by_user_id' => $admin->id,
            'notes' => 'Não devia cancelar processing',
        ]);
    }

    public function test_admin_can_mark_shipped_when_order_has_shipment(): void
    {
        [$admin, $order] = $this->makePhysicalOrderFixture(
            orderStatusCode: 'processing',
            orderStatusName: 'Em processamento',
            paymentStatus: 'paid',
            createShipment: true,
            shipmentStatus: 'pending'
        );

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->patch(route('admin.orders.status.update', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'status_code' => 'shipped',
                'notes' => 'Enviado para teste',
            ]);

        $response->assertRedirect();

        $order->refresh();
        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();

        $this->assertSame('shipped', $order->status->code);
        $this->assertSame('shipped', $shipment->status);
        $this->assertNotNull($shipment->shipped_at);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('shipped', 'Enviada'),
            'changed_by_user_id' => $admin->id,
            'notes' => 'Enviado para teste',
        ]);
    }

    public function test_admin_cannot_mark_shipped_when_order_has_no_shipment(): void
    {
        [$admin, $order] = $this->makeDigitalOrderFixture(
            orderStatusCode: 'processing',
            orderStatusName: 'Em processamento',
            paymentStatus: 'paid'
        );

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->patch(route('admin.orders.status.update', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'status_code' => 'shipped',
                'notes' => 'Não devia enviar digital',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('status');

        $order->refresh();

        $this->assertSame('processing', $order->status->code);

        $this->assertDatabaseMissing('shipments', [
            'order_id' => $order->id,
        ]);

        $this->assertDatabaseMissing('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('shipped', 'Enviada'),
            'changed_by_user_id' => $admin->id,
            'notes' => 'Não devia enviar digital',
        ]);
    }

    private function makePhysicalOrderFixture(
        string $orderStatusCode,
        string $orderStatusName,
        string $paymentStatus,
        bool $createShipment,
        string $shipmentStatus = 'pending'
    ): array {
        $this->seedLanguages();
        $currency = $this->seedCurrency();
        $warehouse = $this->seedWarehouse();

        $this->seedOrderStatus('pending_payment', 'Aguarda pagamento');
        $this->seedOrderStatus('paid', 'Paga');
        $this->seedOrderStatus('processing', 'Em processamento');
        $this->seedOrderStatus('shipped', 'Enviada');
        $this->seedOrderStatus('delivered', 'Entregue');
        $this->seedOrderStatus('cancelled', 'Cancelada');

        $status = $this->seedOrderStatus($orderStatusCode, $orderStatusName);

        $paymentMethod = PaymentMethod::query()->create([
            'code' => 'manual',
            'name' => 'Manual',
            'is_active' => true,
        ]);

        $shippingMethod = ShippingMethod::query()->create([
            'code' => 'standard',
            'name' => 'Standard',
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

        $product = Product::query()->create([
            'sku' => 'ORD-PHYS-001',
            'slug' => 'ord-phys-001',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();

        foreach ([$pt, $en] as $language) {
            ProductTranslation::query()->create([
                'product_id' => $product->id,
                'language_id' => $language->id,
                'name' => 'Produto Física',
                'description' => 'Produto Física',
                'meta_title' => 'Produto Física',
                'meta_description' => 'Produto Física',
                'is_machine_translated' => false,
            ]);
        }

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'qty_on_hand' => 5,
            'qty_reserved' => 0,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-GUARD-' . strtoupper(substr($orderStatusCode, 0, 4)),
            'user_id' => $customerUser->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua Billing',
                'city' => 'Lisboa',
                'postal_code' => '1000-001',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua Shipping',
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 2000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 2000,
            'paid_at' => in_array($paymentStatus, ['paid', 'partially_refunded', 'refunded'], true) ? now() : null,
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'name' => 'Produto Física',
            'sku' => 'ORD-PHYS-001',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => [
                'business_type' => 'physical',
            ],
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 2000,
            'status' => $paymentStatus,
            'paid_at' => in_array($paymentStatus, ['paid', 'partially_refunded', 'refunded'], true) ? now() : null,
        ]);

        if ($createShipment) {
            Shipment::query()->create([
                'order_id' => $order->id,
                'shipping_method_id' => $shippingMethod->id,
                'status' => $shipmentStatus,
                'tracking_number' => null,
                'shipped_at' => $shipmentStatus === 'shipped' ? now() : null,
                'delivered_at' => $shipmentStatus === 'delivered' ? now() : null,
            ]);
        }

        return [$admin, $order, $product];
    }

    private function makeDigitalOrderFixture(
        string $orderStatusCode,
        string $orderStatusName,
        string $paymentStatus
    ): array {
        $this->seedLanguages();
        $currency = $this->seedCurrency();

        $this->seedOrderStatus('pending_payment', 'Aguarda pagamento');
        $this->seedOrderStatus('paid', 'Paga');
        $this->seedOrderStatus('processing', 'Em processamento');
        $this->seedOrderStatus('shipped', 'Enviada');
        $this->seedOrderStatus('delivered', 'Entregue');
        $this->seedOrderStatus('cancelled', 'Cancelada');

        $status = $this->seedOrderStatus($orderStatusCode, $orderStatusName);

        $paymentMethod = PaymentMethod::query()->create([
            'code' => 'manual',
            'name' => 'Manual',
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

        $product = Product::query()->create([
            'sku' => 'ORD-DIGI-001',
            'slug' => 'ord-digi-001',
            'type' => 'simple',
            'business_type' => 'digital_service',
            'is_active' => true,
            'requires_shipping' => false,
            'manages_inventory' => false,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();

        foreach ([$pt, $en] as $language) {
            ProductTranslation::query()->create([
                'product_id' => $product->id,
                'language_id' => $language->id,
                'name' => 'Produto Digital',
                'description' => 'Produto Digital',
                'meta_title' => 'Produto Digital',
                'meta_description' => 'Produto Digital',
                'is_machine_translated' => false,
            ]);
        }

        $order = Order::query()->create([
            'order_number' => 'ORD-GUARD-DIGI',
            'user_id' => $customerUser->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua Billing',
                'city' => 'Lisboa',
                'postal_code' => '1000-001',
                'country_code' => 'PT',
            ],
            'shipping_address' => null,
            'subtotal_amount' => 3000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 3000,
            'paid_at' => in_array($paymentStatus, ['paid', 'partially_refunded', 'refunded'], true) ? now() : null,
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'name' => 'Produto Digital',
            'sku' => 'ORD-DIGI-001',
            'qty' => 1,
            'unit_amount' => 3000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 3000,
            'meta' => [
                'business_type' => 'digital_service',
            ],
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 3000,
            'status' => $paymentStatus,
            'paid_at' => in_array($paymentStatus, ['paid', 'partially_refunded', 'refunded'], true) ? now() : null,
        ]);

        return [$admin, $order];
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

    private function statusId(string $code, string $name): int
    {
        return (int) $this->seedOrderStatus($code, $name)->id;
    }
}
