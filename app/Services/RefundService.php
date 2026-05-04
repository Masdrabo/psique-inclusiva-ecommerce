<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\OrderStatusHistory;
use App\Models\Refund;
use App\Models\RefundItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RefundService
{
    public function createRefund(
        Order $order,
        array $itemsPayload,
        string $idempotencyKey,
        ?string $reason = null,
        ?string $notes = null,
        ?int $createdByUserId = null,
        int $shippingAmount = 0,
        ?int $orderReturnId = null
    ): Refund {
        return DB::transaction(function () use (
        $order,
        $itemsPayload,
        $idempotencyKey,
        $reason,
        $notes,
        $createdByUserId,
        $shippingAmount,
        $orderReturnId
    ) {
            $existingRefund = Refund::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existingRefund) {
                return $existingRefund->fresh([
                    'order.status',
                    'order.currency',
                    'order.customer.user',
                    'order.payment.method',
                    'items.orderItem.product',
                    'createdBy',
                ]);
            }

            $order = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->with([
                    'status',
                    'payment',
                    'items.product',
                    'items.refundItems',
                    'refunds',
                ])
                ->firstOrFail();

            $this->assertOrderRefundable($order);

            $payment = $order->payment;

            if (!$payment) {
                throw ValidationException::withMessages([
                    'refund' => __('ui.refunds.errors.payment_missing'),
                ]);
            }

            $reason = $this->normalizeNullableString($reason);
            $notes = $this->normalizeNullableString($notes);

            $shippingAmount = max(0, (int) $shippingAmount);

            $orderItems = $order->items->keyBy('id');

            $refundItemsTotal = 0;
            $normalizedItems = [];

            foreach ($itemsPayload as $row) {
                $orderItemId = (int) ($row['order_item_id'] ?? 0);
                $qtyToRefund = (int) ($row['qty'] ?? 0);

                if ($orderItemId <= 0 || $qtyToRefund <= 0) {
                    continue;
                }

                $orderItem = $orderItems->get($orderItemId);

                if (!$orderItem) {
                    throw ValidationException::withMessages([
                        'refund' => __('ui.refunds.errors.invalid_item'),
                    ]);
                }

                $alreadyRefundedQty = (int) $orderItem->refundItems->sum('qty');
                $alreadyRefundedAmount = (int) $orderItem->refundItems->sum('amount');

                $originalQty = (int) $orderItem->qty;
                $lineTotalAmount = (int) $orderItem->total_amount;

                $availableQtyToRefund = max(0, $originalQty - $alreadyRefundedQty);
                $remainingAmountForLine = max(0, $lineTotalAmount - $alreadyRefundedAmount);

                if ($qtyToRefund < 1 || $qtyToRefund > $availableQtyToRefund) {
                    throw ValidationException::withMessages([
                        'refund' => __('ui.refunds.errors.invalid_qty'),
                    ]);
                }

                $lineRefundAmount = $this->calculateProportionalRefundAmount(
                    lineTotalAmount: $lineTotalAmount,
                    originalQty: $originalQty,
                    qtyToRefund: $qtyToRefund,
                    alreadyRefundedAmount: $alreadyRefundedAmount,
                    availableQtyToRefund: $availableQtyToRefund
                );

                if ($lineRefundAmount <= 0) {
                    throw ValidationException::withMessages([
                        'refund' => __('ui.refunds.errors.invalid_amount'),
                    ]);
                }

                if ($lineRefundAmount > $remainingAmountForLine) {
                    throw ValidationException::withMessages([
                        'refund' => __('ui.refunds.errors.exceeds_remaining'),
                    ]);
                }

                $normalizedItems[] = [
                    'order_item' => $orderItem,
                    'qty' => $qtyToRefund,
                    'amount' => $lineRefundAmount,
                ];

                $refundItemsTotal += $lineRefundAmount;
            }

            $alreadyRefundedShippingAmount = (int) $order->refunds->sum(function ($refund) {
                return (int) ($refund->shipping_amount ?? 0);
            });

            $orderShippingAmount = max(0, (int) $order->shipping_amount);
            $remainingRefundableShippingAmount = max(
                0,
                $orderShippingAmount - $alreadyRefundedShippingAmount
            );

            if ($shippingAmount > $remainingRefundableShippingAmount) {
                throw ValidationException::withMessages([
                    'shipping_amount' => __('ui.refunds.errors.exceeds_remaining'),
                ]);
            }

            $refundTotal = $refundItemsTotal + $shippingAmount;

            if ($refundTotal <= 0) {
                throw ValidationException::withMessages([
                    'refund' => __('ui.refunds.errors.invalid_amount'),
                ]);
            }

            $alreadyRefundedOrderAmount = (int) $order->refunds->sum('amount');
            $remainingRefundableAmount = max(
                0,
                (int) $order->total_amount - $alreadyRefundedOrderAmount
            );

            if ($refundTotal > $remainingRefundableAmount) {
                throw ValidationException::withMessages([
                    'refund' => __('ui.refunds.errors.exceeds_remaining'),
                ]);
            }

            $refund = Refund::query()->create([
                'order_id' => $order->id,
                'order_return_id' => $orderReturnId,
                'payment_id' => $payment->id,
                'amount' => $refundTotal,
                'shipping_amount' => $shippingAmount,
                'reason' => $reason,
                'notes' => $notes,
                'created_by_user_id' => $createdByUserId,
                'idempotency_key' => $idempotencyKey,
            ]);

            foreach ($normalizedItems as $row) {
                RefundItem::query()->create([
                    'refund_id' => $refund->id,
                    'order_item_id' => $row['order_item']->id,
                    'qty' => $row['qty'],
                    'amount' => $row['amount'],
                ]);
            }

            $newRefundedAmount = $alreadyRefundedOrderAmount + $refundTotal;

            if ($newRefundedAmount >= (int) $order->total_amount) {
                $this->markOrderAsRefunded(
                    order: $order,
                    paymentId: $payment->id,
                    changedByUserId: $createdByUserId,
                    notes: $notes ?: __('ui.refunds.note_messages.full_refund_done')
                );
            } else {
                $this->markOrderPaymentAsPartiallyRefunded(
                    order: $order,
                    paymentId: $payment->id
                );
            }

            return $refund->fresh([
                'order.status',
                'order.currency',
                'order.customer.user',
                'order.payment.method',
                'items.orderItem.product',
                'createdBy',
            ]);
        });
    }

    private function calculateProportionalRefundAmount(
        int $lineTotalAmount,
        int $originalQty,
        int $qtyToRefund,
        int $alreadyRefundedAmount,
        int $availableQtyToRefund
    ): int {
        if ($lineTotalAmount <= 0 || $originalQty <= 0 || $qtyToRefund <= 0) {
            return 0;
        }

        $remainingAmount = max(0, $lineTotalAmount - $alreadyRefundedAmount);

        if ($availableQtyToRefund <= 0 || $remainingAmount <= 0) {
            return 0;
        }

        if ($qtyToRefund === $availableQtyToRefund) {
            return $remainingAmount;
        }

        return (int) floor(($remainingAmount * $qtyToRefund) / $availableQtyToRefund);
    }

    private function markOrderAsRefunded(
        Order $order,
        int $paymentId,
        ?int $changedByUserId = null,
        ?string $notes = null
    ): void {
        $status = OrderStatus::query()
            ->where('code', 'refunded')
            ->first();

        if (!$status) {
            throw ValidationException::withMessages([
                'refund' => __('ui.refunds.errors.status_missing_refunded'),
            ]);
        }

        $order->payment()->whereKey($paymentId)->update([
            'status' => 'refunded',
        ]);

        $order->update([
            'status_id' => $status->id,
        ]);

        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'status_id' => $status->id,
            'changed_by_user_id' => $changedByUserId,
            'notes' => $notes,
        ]);
    }

    private function markOrderPaymentAsPartiallyRefunded(
        Order $order,
        int $paymentId
    ): void {
        $order->payment()->whereKey($paymentId)->update([
            'status' => 'partially_refunded',
        ]);
    }

    private function assertOrderRefundable(Order $order): void {
        $allowedOrderStatuses = [
            'paid',
            'processing',
            'shipped',
            'delivered',
            'partially_refunded',
        ];

        $orderStatus = $order->status?->code;
        $paymentStatus = $order->payment?->status;

        if (!in_array($orderStatus, $allowedOrderStatuses, true)) {
            throw ValidationException::withMessages([
                'refund' => __('ui.refunds.errors.order_not_refundable'),
            ]);
        }

        if (!in_array($paymentStatus, ['paid', 'partially_refunded'], true)) {
            throw ValidationException::withMessages([
                'refund' => __('ui.refunds.errors.payment_not_refundable'),
            ]);
        }
    }

    private function normalizeNullableString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
