<?php

namespace Tests\Feature;

use App\Mail\OrderStatusUpdatedMail;
use App\Mail\RefundIssuedMail;
use App\Models\Currency;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\User;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundEmailTest extends TestCase
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

    public function test_order_status_updated_mail_shows_partial_refund_notice(): void
    {
        $order = $this->makeOrderForMail('shipped');

        $refund = Refund::query()->create([
            'order_id' => $order->id,
            'payment_id' => $order->payment->id,
            'amount' => 1000,
            'reason' => 'Refund parcial',
            'notes' => 'Teste',
            'created_by_user_id' => null,
        ]);

        RefundItem::query()->create([
            'refund_id' => $refund->id,
            'order_item_id' => $order->items[0]->id,
            'qty' => 1,
            'amount' => 1000,
        ]);

        $mail = new OrderStatusUpdatedMail(
            $order->fresh([
                'status',
                'currency',
                'items',
                'customer.user',
                'payment.method',
                'shipment.method',
                'refunds.items.orderItem',
            ]),
            'pt'
        );

        $html = $mail->render();

        $this->assertStringContainsString($order->order_number, $html);
    }

    public function test_order_status_updated_mail_shows_total_refund_notice(): void
    {
        $order = $this->makeOrderForMail('delivered');

        $refund = Refund::query()->create([
            'order_id' => $order->id,
            'payment_id' => $order->payment->id,
            'amount' => 2000,
            'reason' => 'Refund total',
            'notes' => 'Teste total',
            'created_by_user_id' => null,
        ]);

        RefundItem::query()->create([
            'refund_id' => $refund->id,
            'order_item_id' => $order->items[0]->id,
            'qty' => 2,
            'amount' => 2000,
        ]);

        $mail = new OrderStatusUpdatedMail(
            $order->fresh([
                'status',
                'currency',
                'items',
                'customer.user',
                'payment.method',
                'shipment.method',
                'refunds.items.orderItem',
            ]),
            'pt'
        );

        $html = $mail->render();

        $this->assertStringContainsString($order->order_number, $html);
    }

    public function test_refund_issued_mail_renders_reason_notes_and_amount(): void
    {
        $order = $this->makeOrderForMail('delivered');

        $refund = Refund::query()->create([
            'order_id' => $order->id,
            'payment_id' => $order->payment->id,
            'amount' => 1000,
            'reason' => 'Cliente devolveu 1 unidade',
            'notes' => 'Emitido pelo admin',
            'created_by_user_id' => null,
        ]);

        RefundItem::query()->create([
            'refund_id' => $refund->id,
            'order_item_id' => $order->items[0]->id,
            'qty' => 1,
            'amount' => 1000,
        ]);

        $mail = new RefundIssuedMail(
            $refund->fresh([
                'order.currency',
                'order.customer.user',
                'items.orderItem',
            ]),
            'pt'
        );

        $html = $mail->render();

        $this->assertStringContainsString('Cliente devolveu 1 unidade', $html);
        $this->assertStringContainsString('Emitido pelo admin', $html);
        $this->assertStringContainsString($order->order_number, $html);
        $this->assertStringContainsString('10.00 €', $html);
    }

    private function makeOrderForMail(string $statusCode): Order
    {
        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $paymentMethod = PaymentMethod::query()->where('code', 'manual')->firstOrFail();
        $status = OrderStatus::query()->where('code', $statusCode)->firstOrFail();

        $user = User::factory()->create([
            'role' => 'customer',
            'name' => 'Cliente Email',
            'email' => 'cliente-email@example.com',
        ]);

        $customer = Customer::query()->create([
            'user_id' => $user->id,
        ]);

        $product = Product::query()->create([
            'sku' => 'MAIL-REF-1',
            'slug' => 'mail-ref-1',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => false,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-MAIL-' . strtoupper(str()->random(6)),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente Email',
                'line1' => 'Rua Teste',
                'city' => 'Lisboa',
                'postal_code' => '1000-000',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Cliente Email',
                'line1' => 'Rua Teste',
                'city' => 'Lisboa',
                'postal_code' => '1000-000',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 2000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 2000,
            'paid_at' => now(),
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'name' => 'Produto Email',
            'sku' => 'MAIL-REF-1',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => null,
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 2000,
            'status' => 'paid',
            'provider_payment_id' => null,
            'payload' => null,
            'paid_at' => now(),
        ]);

        return $order->fresh([
            'status',
            'currency',
            'items',
            'customer.user',
            'payment.method',
            'refunds.items.orderItem',
        ]);
    }
}
