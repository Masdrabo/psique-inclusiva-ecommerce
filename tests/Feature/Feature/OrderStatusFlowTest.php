<?php

namespace Tests\Feature;

use App\Mail\OrderStatusUpdatedMail;
use App\Models\Currency;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Services\OrderStatusNotificationService;
use App\Services\OrderStatusService;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class OrderStatusFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('queue.default', 'sync');
        config()->set('mail.default', 'array');
        config()->set('app.locale', 'pt');
        config()->set('app.fallback_locale', 'en');
        config()->set('mail.order_status_notifications_enabled', true);

        $this->seed(EcommerceBaseSeeder::class);
    }

    public function test_pending_payment_to_paid_updates_order_payment_history_and_queues_customer_email_with_locale(): void
    {
        Mail::fake();
        app()->setLocale('en');

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'pending_payment',
            paymentStatus: 'pending',
            withShipment: true,
            shipmentStatus: 'pending'
        );

        /** @var OrderStatusService $service */
        $service = app(OrderStatusService::class);

        $updated = $service->transition(
            order: $order,
            toCode: 'paid',
            changedByUserId: $order->user_id,
            notes: 'Payment confirmed in test.',
            restoreInventoryOnCancel: false
        );

        $this->assertSame('paid', $updated->status?->code);
        $this->assertNotNull($updated->paid_at);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status_id' => $this->statusId('paid'),
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('paid'),
            'changed_by_user_id' => $order->user_id,
            'notes' => 'Payment confirmed in test.',
        ]);

        $this->assertDatabaseHas('order_status_notifications', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('paid'),
            'channel' => 'email_customer',
            'recipient' => $order->user->email,
        ]);

        Mail::assertQueued(OrderStatusUpdatedMail::class, function (OrderStatusUpdatedMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'en';
        });

        Mail::assertQueuedCount(1);
    }

    public function test_paid_to_processing_keeps_payment_paid_and_queues_email(): void
    {
        Mail::fake();
        app()->setLocale('pt');

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'paid',
            paymentStatus: 'paid',
            withShipment: true,
            shipmentStatus: 'pending',
            withPaidAt: true
        );

        $updated = app(OrderStatusService::class)->transition(
            order: $order,
            toCode: 'processing',
            changedByUserId: $order->user_id,
            notes: 'Order moved to processing.',
            restoreInventoryOnCancel: false
        );

        $this->assertSame('processing', $updated->status?->code);
        $this->assertNotNull($updated->paid_at);

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('processing'),
        ]);

        Mail::assertQueued(OrderStatusUpdatedMail::class, function (OrderStatusUpdatedMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'pt';
        });

        Mail::assertQueuedCount(1);
    }

    public function test_processing_to_shipped_updates_shipment_and_queues_email(): void
    {
        Mail::fake();
        app()->setLocale('en');

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'processing',
            paymentStatus: 'paid',
            withShipment: true,
            shipmentStatus: 'pending',
            withPaidAt: true
        );

        $updated = app(OrderStatusService::class)->transition(
            order: $order,
            toCode: 'shipped',
            changedByUserId: $order->user_id,
            notes: 'Order shipped in test.',
            restoreInventoryOnCancel: false
        );

        $this->assertSame('shipped', $updated->status?->code);

        $this->assertDatabaseHas('shipments', [
            'order_id' => $order->id,
            'status' => 'shipped',
        ]);

        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();
        $this->assertNotNull($shipment->shipped_at);

        Mail::assertQueued(OrderStatusUpdatedMail::class, function (OrderStatusUpdatedMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'en';
        });

        Mail::assertQueuedCount(1);
    }

    public function test_shipped_to_delivered_updates_delivery_date_and_queues_email(): void
    {
        Mail::fake();
        app()->setLocale('pt');

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'shipped',
            paymentStatus: 'paid',
            withShipment: true,
            shipmentStatus: 'shipped',
            withPaidAt: true,
            withShippedAt: true
        );

        $updated = app(OrderStatusService::class)->transition(
            order: $order,
            toCode: 'delivered',
            changedByUserId: $order->user_id,
            notes: 'Order delivered in test.',
            restoreInventoryOnCancel: false
        );

        $this->assertSame('delivered', $updated->status?->code);

        $this->assertDatabaseHas('shipments', [
            'order_id' => $order->id,
            'status' => 'delivered',
        ]);

        $shipment = Shipment::query()->where('order_id', $order->id)->firstOrFail();
        $this->assertNotNull($shipment->delivered_at);

        Mail::assertQueued(OrderStatusUpdatedMail::class, function (OrderStatusUpdatedMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'pt';
        });

        Mail::assertQueuedCount(1);
    }

    public function test_delivered_to_cancelled_is_invalid_and_does_not_queue_email(): void
    {
        Mail::fake();

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'delivered',
            paymentStatus: 'paid',
            withShipment: true,
            shipmentStatus: 'delivered',
            withPaidAt: true,
            withShippedAt: true,
            withDeliveredAt: true
        );

        $service = app(OrderStatusService::class);

        try {
            $service->transition(
                order: $order,
                toCode: 'cancelled',
                changedByUserId: $order->user_id,
                notes: 'This should fail.',
                restoreInventoryOnCancel: false
            );

            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('status', $e->errors());
        }

        $order->refresh();

        $this->assertSame('delivered', $order->status?->code);

        $this->assertDatabaseMissing('order_status_histories', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('cancelled'),
        ]);

        $this->assertDatabaseMissing('order_status_notifications', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('cancelled'),
            'channel' => 'email_customer',
        ]);

        Mail::assertNothingQueued();
    }

    public function test_notification_service_does_not_queue_duplicate_email_for_same_status(): void
    {
        Mail::fake();
        app()->setLocale('en');

        $order = $this->createOrderWithRelations(
            orderStatusCode: 'paid',
            paymentStatus: 'paid',
            withShipment: true,
            shipmentStatus: 'pending',
            withPaidAt: true
        );

        /** @var OrderStatusNotificationService $service */
        $service = app(OrderStatusNotificationService::class);

        $service->sendForTransition(
            $order->fresh(['status', 'user', 'customer.user', 'currency', 'items', 'payment.method', 'shipment.method']),
            'pending_payment',
            'paid'
        );

        $service->sendForTransition(
            $order->fresh(['status', 'user', 'customer.user', 'currency', 'items', 'payment.method', 'shipment.method']),
            'pending_payment',
            'paid'
        );

        $this->assertDatabaseCount('order_status_notifications', 1);

        $this->assertDatabaseHas('order_status_notifications', [
            'order_id' => $order->id,
            'status_id' => $this->statusId('paid'),
            'channel' => 'email_customer',
            'recipient' => $order->user->email,
        ]);

        Mail::assertQueued(OrderStatusUpdatedMail::class, function (OrderStatusUpdatedMail $mail) use ($order) {
            return $mail->order->id === $order->id
                && $mail->localeCode === 'en';
        });

        Mail::assertQueuedCount(1);
    }

    private function createOrderWithRelations(
        string $orderStatusCode,
        string $paymentStatus,
        bool $withShipment = true,
        string $shipmentStatus = 'pending',
        bool $withPaidAt = false,
        bool $withShippedAt = false,
        bool $withDeliveredAt = false,
    ): Order {
        $user = User::factory()->create();

        $customer = Customer::query()->create([
            'user_id' => $user->id,
            'phone' => '910000000',
            'vat_number' => '123456789',
            'company_name' => 'Test Company',
        ]);

        $currency = Currency::query()
            ->where('code', 'EUR')
            ->firstOrFail();

        $orderStatus = OrderStatus::query()
            ->where('code', $orderStatusCode)
            ->firstOrFail();

        $order = Order::query()->create([
            'order_number' => 'TEST-' . strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $orderStatus->id,
            'billing_address' => [
                'name' => 'Billing Test',
                'line1' => 'Rua Teste 1',
                'line2' => null,
                'city' => 'Lisboa',
                'postal_code' => '1000-001',
                'region' => 'Lisboa',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Shipping Test',
                'line1' => 'Rua Teste 2',
                'line2' => null,
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'region' => 'Porto',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 1999,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 1999,
            'paid_at' => $withPaidAt ? now() : null,
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => PaymentMethod::query()->where('code', 'manual')->firstOrFail()->id,
            'amount' => 1999,
            'status' => $paymentStatus,
            'paid_at' => $withPaidAt ? now() : null,
        ]);

        if ($withShipment) {
            Shipment::query()->create([
                'order_id' => $order->id,
                'shipping_method_id' => ShippingMethod::query()->where('code', 'standard')->firstOrFail()->id,
                'tracking_number' => null,
                'status' => $shipmentStatus,
                'shipped_at' => $withShippedAt ? now() : null,
                'delivered_at' => $withDeliveredAt ? now() : null,
            ]);
        }

        return $order->fresh([
            'user',
            'customer.user',
            'currency',
            'status',
            'payment.method',
            'shipment.method',
            'items',
        ]);
    }

    private function statusId(string $code): int
    {
        return (int) OrderStatus::query()
            ->where('code', $code)
            ->value('id');
    }
}
