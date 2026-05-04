<?php

namespace Tests\Feature;

use App\Mail\ReturnRequestedMail;
use App\Mail\ReturnStatusUpdatedMail;
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
use App\Models\ShippingMethod;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReturnEmailTest extends TestCase
{
    use RefreshDatabase;

    protected Currency $currency;
    protected Language $languagePt;
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

    public function test_return_requested_mail_renders_order_return_information(): void
    {
        $user = User::factory()->create([
            'name' => 'Cliente Return',
            'email' => 'cliente-return@example.com',
            'role' => 'customer',
        ]);

        $order = $this->makeDeliveredOrderForUser($user);
        $orderItem = $order->items()->firstOrFail();

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-EMAIL-001',
            'status' => 'requested',
            'reason' => 'Tamanho errado',
            'notes' => 'Quero devolver este artigo',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $orderItem->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Tamanho errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $orderReturn->load([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        $mailable = new ReturnRequestedMail($orderReturn, 'pt');
        $html = $mailable->render();

        $this->assertStringContainsString('RET-EMAIL-001', $html);
        $this->assertStringContainsString($order->order_number, $html);
        $this->assertStringContainsString('Tamanho errado', $html);
        $this->assertStringContainsString('Quero devolver este artigo', $html);
        $this->assertStringContainsString('Produto A', $html);
        $this->assertStringContainsString('SKU-A', $html);
        $this->assertStringContainsString('Pedido de devolução', $html);
    }

    public function test_return_status_updated_mail_renders_approved_status(): void
    {
        $user = User::factory()->create([
            'name' => 'Cliente Return',
            'email' => 'cliente-return@example.com',
            'role' => 'customer',
        ]);

        $order = $this->makeDeliveredOrderForUser($user);
        $orderItem = $order->items()->firstOrFail();

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-EMAIL-002',
            'status' => 'approved',
            'reason' => 'Artigo com defeito',
            'notes' => 'Aprovado pelo admin',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDay(),
            'approved_by_user_id' => $user->id,
            'approved_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $orderItem->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Artigo com defeito',
            'condition' => 'damaged',
            'resolution' => 'refund',
        ]);

        $orderReturn->load([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        $mailable = new ReturnStatusUpdatedMail($orderReturn, 'pt');
        $html = $mailable->render();

        $this->assertStringContainsString('RET-EMAIL-002', $html);
        $this->assertStringContainsString('Aprovada', $html);
        $this->assertStringContainsString('Artigo com defeito', $html);
        $this->assertStringContainsString('Aprovado pelo admin', $html);
    }

    public function test_return_status_updated_mail_renders_rejected_status(): void
    {
        $user = User::factory()->create([
            'name' => 'Cliente Return',
            'email' => 'cliente-return@example.com',
            'role' => 'customer',
        ]);

        $order = $this->makeDeliveredOrderForUser($user);
        $orderItem = $order->items()->firstOrFail();

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-EMAIL-003',
            'status' => 'rejected',
            'reason' => 'Fora de prazo',
            'notes' => 'Pedido rejeitado',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDays(2),
            'approved_by_user_id' => $user->id,
            'approved_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $orderItem->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Fora de prazo',
            'condition' => 'opened',
            'resolution' => 'reject',
        ]);

        $orderReturn->load([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        $mailable = new ReturnStatusUpdatedMail($orderReturn, 'pt');
        $html = $mailable->render();

        $this->assertStringContainsString('RET-EMAIL-003', $html);
        $this->assertStringContainsString('Rejeitada', $html);
        $this->assertStringContainsString('Fora de prazo', $html);
        $this->assertStringContainsString('Pedido rejeitado', $html);
    }

    public function test_return_status_updated_mail_renders_received_status_and_received_qty(): void
    {
        $user = User::factory()->create([
            'name' => 'Cliente Return',
            'email' => 'cliente-return@example.com',
            'role' => 'customer',
        ]);

        $order = $this->makeDeliveredOrderForUser($user);
        $orderItem = $order->items()->firstOrFail();

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-EMAIL-004',
            'status' => 'received',
            'reason' => 'Recebido em armazém',
            'notes' => 'Receção concluída',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDays(3),
            'approved_by_user_id' => $user->id,
            'approved_at' => now()->subDays(2),
            'received_by_user_id' => $user->id,
            'received_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $orderItem->id,
            'qty' => 1,
            'received_qty' => 1,
            'restock_qty' => 1,
            'reason' => 'Recebido em armazém',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $orderReturn->load([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        $mailable = new ReturnStatusUpdatedMail($orderReturn, 'pt');
        $html = $mailable->render();

        $this->assertStringContainsString('RET-EMAIL-004', $html);
        $this->assertStringContainsString('Recebida', $html);
        $this->assertStringContainsString('Receção concluída', $html);
        $this->assertStringContainsString('Produto A', $html);
    }

    public function test_return_status_updated_mail_renders_closed_status(): void
    {
        $user = User::factory()->create([
            'name' => 'Cliente Return',
            'email' => 'cliente-return@example.com',
            'role' => 'customer',
        ]);

        $order = $this->makeDeliveredOrderForUser($user);
        $orderItem = $order->items()->firstOrFail();

        $orderReturn = OrderReturn::query()->create([
            'order_id' => $order->id,
            'return_number' => 'RET-EMAIL-005',
            'status' => 'closed',
            'reason' => 'Processo concluído',
            'notes' => 'Devolução encerrada',
            'requested_by_user_id' => $user->id,
            'requested_at' => now()->subDays(5),
            'approved_by_user_id' => $user->id,
            'approved_at' => now()->subDays(4),
            'received_by_user_id' => $user->id,
            'received_at' => now()->subDays(2),
            'closed_at' => now(),
        ]);

        $this->insertReturnItem([
            'return_id' => $orderReturn->id,
            'order_item_id' => $orderItem->id,
            'qty' => 1,
            'received_qty' => 1,
            'restock_qty' => 1,
            'reason' => 'Processo concluído',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $orderReturn->load([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        $mailable = new ReturnStatusUpdatedMail($orderReturn, 'pt');
        $html = $mailable->render();

        $this->assertStringContainsString('RET-EMAIL-005', $html);
        $this->assertStringContainsString('Fechada', $html);
        $this->assertStringContainsString('Devolução encerrada', $html);
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

    private function makeDeliveredOrderForUser(User $user): Order
    {
        $customer = Customer::query()->create([
            'user_id' => $user->id,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-' . strtoupper(substr(md5((string) mt_rand()), 0, 10)),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $this->currency->id,
            'status_id' => $this->statusDelivered->id,
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
            'subtotal_amount' => 2000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 2000,
            'paid_at' => now(),
        ]);

        $product = Product::query()->create([
            'sku' => 'SKU-A-' . $order->id,
            'slug' => 'produto-a-' . $order->id,
            'is_active' => true,
            'requires_shipping' => true,
            'business_type' => 'physical',
            'manages_inventory' => true,
            'allow_quantity' => true,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $product->id,
            'language_id' => $this->languagePt->id,
            'name' => 'Produto A',
            'description' => 'Produto A',
            'meta_title' => 'Produto A',
            'meta_description' => 'Produto A',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'product_id' => $product->id,
            'currency_id' => $this->currency->id,
            'amount' => 1000,
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
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

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $this->paymentMethod->id,
            'amount' => 2000,
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $this->shippingMethod->id,
            'status' => 'delivered',
            'tracking_number' => 'TRACK-' . $order->id,
            'shipped_at' => now()->subDay(),
            'delivered_at' => now(),
        ]);

        return $order->fresh([
            'items',
            'payment',
            'shipment',
            'user',
            'currency',
        ]);
    }
}
