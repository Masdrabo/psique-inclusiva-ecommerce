<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderReturn;
use App\Models\ReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderReturnService
{
    public function createReturn(
        Order $order,
        array $itemsPayload,
        ?string $reason = null,
        ?string $notes = null,
        ?int $requestedByUserId = null
    ): OrderReturn {
        return DB::transaction(function () use ($order, $itemsPayload, $reason, $notes, $requestedByUserId) {
            $order = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->with([
                    'user',
                    'items.returnItems.return',
                ])
                ->firstOrFail();

            if (empty($itemsPayload)) {
                throw ValidationException::withMessages([
                    'return' => __('ui.returns.errors.invalid_item'),
                ]);
            }

            $reason = $this->normalizeNullableString($reason);
            $notes = $this->normalizeNullableString($notes);

            $orderItems = $order->items->keyBy('id');
            $normalizedItems = [];

            foreach ($itemsPayload as $row) {
                $orderItemId = (int) ($row['order_item_id'] ?? 0);
                $qty = (int) ($row['qty'] ?? 0);

                $orderItem = $orderItems->get($orderItemId);

                if (!$orderItem) {
                    throw ValidationException::withMessages([
                        'return' => __('ui.returns.errors.invalid_item'),
                    ]);
                }

                $alreadyReturnedQty = $this->alreadyReturnedQtyForOrderItem($orderItem);
                $remainingReturnableQty = max(0, (int) $orderItem->qty - $alreadyReturnedQty);

                if ($qty < 1 || $qty > $remainingReturnableQty) {
                    throw ValidationException::withMessages([
                        'return' => __('ui.returns.errors.invalid_qty'),
                    ]);
                }

                $normalizedItems[] = [
                    'order_item' => $orderItem,
                    'qty' => $qty,
                    'reason' => $this->normalizeNullableString($row['reason'] ?? null),
                    'condition' => $this->normalizeNullableString($row['condition'] ?? null),
                    'resolution' => $this->normalizeNullableString($row['resolution'] ?? null),
                ];
            }

            $return = OrderReturn::query()->create([
                'order_id' => $order->id,
                'user_id' => $order->user_id,
                'return_number' => $this->generateReturnNumber(),
                'status' => 'requested',
                'requested_by_user_id' => $requestedByUserId,
                'reason' => $reason,
                'notes' => $notes,
                'requested_at' => now(),
            ]);

            foreach ($normalizedItems as $row) {
                ReturnItem::query()->create([
                    'return_id' => $return->id,
                    'order_item_id' => $row['order_item']->id,
                    'qty' => $row['qty'],
                    'received_qty' => 0,
                    'restock_qty' => 0,
                    'exchange_shipped_qty' => 0,
                    'exchange_tracking_number' => null,
                    'exchange_shipped_at' => null,
                    'exchange_notes' => null,
                    'reason' => $row['reason'],
                    'condition' => $row['condition'],
                    'resolution' => $row['resolution'],
                ]);
            }

            return $return->fresh([
                'order',
                'items.orderItem.product',
                'requestedBy',
            ]);
        });
    }

    public function approveReturn(
        OrderReturn $return,
        ?int $approvedByUserId = null,
        ?string $notes = null
    ): OrderReturn {
        return DB::transaction(function () use ($return, $approvedByUserId, $notes) {
            $return = OrderReturn::query()
                ->whereKey($return->id)
                ->lockForUpdate()
                ->with('items.orderItem.product')
                ->firstOrFail();

            if ($return->status !== 'requested') {
                throw ValidationException::withMessages([
                    'return' => __('ui.returns.errors.invalid_status_change'),
                ]);
            }

            $return->update([
                'status' => 'approved',
                'approved_by_user_id' => $approvedByUserId,
                'approved_at' => now(),
                'notes' => $this->mergeNotes($return->notes, $notes),
            ]);

            return $return->fresh([
                'order',
                'items.orderItem.product',
                'approvedBy',
            ]);
        });
    }

    public function rejectReturn(
        OrderReturn $return,
        ?int $approvedByUserId = null,
        ?string $notes = null
    ): OrderReturn {
        return DB::transaction(function () use ($return, $approvedByUserId, $notes) {
            $return = OrderReturn::query()
                ->whereKey($return->id)
                ->lockForUpdate()
                ->with('items.orderItem.product')
                ->firstOrFail();

            if (!in_array($return->status, ['requested', 'approved'], true)) {
                throw ValidationException::withMessages([
                    'return' => __('ui.returns.errors.invalid_status_change'),
                ]);
            }

            $return->update([
                'status' => 'rejected',
                'approved_by_user_id' => $approvedByUserId,
                'approved_at' => $return->approved_at ?? now(),
                'closed_at' => now(),
                'notes' => $this->mergeNotes($return->notes, $notes),
            ]);

            return $return->fresh([
                'order',
                'items.orderItem.product',
                'approvedBy',
            ]);
        });
    }

    public function receiveReturn(
        OrderReturn $return,
        array $itemsPayload,
        ?int $receivedByUserId = null,
        ?string $notes = null
    ): OrderReturn {
        return DB::transaction(function () use ($return, $itemsPayload, $receivedByUserId, $notes) {
            $return = OrderReturn::query()
                ->whereKey($return->id)
                ->lockForUpdate()
                ->with([
                    'items.orderItem.product',
                ])
                ->firstOrFail();

            if (!in_array($return->status, ['approved', 'received'], true)) {
                throw ValidationException::withMessages([
                    'return' => __('ui.returns.errors.invalid_status_change'),
                ]);
            }

            $payloadByOrderItemId = collect($itemsPayload)->keyBy(function ($row) {
                return (int) ($row['order_item_id'] ?? 0);
            });

            $inventoryService = app(InventoryService::class);

            foreach ($return->items as $returnItem) {
                $row = $payloadByOrderItemId->get((int) $returnItem->order_item_id);

                if (!$row) {
                    continue;
                }

                $receivedQty = max(0, (int) ($row['received_qty'] ?? 0));
                $restockQty = max(0, (int) ($row['restock_qty'] ?? 0));

                if ($receivedQty > (int) $returnItem->qty) {
                    throw ValidationException::withMessages([
                        'return' => __('ui.returns.errors.invalid_received_qty'),
                    ]);
                }

                if ($restockQty > $receivedQty) {
                    throw ValidationException::withMessages([
                        'return' => __('ui.returns.errors.invalid_restock_qty'),
                    ]);
                }

                $previousRestockQty = (int) $returnItem->restock_qty;
                $deltaRestockQty = max(0, $restockQty - $previousRestockQty);

                $returnItem->update([
                    'received_qty' => $receivedQty,
                    'restock_qty' => $restockQty,
                ]);

                $product = $returnItem->orderItem?->product;

                if (
                    $deltaRestockQty > 0 &&
                    $product &&
                    method_exists($product, 'managesInventory') &&
                    $product->managesInventory()
                ) {
                    $inventoryService->increaseStock($product, $deltaRestockQty);
                }
            }

            $return->update([
                'status' => 'received',
                'received_by_user_id' => $receivedByUserId,
                'received_at' => now(),
                'notes' => $this->mergeNotes($return->notes, $notes),
            ]);

            return $return->fresh([
                'order',
                'items.orderItem.product',
                'receivedBy',
            ]);
        });
    }

    public function shipExchange(
        OrderReturn $return,
        array $itemsPayload,
        ?string $trackingNumber = null,
        ?string $notes = null
    ): OrderReturn {
        return DB::transaction(function () use ($return, $itemsPayload, $trackingNumber, $notes) {
            $return = OrderReturn::query()
                ->whereKey($return->id)
                ->lockForUpdate()
                ->with('items.orderItem.product')
                ->firstOrFail();

            if ($return->status !== 'received') {
                throw ValidationException::withMessages([
                    'return' => __('ui.returns.errors.invalid_status_change'),
                ]);
            }

            $payloadByOrderItemId = collect($itemsPayload)->keyBy(function ($row) {
                return (int) ($row['order_item_id'] ?? 0);
            });

            $trackingNumber = $this->normalizeNullableString($trackingNumber);
            $notes = $this->normalizeNullableString($notes);
            $hasShipment = false;

            foreach ($return->items as $returnItem) {
                if (($returnItem->resolution ?? null) !== 'exchange') {
                    continue;
                }

                $row = $payloadByOrderItemId->get((int) $returnItem->order_item_id);

                if (!$row) {
                    continue;
                }

                $shipQty = max(0, (int) ($row['shipped_qty'] ?? 0));
                $alreadyShippedQty = (int) $returnItem->exchange_shipped_qty;
                $maxShippableQty = max(0, (int) $returnItem->received_qty - $alreadyShippedQty);

                if ($shipQty > $maxShippableQty) {
                    throw ValidationException::withMessages([
                        'return' => 'A quantidade reenviada excede a quantidade recebida disponível para troca.',
                    ]);
                }

                if ($shipQty <= 0) {
                    continue;
                }

                $returnItem->update([
                    'exchange_shipped_qty' => $alreadyShippedQty + $shipQty,
                    'exchange_tracking_number' => $trackingNumber ?: $returnItem->exchange_tracking_number,
                    'exchange_shipped_at' => now(),
                    'exchange_notes' => $this->mergeNotes($returnItem->exchange_notes, $notes),
                ]);

                $hasShipment = true;
            }

            if (!$hasShipment) {
                throw ValidationException::withMessages([
                    'items' => 'Seleciona pelo menos um artigo de troca com quantidade de reenvio superior a 0.',
                ]);
            }

            $return->update([
                'notes' => $this->mergeNotes($return->notes, $notes),
            ]);

            return $return->fresh([
                'order',
                'items.orderItem.product',
            ]);
        });
    }

    public function closeReturn(
    OrderReturn $return,
    ?string $notes = null
): OrderReturn {
    return DB::transaction(function () use ($return, $notes) {
        $return = OrderReturn::query()
            ->whereKey($return->id)
            ->lockForUpdate()
            ->with([
                'order.items.refundItems',
                'order.items.returnItems.return',
                'items.orderItem.refundItems',
                'items.orderItem.returnItems.return',
                'items.orderItem.product',
            ])
            ->firstOrFail();

        if (!in_array($return->status, ['received', 'rejected'], true)) {
            throw ValidationException::withMessages([
                'return' => __('ui.returns.errors.invalid_status_change'),
            ]);
        }

        if ($return->status === 'received') {
            foreach ($return->items as $returnItem) {
                if (($returnItem->resolution ?? null) !== 'refund') {
                    continue;
                }

                $orderItem = $returnItem->orderItem;

                if (!$orderItem) {
                    continue;
                }

                $totalRefundedQtyForOrderItem = (int) $orderItem->refundItems->sum('qty');

                $totalReceivedRefundQtyForOrderItem = (int) $orderItem->returnItems
                    ->filter(function ($linkedReturnItem) {
                        $linkedReturn = $linkedReturnItem->return;

                        if (!$linkedReturn) {
                            return false;
                        }

                        if (!in_array($linkedReturn->status, ['received', 'closed'], true)) {
                            return false;
                        }

                        return ($linkedReturnItem->resolution ?? null) === 'refund';
                    })
                    ->sum('received_qty');

                if ($totalRefundedQtyForOrderItem < $totalReceivedRefundQtyForOrderItem) {
                    throw ValidationException::withMessages([
                        'return' => 'Não podes fechar esta devolução enquanto existir refund pendente relativo aos artigos recebidos com resolução de refund.',
                    ]);
                }
            }
        }

        $return->update([
            'status' => 'closed',
            'closed_at' => now(),
            'notes' => $this->mergeNotes($return->notes, $notes),
        ]);

        return $return->fresh([
            'order',
            'items.orderItem.product',
        ]);
    });
}

    public function buildRefundPayloadFromReturn(OrderReturn $return): array
{
    $return = OrderReturn::query()
        ->whereKey($return->id)
        ->with([
            'order.refunds',
            'items.orderItem.refundItems',
            'items.orderItem.product',
        ])
        ->firstOrFail();

    if ($return->status !== 'received') {
        throw ValidationException::withMessages([
            'return' => 'Só é possível gerar reembolso automático para devoluções recebidas.',
        ]);
    }

    $itemsPayload = [];

    foreach ($return->items as $returnItem) {
        if (($returnItem->resolution ?? null) !== 'refund') {
            continue;
        }

        $orderItem = $returnItem->orderItem;

        if (!$orderItem) {
            continue;
        }

        $alreadyRefundedQty = (int) $orderItem->refundItems->sum('qty');
        $maxRefundableQtyForOrderItem = max(0, (int) $orderItem->qty - $alreadyRefundedQty);
        $receivedQtyForThisReturn = max(0, (int) $returnItem->received_qty);

        $qtyToRefund = min($receivedQtyForThisReturn, $maxRefundableQtyForOrderItem);

        if ($qtyToRefund <= 0) {
            continue;
        }

        $itemsPayload[] = [
            'order_item_id' => (int) $orderItem->id,
            'qty' => $qtyToRefund,
        ];
    }

    $shippingAmount = 0;

    return [
        'items' => $itemsPayload,
        'shipping_amount' => $shippingAmount,
    ];
}

    private function alreadyReturnedQtyForOrderItem($orderItem): int
    {
        return (int) $orderItem->returnItems
            ->filter(function ($returnItem) {
                $status = $returnItem->return?->status;

                return !in_array($status, ['rejected', 'cancelled'], true);
            })
            ->sum('qty');
    }

    private function generateReturnNumber(): string
    {
        for ($i = 0; $i < 5; $i++) {
            $number = 'RET-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));

            if (!OrderReturn::query()->where('return_number', $number)->exists()) {
                return $number;
            }
        }

        return 'RET-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(8));
    }

    private function normalizeNullableString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    private function mergeNotes(?string $existing, ?string $new): ?string
    {
        $existing = $this->normalizeNullableString($existing);
        $new = $this->normalizeNullableString($new);

        if (!$existing) {
            return $new;
        }

        if (!$new) {
            return $existing;
        }

        return $existing . "\n\n" . $new;
    }
}
