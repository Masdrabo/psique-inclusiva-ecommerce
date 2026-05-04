<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\OrderStatusHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    private const ALLOWED_TRANSITIONS = [
        'pending_payment' => ['paid', 'cancelled'],
        'paid' => ['processing'],
        'processing' => ['shipped'],
        'shipped' => ['delivered'],
        'delivered' => [],
        'cancelled' => [],
        'partially_refunded' => [],
        'refunded' => [],
    ];

    public function transition(
        Order $order,
        string $toCode,
        ?int $changedByUserId = null,
        ?string $notes = null,
        bool $restoreInventoryOnCancel = true
    ): Order {
        $fromCode = null;

        $updatedOrder = DB::transaction(function () use (
            $order,
            $toCode,
            $changedByUserId,
            $notes,
            $restoreInventoryOnCancel,
            &$fromCode
        ) {
            $order = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->with([
                    'status',
                    'items.product',
                    'payment',
                    'shipment',
                ])
                ->firstOrFail();

            $fromCode = $order->status?->code;

            if (!$fromCode) {
                throw ValidationException::withMessages([
                    'status' => __('ui.orders.errors.invalid_current_status'),
                ]);
            }

            if ($fromCode === $toCode) {
                return $order->fresh([
                    'status',
                    'payment.method',
                    'shipment.method',
                    'items.product',
                    'statusHistory.status',
                    'statusHistory.changedBy',
                ]);
            }

            $this->assertBusinessRulesBeforeTransition($order, $fromCode, $toCode);
            $this->assertTransitionAllowed($fromCode, $toCode);

            $targetStatus = OrderStatus::query()
                ->where('code', $toCode)
                ->first();

            if (!$targetStatus) {
                throw ValidationException::withMessages([
                    'status' => __('ui.orders.errors.invalid_target_status', [
                        'status' => $toCode,
                    ]),
                ]);
            }

            $this->applySideEffects(
                order: $order,
                toCode: $toCode,
                restoreInventoryOnCancel: $restoreInventoryOnCancel
            );

            $order->update([
                'status_id' => $targetStatus->id,
            ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status_id' => $targetStatus->id,
                'changed_by_user_id' => $changedByUserId,
                'notes' => $notes,
            ]);

            return $order->fresh([
                'status',
                'currency',
                'payment.method',
                'shipment.method',
                'items.product',
                'customer.user',
                'statusHistory.status',
                'statusHistory.changedBy',
            ]);
        });

        if ($fromCode && $fromCode !== $toCode) {
            app(OrderStatusNotificationService::class)->sendForTransition(
                $updatedOrder,
                $fromCode,
                $toCode
            );
        }

        return $updatedOrder;
    }

    public function recordInitialStatus(
        Order $order,
        ?int $changedByUserId = null,
        ?string $notes = null
    ): void {
        $exists = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->exists();

        if ($exists) {
            return;
        }

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status_id' => $order->status_id,
            'changed_by_user_id' => $changedByUserId,
            'notes' => $notes,
        ]);
    }

    public function allowedTargetsFor(Order $order): array
    {
        $order->loadMissing([
            'status',
            'shipment',
            'payment',
        ]);

        $fromCode = $order->status?->code;
        $allowed = self::ALLOWED_TRANSITIONS[$fromCode] ?? [];

        return collect($allowed)
            ->filter(function (string $toCode) use ($order, $fromCode) {
                if (in_array($fromCode, ['paid', 'processing'], true) && $toCode === 'cancelled') {
                    return false;
                }

                if ($toCode === 'shipped' && !$order->shipment) {
                    return false;
                }

                return true;
            })
            ->values()
            ->all();
    }

    private function assertTransitionAllowed(string $fromCode, string $toCode): void
    {
        $allowed = self::ALLOWED_TRANSITIONS[$fromCode] ?? [];

        if (!in_array($toCode, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => __('ui.orders.errors.invalid_transition', [
                    'from' => $fromCode,
                    'to' => $toCode,
                ]),
            ]);
        }
    }

    private function assertBusinessRulesBeforeTransition(Order $order, string $fromCode, string $toCode): void
    {
        if (in_array($fromCode, ['paid', 'processing'], true) && $toCode === 'cancelled') {
            throw ValidationException::withMessages([
                'status' => __('ui.orders.errors.cancel_paid_requires_refund'),
            ]);
        }

        if ($toCode === 'shipped' && !$order->shipment) {
            throw ValidationException::withMessages([
                'status' => __('ui.orders.errors.shipping_requires_shipment'),
            ]);
        }
    }

    private function applySideEffects(
        Order $order,
        string $toCode,
        bool $restoreInventoryOnCancel
    ): void {
        if ($toCode === 'paid') {
            $this->markAsPaid($order);
        }

        if ($toCode === 'processing') {
            $this->markAsProcessing($order);
        }

        if ($toCode === 'shipped') {
            $this->markAsShipped($order);
        }

        if ($toCode === 'delivered') {
            $this->markAsDelivered($order);
        }

        if ($toCode === 'cancelled') {
            $this->markAsCancelled($order, $restoreInventoryOnCancel);
        }
    }

    private function markAsPaid(Order $order): void
    {
        $paidAt = $order->paid_at ?? now();

        if (!$order->paid_at) {
            $order->update([
                'paid_at' => $paidAt,
            ]);
        }

        if ($order->payment) {
            $order->payment->update([
                'status' => 'paid',
                'paid_at' => $order->payment->paid_at ?? $paidAt,
            ]);
        }
    }

    private function markAsProcessing(Order $order): void
    {
        $paidAt = $order->paid_at ?? now();

        if (!$order->paid_at) {
            $order->update([
                'paid_at' => $paidAt,
            ]);
        }

        if ($order->payment && $order->payment->status !== 'paid') {
            $order->payment->update([
                'status' => 'paid',
                'paid_at' => $order->payment->paid_at ?? $paidAt,
            ]);
        }
    }

    private function markAsShipped(Order $order): void
    {
        if ($order->shipment) {
            $payload = [
                'status' => 'shipped',
            ];

            if (!$order->shipment->shipped_at) {
                $payload['shipped_at'] = now();
            }

            $order->shipment->update($payload);
        }
    }

    private function markAsDelivered(Order $order): void
    {
        if ($order->shipment) {
            $payload = [
                'status' => 'delivered',
            ];

            if (!$order->shipment->shipped_at) {
                $payload['shipped_at'] = now();
            }

            if (!$order->shipment->delivered_at) {
                $payload['delivered_at'] = now();
            }

            $order->shipment->update($payload);
        }
    }

    private function markAsCancelled(Order $order, bool $restoreInventoryOnCancel): void
    {
        if ($order->payment && in_array($order->payment->status, ['pending', 'authorized'], true)) {
            $order->payment->update([
                'status' => 'cancelled',
            ]);
        }

        if ($order->shipment && $order->shipment->status !== 'delivered') {
            $order->shipment->update([
                'status' => 'cancelled',
            ]);
        }

        if ($restoreInventoryOnCancel) {
            $inventoryService = app(InventoryService::class);

            foreach ($order->items as $item) {
                $product = $item->product;

                if (!$product) {
                    continue;
                }

                if (method_exists($product, 'managesInventory') && $product->managesInventory()) {
                    $inventoryService->increaseStock($product, (int) $item->qty);
                }
            }
        }
    }
}
