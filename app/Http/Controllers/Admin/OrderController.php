<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\OrderStatusService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderController extends Controller
{
    public function index(
        string $locale,
        Request $request,
        OrderStatusService $orderStatusService
    ): Response {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));
        $hasReturns = trim((string) $request->query('has_returns', ''));
        $hasRefunds = trim((string) $request->query('has_refunds', ''));

        $orders = $this->filteredOrdersQuery($q, $status, $dateFrom, $dateTo, $hasReturns, $hasRefunds)
            ->with([
                'user:id,name,email',
                'status:id,code,name',
                'currency:id,code,symbol,decimal_places',
                'payment:id,order_id,status',
                'refunds:id,order_id,amount,shipping_amount',
                'returns:id,order_id,status',
                'shipment:id,order_id,shipping_method_id,status,tracking_number,shipped_at,delivered_at',
                'shipment.method:id,code,name',
            ])
            ->select([
                'id',
                'order_number',
                'user_id',
                'status_id',
                'currency_id',
                'total_amount',
                'paid_at',
                'created_at',
            ])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(function ($o) use ($orderStatusService) {
                $refundedTotalAmount = (int) $o->refunds->sum('amount');
                $shippingRefundedTotalAmount = (int) $o->refunds->sum(function ($refund) {
                    return (int) ($refund->shipping_amount ?? 0);
                });

                $hasPartialRefund = $refundedTotalAmount > 0 && $refundedTotalAmount < (int) $o->total_amount;
                $hasFullRefund = $refundedTotalAmount > 0 && $refundedTotalAmount >= (int) $o->total_amount;

                $returnsCount = (int) $o->returns->count();
                $openReturnsCount = (int) $o->returns
                    ->whereIn('status', ['requested', 'approved', 'received'])
                    ->count();

                return [
                    'id' => (int) $o->id,
                    'order_number' => $o->order_number,
                    'created_at' => optional($o->created_at)->toISOString(),
                    'paid_at' => optional($o->paid_at)->toISOString(),
                    'total_amount' => (int) $o->total_amount,
                    'status' => [
                        'code' => $o->status?->code,
                        'name' => $o->status?->name,
                    ],
                    'currency' => [
                        'code' => $o->currency?->code,
                        'symbol' => $o->currency?->symbol,
                        'decimal_places' => (int) ($o->currency?->decimal_places ?? 2),
                    ],
                    'customer' => [
                        'name' => $o->user?->name,
                        'email' => $o->user?->email,
                    ],
                    'payment' => [
                        'status' => $o->payment?->status,
                    ],
                    'shipment' => $o->shipment ? [
                        'status' => $o->shipment->status,
                        'tracking_number' => $o->shipment->tracking_number,
                        'shipped_at' => optional($o->shipment->shipped_at)->toISOString(),
                        'delivered_at' => optional($o->shipment->delivered_at)->toISOString(),
                        'method_name' => $o->shipment->method?->name,
                        'method_code' => $o->shipment->method?->code,
                    ] : null,
                    'refunded_total_amount' => $refundedTotalAmount,
                    'shipping_refunded_total_amount' => $shippingRefundedTotalAmount,
                    'has_partial_refund' => $hasPartialRefund,
                    'has_full_refund' => $hasFullRefund,
                    'returns_count' => $returnsCount,
                    'open_returns_count' => $openReturnsCount,
                    'has_returns' => $returnsCount > 0,
                    'allowed_next_statuses' => $orderStatusService->allowedTargetsFor($o),
                ];
            });

        $availableStatuses = [
            ['value' => '', 'label' => __('ui.common.all')],
            ['value' => 'pending_payment', 'label' => __('ui.statuses.pending_payment')],
            ['value' => 'paid', 'label' => __('ui.statuses.paid')],
            ['value' => 'processing', 'label' => __('ui.statuses.processing')],
            ['value' => 'shipped', 'label' => __('ui.statuses.shipped')],
            ['value' => 'delivered', 'label' => __('ui.statuses.delivered')],
            ['value' => 'cancelled', 'label' => __('ui.statuses.cancelled')],
        ];

        return Inertia::render('Admin/Orders/Index', [
            'orders' => $orders,
            'filters' => [
                'q' => $q,
                'status' => $status,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'has_returns' => $hasReturns,
                'has_refunds' => $hasRefunds,
            ],
            'availableStatuses' => $availableStatuses,
        ]);
    }

    public function show(string $locale, Order $order, OrderStatusService $orderStatusService): Response
    {
        $order->load([
            'user:id,name,email',
            'customer.user:id,name,email',
            'status:id,code,name',
            'currency:id,code,symbol,decimal_places',
            'items.product',
            'items.refundItems',
            'items.returnItems.return',
            'payment.method',
            'shipment.method',
            'shipment.items.orderItem',
            'refunds.items.orderItem',
            'refunds.createdBy:id,name,email',
            'returns.items.orderItem.product',
            'returns.requestedBy:id,name,email',
            'returns.approvedBy:id,name,email',
            'returns.receivedBy:id,name,email',
            'statusHistory.status:id,code,name',
        ]);

        $refundsTotal = (int) $order->refunds->sum('amount');
        $shippingRefundedTotalAmount = (int) $order->refunds->sum(function ($refund) {
            return (int) ($refund->shipping_amount ?? 0);
        });

        $remainingRefundableAmount = max(0, (int) $order->total_amount - $refundsTotal);
        $remainingShippingRefundableAmount = max(
            0,
            (int) $order->shipping_amount - $shippingRefundedTotalAmount
        );

        $hasPartialRefund = $refundsTotal > 0 && $refundsTotal < (int) $order->total_amount;
        $hasFullRefund = $refundsTotal > 0 && $refundsTotal >= (int) $order->total_amount;

        $items = $order->items->map(function ($item) {
            $refundedQty = (int) $item->refundItems->sum('qty');
            $refundAmount = (int) $item->refundItems->sum('amount');
            $remainingRefundableQty = max(0, (int) $item->qty - $refundedQty);

            $returnedQty = (int) $item->returnItems
                ->filter(fn ($returnItem) => !in_array($returnItem->return?->status, ['rejected', 'cancelled'], true))
                ->sum('qty');

            $remainingReturnableQty = max(0, (int) $item->qty - $returnedQty);

            return [
                'id' => (int) $item->id,
                'product_id' => $item->product_id ? (int) $item->product_id : null,
                'name' => $item->name,
                'sku' => $item->sku,
                'qty' => (int) $item->qty,
                'unit_amount' => (int) $item->unit_amount,
                'discount_amount' => (int) $item->discount_amount,
                'tax_amount' => (int) $item->tax_amount,
                'total_amount' => (int) $item->total_amount,
                'meta' => is_array($item->meta) ? $item->meta : [],
                'refunded_qty' => $refundedQty,
                'refunded_amount' => $refundAmount,
                'remaining_refundable_qty' => $remainingRefundableQty,
                'returned_qty' => $returnedQty,
                'remaining_returnable_qty' => $remainingReturnableQty,
                'is_inventory_product' => (bool) ($item->product?->manages_inventory ?? false),
            ];
        })->values();

        $refunds = $order->refunds
            ->sortByDesc('id')
            ->values()
            ->map(function ($refund) {
                return [
                    'id' => (int) $refund->id,
                    'amount' => (int) $refund->amount,
                    'shipping_amount' => (int) ($refund->shipping_amount ?? 0),
                    'reason' => $refund->reason,
                    'notes' => $refund->notes,
                    'created_at' => optional($refund->created_at)->toISOString(),
                    'created_by' => [
                        'name' => $refund->createdBy?->name,
                        'email' => $refund->createdBy?->email,
                    ],
                    'items' => $refund->items->map(function ($refundItem) {
                        return [
                            'id' => (int) $refundItem->id,
                            'order_item_id' => (int) $refundItem->order_item_id,
                            'qty' => (int) $refundItem->qty,
                            'amount' => (int) $refundItem->amount,
                            'item_name' => $refundItem->orderItem?->name,
                            'item_sku' => $refundItem->orderItem?->sku,
                        ];
                    })->values(),
                ];
            });

        /*
            |--------------------------------------------------------------------------
        | Alocar qty reembolsada às devoluções recebidas por ordem cronológica
        |--------------------------------------------------------------------------
        */
        $refundedQtyByOrderItemId = $order->items
            ->mapWithKeys(function ($item) {
                return [
                    (int) $item->id => (int) $item->refundItems->sum('qty'),
                ];
            });

        $refundedQtyAllocatedByReturnItemId = [];

        $refundResolutionReturnItems = $order->returns
            ->flatMap(function ($return) {
                return $return->items->map(function ($item) use ($return) {
                    return [
                        'return_id' => (int) $return->id,
                        'return_received_at' => optional($return->received_at)?->timestamp ?? 0,
                        'return_created_at' => optional($return->created_at)?->timestamp ?? 0,
                        'return_status' => $return->status,
                        'item' => $item,
                    ];
                });
            })
            ->filter(function ($row) {
                $item = $row['item'];

                return $row['return_status'] !== 'rejected'
                    && $row['return_status'] !== 'cancelled'
                    && ($item->resolution === 'refund')
                    && ((int) $item->received_qty > 0);
            })
            ->groupBy(function ($row) {
                return (int) $row['item']->order_item_id;
            });

        foreach ($refundResolutionReturnItems as $orderItemId => $rows) {
            $remainingRefundedQty = (int) ($refundedQtyByOrderItemId[(int) $orderItemId] ?? 0);

            $sortedRows = $rows->sortBy([
                ['return_received_at', 'asc'],
                ['return_created_at', 'asc'],
                [fn ($row) => (int) $row['return_id'], 'asc'],
                [fn ($row) => (int) $row['item']->id, 'asc'],
            ])->values();

            foreach ($sortedRows as $row) {
                $returnItem = $row['item'];
                $receivedQty = (int) $returnItem->received_qty;

                $allocatedQty = min($receivedQty, max(0, $remainingRefundedQty));

                $refundedQtyAllocatedByReturnItemId[(int) $returnItem->id] = $allocatedQty;
                $remainingRefundedQty -= $allocatedQty;
            }
        }

        $returns = $order->returns
            ->sortByDesc('id')
            ->values()
            ->map(function ($return) use ($refundedQtyAllocatedByReturnItemId) {
                return [
                    'id' => (int) $return->id,
                    'return_number' => $return->return_number,
                    'status' => $return->status,
                    'reason' => $return->reason,
                    'notes' => $return->notes,
                    'requested_at' => optional($return->requested_at)->toISOString(),
                    'approved_at' => optional($return->approved_at)->toISOString(),
                    'received_at' => optional($return->received_at)->toISOString(),
                    'closed_at' => optional($return->closed_at)->toISOString(),
                    'requested_by' => $return->requestedBy ? [
                        'name' => $return->requestedBy->name,
                        'email' => $return->requestedBy->email,
                    ] : null,
                    'approved_by' => $return->approvedBy ? [
                        'name' => $return->approvedBy->name,
                        'email' => $return->approvedBy->email,
                    ] : null,
                    'received_by' => $return->receivedBy ? [
                        'name' => $return->receivedBy->name,
                        'email' => $return->receivedBy->email,
                    ] : null,
                    'items' => $return->items->map(function ($item) use ($refundedQtyAllocatedByReturnItemId) {
                        $orderItem = $item->orderItem;

                        $unitAmount = (int) ($orderItem?->unit_amount ?? 0);
                        $lineTotalAmount = (int) ($orderItem?->total_amount ?? 0);
                        $originalQty = (int) ($orderItem?->qty ?? 0);

                        $requestedQty = (int) $item->qty;
                        $receivedQty = (int) $item->received_qty;
                        $exchangeShippedQty = (int) ($item->exchange_shipped_qty ?? 0);

                        $requestedLineAmount = $this->calculateProportionalLineAmount(
                            lineTotalAmount: $lineTotalAmount,
                            originalQty: $originalQty,
                            partialQty: $requestedQty
                        );

                        $receivedLineAmount = $this->calculateProportionalLineAmount(
                            lineTotalAmount: $lineTotalAmount,
                            originalQty: $originalQty,
                            partialQty: $receivedQty
                        );

                        $refundedQtyApplied = (int) ($refundedQtyAllocatedByReturnItemId[(int) $item->id] ?? 0);
                        $remainingRefundableForThisReturnItem = max(0, $receivedQty - $refundedQtyApplied);

                        $appliedRefundAmount = $this->calculateProportionalLineAmount(
                            lineTotalAmount: $lineTotalAmount,
                            originalQty: $originalQty,
                            partialQty: $refundedQtyApplied
                        );

                        return [
                            'id' => (int) $item->id,
                            'order_item_id' => (int) $item->order_item_id,
                            'qty' => $requestedQty,
                            'received_qty' => $receivedQty,
                            'restock_qty' => (int) $item->restock_qty,
                            'reason' => $item->reason,
                            'condition' => $item->condition,
                            'resolution' => $item->resolution,
                            'item_name' => $orderItem?->name,
                            'item_sku' => $orderItem?->sku,
                            'unit_amount' => $unitAmount,
                            'discount_amount' => (int) ($orderItem?->discount_amount ?? 0),
                            'tax_amount' => (int) ($orderItem?->tax_amount ?? 0),
                            'line_total_amount' => $requestedLineAmount,
                            'potential_refund_amount' => ($item->resolution === 'refund')
                                ? $requestedLineAmount
                                : 0,
                            'received_refund_amount' => ($item->resolution === 'refund')
                                ? $appliedRefundAmount
                                : 0,
                            'refunded_qty_applied' => $refundedQtyApplied,
                            'remaining_refundable_for_this_return_item' => ($item->resolution === 'refund')
                                ? $remainingRefundableForThisReturnItem
                                : 0,
                            'is_inventory_product' => (bool) ($orderItem?->product?->manages_inventory ?? false),
                            'exchange_shipped_qty' => $exchangeShippedQty,
                            'exchange_remaining_qty' => max(0, $receivedQty - $exchangeShippedQty),
                            'exchange_tracking_number' => $item->exchange_tracking_number,
                            'exchange_shipped_at' => optional($item->exchange_shipped_at)->toISOString(),
                            'exchange_notes' => $item->exchange_notes,
                            'meta' => is_array($orderItem?->meta) ? $orderItem->meta : [],
                        ];
                    })->values(),
                ];
            });

        $canRefund = in_array($order->status?->code, [
            'paid',
            'processing',
            'shipped',
            'delivered',
        ], true) && in_array($order->payment?->status, [
            'paid',
            'partially_refunded',
        ], true) && $remainingRefundableAmount > 0;

        $statusTimeline = $order->statusHistory
            ->sortBy('id')
            ->values()
            ->map(function ($history) {
                return [
                    'id' => (int) $history->id,
                    'status_code' => $history->status?->code,
                    'status_name' => $history->status?->name,
                    'created_at' => optional($history->created_at)->toISOString(),
                    'notes' => $history->notes,
                ];
            });

        $shippingMethodCode = data_get($order->shipping_address, 'shipping_method_code')
            ?? $order->shipment?->method?->code
            ?? null;

        $shippingMethodName = data_get($order->shipping_address, 'shipping_method_name')
            ?? $order->shipment?->method?->name
            ?? null;

        $isPickup = $shippingMethodCode === 'pickup';

        return Inertia::render('Admin/Orders/Show', [
            'order' => [
                'id' => (int) $order->id,
                'order_number' => $order->order_number,
                'created_at' => optional($order->created_at)->toISOString(),
                'paid_at' => optional($order->paid_at)->toISOString(),
                'is_pickup' => $isPickup,
                'shipping_label' => $isPickup
                    ? __('ui.orders.pickup_in_store')
                    : $shippingMethodName,
                'billing_address' => $order->billing_address,
                'shipping_address' => $order->shipping_address,
                'subtotal_amount' => (int) $order->subtotal_amount,
                'discount_amount' => (int) $order->discount_amount,
                'tax_amount' => (int) $order->tax_amount,
                'shipping_amount' => (int) $order->shipping_amount,
                'total_amount' => (int) $order->total_amount,
                'refunded_total_amount' => $refundsTotal,
                'shipping_refunded_total_amount' => $shippingRefundedTotalAmount,
                'remaining_refundable_amount' => $remainingRefundableAmount,
                'remaining_shipping_refundable_amount' => $remainingShippingRefundableAmount,
                'has_partial_refund' => $hasPartialRefund,
                'has_full_refund' => $hasFullRefund,
                'status' => [
                    'code' => $order->status?->code,
                    'name' => $order->status?->name,
                ],
                'currency' => [
                    'code' => $order->currency?->code,
                    'symbol' => $order->currency?->symbol,
                    'decimal_places' => (int) ($order->currency?->decimal_places ?? 2),
                ],
                'customer' => [
                    'name' => $order->user?->name ?? $order->customer?->user?->name,
                    'email' => $order->user?->email ?? $order->customer?->user?->email,
                ],
                'payment' => [
                    'status' => $order->payment?->status,
                    'amount' => $order->payment?->amount !== null ? (int) $order->payment->amount : null,
                    'paid_at' => optional($order->payment?->paid_at)->toISOString(),
                    'method_name' => $order->payment?->method?->name,
                    'method_code' => $order->payment?->method?->code,
                ],
                'shipment' => $order->shipment ? [
                    'id' => (int) $order->shipment->id,
                    'status' => $order->shipment->status,
                    'tracking_number' => $order->shipment->tracking_number,
                    'shipped_at' => optional($order->shipment->shipped_at)->toISOString(),
                    'delivered_at' => optional($order->shipment->delivered_at)->toISOString(),
                    'method_name' => $order->shipment->method?->name,
                    'method_code' => $order->shipment->method?->code,
                    'items' => $order->shipment->items->map(function ($shipmentItem) {
                        return [
                            'id' => (int) $shipmentItem->id,
                            'order_item_id' => (int) $shipmentItem->order_item_id,
                            'qty' => (int) $shipmentItem->qty,
                            'item_name' => $shipmentItem->orderItem?->name,
                            'item_sku' => $shipmentItem->orderItem?->sku,
                        ];
                    })->values(),
                ] : null,
                'items' => $items,
                'refunds' => $refunds,
                'returns' => $returns,
                'status_timeline' => $statusTimeline,
                'allowed_next_statuses' => $orderStatusService->allowedTargetsFor($order),
                'can_refund' => $canRefund,
                'can_request_return' => in_array($order->status?->code, [
                    'paid',
                    'processing',
                    'shipped',
                    'delivered',
                ], true),
            ],
        ]);
    }

    public function export(string $locale, Request $request): StreamedResponse
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));
        $hasReturns = trim((string) $request->query('has_returns', ''));
        $hasRefunds = trim((string) $request->query('has_refunds', ''));

        $filename = 'orders_' . now()->format('Ymd_His') . '.csv';

        $query = $this->filteredOrdersQuery($q, $status, $dateFrom, $dateTo, $hasReturns, $hasRefunds)
            ->with([
                'user:id,name,email',
                'status:id,code,name',
                'currency:id,code,decimal_places',
            ])
            ->select([
                'id',
                'order_number',
                'user_id',
                'status_id',
                'currency_id',
                'subtotal_amount',
                'discount_amount',
                'tax_amount',
                'shipping_amount',
                'total_amount',
                'accepted_terms_at',
                'accepted_privacy_at',
                'accepted_terms_version',
                'accepted_privacy_version',
                'paid_at',
                'created_at',
            ])
            ->orderBy('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                __('ui.orders.export.id'),
                __('ui.orders.export.order_number'),
                __('ui.orders.export.customer_name'),
                __('ui.orders.export.customer_email'),
                __('ui.orders.export.status_code'),
                __('ui.orders.export.status_name'),
                __('ui.orders.export.currency'),
                __('ui.orders.export.decimal_places'),
                __('ui.orders.export.subtotal_amount_cents'),
                __('ui.orders.export.subtotal_amount'),
                __('ui.orders.export.discount_amount_cents'),
                __('ui.orders.export.discount_amount'),
                __('ui.orders.export.tax_amount_cents'),
                __('ui.orders.export.tax_amount'),
                __('ui.orders.export.shipping_amount_cents'),
                __('ui.orders.export.shipping_amount'),
                __('ui.orders.export.total_amount_cents'),
                __('ui.orders.export.total_amount'),
                __('ui.orders.export.accepted_terms_at'),
                __('ui.orders.export.accepted_privacy_at'),
                __('ui.orders.export.accepted_terms_version'),
                __('ui.orders.export.accepted_privacy_version'),
                __('ui.orders.export.paid_at'),
                __('ui.orders.export.created_at'),
            ]);

            $query->chunkById(1000, function ($rows) use ($out) {
                foreach ($rows as $o) {
                    $dp = (int) ($o->currency?->decimal_places ?? 2);

                    $subtotalDecimal = $this->toDecimalString((int) $o->subtotal_amount, $dp);
                    $discountDecimal = $this->toDecimalString((int) $o->discount_amount, $dp);
                    $taxDecimal = $this->toDecimalString((int) $o->tax_amount, $dp);
                    $shippingDecimal = $this->toDecimalString((int) $o->shipping_amount, $dp);
                    $totalDecimal = $this->toDecimalString((int) $o->total_amount, $dp);

                    fputcsv($out, [
                        $o->id,
                        $o->order_number,
                        $o->user?->name,
                        $o->user?->email,
                        $o->status?->code,
                        $o->status?->name,
                        $o->currency?->code,
                        $dp,
                        (int) $o->subtotal_amount,
                        $subtotalDecimal,
                        (int) $o->discount_amount,
                        $discountDecimal,
                        (int) $o->tax_amount,
                        $taxDecimal,
                        (int) $o->shipping_amount,
                        $shippingDecimal,
                        (int) $o->total_amount,
                        $totalDecimal,
                        optional($o->accepted_terms_at)->toISOString(),
                        optional($o->accepted_privacy_at)->toISOString(),
                        $o->accepted_terms_version,
                        $o->accepted_privacy_version,
                        optional($o->paid_at)->toISOString(),
                        optional($o->created_at)->toISOString(),
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportAccounting(string $locale, Request $request): StreamedResponse
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));
        $hasReturns = trim((string) $request->query('has_returns', ''));
        $hasRefunds = trim((string) $request->query('has_refunds', ''));

        $filename = 'orders_accounting_' . now()->format('Ymd_His') . '.csv';

        $query = $this->filteredOrdersQuery($q, $status, $dateFrom, $dateTo, $hasReturns, $hasRefunds)
            ->with([
                'user:id,name,email',
                'status:id,code,name',
                'currency:id,code,decimal_places',
            ])
            ->select([
                'id',
                'order_number',
                'user_id',
                'status_id',
                'currency_id',
                'subtotal_amount',
                'tax_amount',
                'shipping_amount',
                'total_amount',
                'paid_at',
                'created_at',
            ])
            ->orderBy('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                __('ui.orders.export_accounting.order_number'),
                __('ui.orders.export_accounting.created_at'),
                __('ui.orders.export_accounting.paid_at'),
                __('ui.orders.export_accounting.status_code'),
                __('ui.orders.export_accounting.status_name'),
                __('ui.orders.export_accounting.customer_name'),
                __('ui.orders.export_accounting.customer_email'),
                __('ui.orders.export_accounting.currency'),
                __('ui.orders.export_accounting.subtotal_amount_cents'),
                __('ui.orders.export_accounting.subtotal_amount'),
                __('ui.orders.export_accounting.tax_amount_cents'),
                __('ui.orders.export_accounting.tax_amount'),
                __('ui.orders.export_accounting.shipping_amount_cents'),
                __('ui.orders.export_accounting.shipping_amount'),
                __('ui.orders.export_accounting.total_amount_cents'),
                __('ui.orders.export_accounting.total_amount'),
            ]);

            $query->chunkById(1000, function ($rows) use ($out) {
                foreach ($rows as $o) {
                    $dp = (int) ($o->currency?->decimal_places ?? 2);

                    $subtotalDecimal = $this->toDecimalString((int) $o->subtotal_amount, $dp);
                    $taxDecimal = $this->toDecimalString((int) $o->tax_amount, $dp);
                    $shippingDecimal = $this->toDecimalString((int) $o->shipping_amount, $dp);
                    $totalDecimal = $this->toDecimalString((int) $o->total_amount, $dp);

                    fputcsv($out, [
                        $o->order_number,
                        optional($o->created_at)->toISOString(),
                        optional($o->paid_at)->toISOString(),
                        $o->status?->code,
                        $o->status?->name,
                        $o->user?->name,
                        $o->user?->email,
                        $o->currency?->code,
                        (int) $o->subtotal_amount,
                        $subtotalDecimal,
                        (int) $o->tax_amount,
                        $taxDecimal,
                        (int) $o->shipping_amount,
                        $shippingDecimal,
                        (int) $o->total_amount,
                        $totalDecimal,
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportItems(string $locale, Request $request): StreamedResponse
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));
        $hasReturns = trim((string) $request->query('has_returns', ''));
        $hasRefunds = trim((string) $request->query('has_refunds', ''));

        $filename = 'orders_items_' . now()->format('Ymd_His') . '.csv';

        $ordersSubQuery = $this->filteredOrdersQuery($q, $status, $dateFrom, $dateTo, $hasReturns, $hasRefunds)
            ->select('orders.id');

        $itemsQuery = OrderItem::query()
            ->whereIn('order_id', $ordersSubQuery)
            ->with([
                'order:id,order_number,currency_id,created_at,paid_at',
                'order.currency:id,code,decimal_places',
            ])
            ->select([
                'id',
                'order_id',
                'product_id',
                'variant_id',
                'sku',
                'name',
                'qty',
                'unit_amount',
                'total_amount',
            ])
            ->orderBy('id');

        return response()->streamDownload(function () use ($itemsQuery) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                __('ui.orders.export_items.order_id'),
                __('ui.orders.export_items.order_number'),
                __('ui.orders.export_items.order_created_at'),
                __('ui.orders.export_items.order_paid_at'),
                __('ui.orders.export_items.currency'),
                __('ui.orders.export_items.decimal_places'),
                __('ui.orders.export_items.item_id'),
                __('ui.orders.export_items.product_id'),
                __('ui.orders.export_items.variant_id'),
                __('ui.orders.export_items.sku'),
                __('ui.orders.export_items.name'),
                __('ui.orders.export_items.qty'),
                __('ui.orders.export_items.unit_amount_cents'),
                __('ui.orders.export_items.unit_amount'),
                __('ui.orders.export_items.line_total_cents'),
                __('ui.orders.export_items.line_total'),
            ]);

            $itemsQuery->chunkById(1000, function ($rows) use ($out) {
                foreach ($rows as $it) {
                    $order = $it->order;
                    $dp = (int) ($order?->currency?->decimal_places ?? 2);

                    $unitCents = is_null($it->unit_amount) ? null : (int) $it->unit_amount;
                    $lineCents = is_null($it->total_amount) ? null : (int) $it->total_amount;

                    $unitDecimal = is_null($unitCents) ? '' : $this->toDecimalString($unitCents, $dp);
                    $lineDecimal = is_null($lineCents) ? '' : $this->toDecimalString($lineCents, $dp);

                    fputcsv($out, [
                        $order?->id,
                        $order?->order_number,
                        optional($order?->created_at)->toISOString(),
                        optional($order?->paid_at)->toISOString(),
                        $order?->currency?->code,
                        $dp,
                        $it->id,
                        $it->product_id,
                        $it->variant_id,
                        $it->sku,
                        $it->name,
                        (int) $it->qty,
                        $unitCents,
                        $unitDecimal,
                        $lineCents,
                        $lineDecimal,
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function filteredOrdersQuery(
        string $q,
        string $status,
        string $dateFrom,
        string $dateTo,
        string $hasReturns = '',
        string $hasRefunds = ''
    ) {
        $query = Order::query();

        if ($q !== '') {
            $query->where(function ($qq) use ($q) {
                $qq->where('order_number', 'like', "%{$q}%")
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%{$q}%")->orWhere('name', 'like', "%{$q}%"));
            });
        }

        if ($status !== '') {
            $query->whereHas('status', fn ($s) => $s->where('code', $status));
        }

        if ($dateFrom !== '') {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        if ($hasReturns === '1') {
            $query->whereHas('returns');
        }

        if ($hasRefunds === '1') {
            $query->whereHas('refunds');
        }

        return $query;
    }

    private function toDecimalString(int $cents, int $decimalPlaces): string
    {
        $div = 10 ** max(0, $decimalPlaces);
        $value = $cents / $div;

        return number_format($value, $decimalPlaces, '.', '');
    }

    private function calculateProportionalLineAmount(
        int $lineTotalAmount,
        int $originalQty,
        int $partialQty
    ): int {
        if ($lineTotalAmount <= 0 || $originalQty <= 0 || $partialQty <= 0) {
            return 0;
        }

        if ($partialQty >= $originalQty) {
            return $lineTotalAmount;
        }

        return (int) floor(($lineTotalAmount * $partialQty) / $originalQty);
    }
}
