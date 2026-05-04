<?php

namespace App\Http\Controllers;

use App\Actions\Cart\ReorderFromOrderAction;
use App\Models\Order;
use App\Models\OrderStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PanelController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $user = $request->user();
        abort_unless($user, 403);

        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));

        $totalOrders = (int) Order::query()
            ->where('user_id', $user->id)
            ->count();

        $countPaid = (int) Order::query()
            ->where('user_id', $user->id)
            ->whereNotNull('paid_at')
            ->count();

        $countPending = (int) Order::query()
            ->where('user_id', $user->id)
            ->whereHas('status', fn ($s) => $s->where('code', 'pending_payment'))
            ->count();

        $totalSpentPaid = (int) Order::query()
            ->where('user_id', $user->id)
            ->whereNotNull('paid_at')
            ->sum('total_amount');

        $countsByStatus = Order::query()
            ->selectRaw('order_statuses.code as code, order_statuses.name as name, COUNT(orders.id) as count')
            ->join('order_statuses', 'orders.status_id', '=', 'order_statuses.id')
            ->where('orders.user_id', $user->id)
            ->groupBy('order_statuses.code', 'order_statuses.name')
            ->orderBy('order_statuses.id')
            ->get()
            ->map(fn ($row) => [
                'code' => $row->code,
                'name' => $row->name,
                'count' => (int) $row->count,
            ])
            ->values();

        $availableStatuses = OrderStatus::query()
            ->select(['id', 'code', 'name'])
            ->orderBy('id')
            ->get()
            ->map(fn ($s) => [
                'code' => $s->code,
                'name' => $s->name,
            ])
            ->values();

        $ordersQuery = Order::query()
            ->where('user_id', $user->id);

        if ($q !== '') {
            $ordersQuery->where('order_number', 'like', "%{$q}%");
        }

        if ($status !== '') {
            $ordersQuery->whereHas('status', fn ($s) => $s->where('code', $status));
        }

        $orders = $ordersQuery
            ->with([
                'status:id,code,name',
                'currency:id,code,symbol,decimal_places',
                'items:id,order_id,qty',
                'payment:id,order_id,payment_method_id,status,paid_at',
                'payment.method:id,code,name',
                'shipment:id,order_id,shipping_method_id,status,tracking_number,shipped_at,delivered_at',
                'shipment.method:id,code,name',
                'refunds:id,order_id,amount',
                'returns:id,order_id,status',
            ])
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(function (Order $o) {
                $payment = $o->payment;
                $shipment = $o->shipment;

                $refundedTotalAmount = (int) $o->refunds->sum('amount');
                $remainingRefundableAmount = max(0, (int) $o->total_amount - $refundedTotalAmount);

                $returnsCount = (int) $o->returns->count();
                $openReturnsCount = (int) $o->returns
                    ->whereIn('status', ['requested', 'approved', 'received'])
                    ->count();

                $hasPartialRefund = $refundedTotalAmount > 0 && $refundedTotalAmount < (int) $o->total_amount;
                $hasFullRefund = $refundedTotalAmount > 0 && $refundedTotalAmount >= (int) $o->total_amount;

                return [
                    'id' => (int) $o->id,
                    'order_number' => $o->order_number,
                    'created_at' => optional($o->created_at)->toISOString(),
                    'paid_at' => optional($o->paid_at)->toISOString(),

                    'status' => [
                        'code' => $o->status?->code,
                        'name' => $o->status?->name,
                    ],

                    'currency' => [
                        'code' => $o->currency?->code,
                        'symbol' => $o->currency?->symbol,
                        'decimal_places' => (int) ($o->currency?->decimal_places ?? 2),
                    ],

                    'amounts' => [
                        'total' => (int) $o->total_amount,
                    ],

                    'items_count' => (int) $o->items->sum('qty'),

                    'payment' => $payment ? [
                        'status' => $payment->status,
                        'paid_at' => optional($payment->paid_at)->toISOString(),
                        'method' => [
                            'code' => $payment->method?->code,
                            'name' => $payment->method?->name,
                        ],
                    ] : null,

                    'shipment' => $shipment ? [
                        'status' => $shipment->status,
                        'method' => [
                            'code' => $shipment->method?->code,
                            'name' => $shipment->method?->name,
                        ],
                        'tracking_number' => $shipment->tracking_number,
                        'shipped_at' => optional($shipment->shipped_at)->toISOString(),
                        'delivered_at' => optional($shipment->delivered_at)->toISOString(),
                    ] : null,

                    'refunded_total_amount' => $refundedTotalAmount,
                    'remaining_refundable_amount' => $remainingRefundableAmount,
                    'has_partial_refund' => $hasPartialRefund,
                    'has_full_refund' => $hasFullRefund,

                    'returns_count' => $returnsCount,
                    'open_returns_count' => $openReturnsCount,
                ];
            });

        return Inertia::render('Dashboard', [
            'orders' => $orders,
            'filters' => [
                'q' => $q,
                'status' => $status,
            ],
            'availableStatuses' => $availableStatuses,
            'summary' => [
                'total_orders' => $totalOrders,
                'total_spent_paid' => $totalSpentPaid,
                'count_pending_payment' => $countPending,
                'count_paid' => $countPaid,
            ],
            'statusCounters' => $countsByStatus,
        ]);
    }

    public function show(string $locale, Request $request, Order $order): Response
{
    $user = $request->user();
    abort_unless($user, 403);

    $this->authorize('view', $order);

    $order->load([
        'items.product',
        'items.refundItems',
        'items.returnItems.return',
        'status',
        'currency',
        'payment.method',
        'shipment.method',
        'refunds.items.orderItem',
        'returns.items.orderItem.product',
        'returns.requestedBy:id,name,email',
        'returns.approvedBy:id,name,email',
        'returns.receivedBy:id,name,email',
        'statusHistory.status:id,code,name',
    ]);

    $payment = $order->payment;
    $shipment = $order->shipment;

    $refundedTotalAmount = (int) $order->refunds->sum('amount');
    $remainingRefundableAmount = max(0, (int) $order->total_amount - $refundedTotalAmount);

    $hasPartialRefund = $refundedTotalAmount > 0 && $refundedTotalAmount < (int) $order->total_amount;
    $hasFullRefund = $refundedTotalAmount > 0 && $refundedTotalAmount >= (int) $order->total_amount;

    $items = $order->items->map(function ($it) {
        $refundedQty = (int) $it->refundItems->sum('qty');

        $returnedQty = (int) $it->returnItems
            ->filter(fn ($returnItem) => !in_array($returnItem->return?->status, ['rejected', 'cancelled'], true))
            ->sum('qty');

        return [
            'id' => (int) $it->id,
            'name' => $it->name,
            'sku' => $it->sku,
            'qty' => (int) $it->qty,
            'unit_amount' => (int) $it->unit_amount,
            'total_amount' => (int) $it->total_amount,
            'refunded_qty' => $refundedQty,
            'returned_qty' => $returnedQty,
            'remaining_refundable_qty' => max(0, (int) $it->qty - $refundedQty),
            'remaining_returnable_qty' => max(0, (int) $it->qty - $returnedQty),
            'is_inventory_product' => (bool) ($it->product?->manages_inventory ?? false),
        ];
    })->values();

    $returns = $order->returns
        ->sortByDesc(function ($return) {
            return optional($return->requested_at ?? $return->created_at)->timestamp ?? 0;
        })
        ->values()
        ->map(function ($return) {
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
                'items' => $return->items->map(function ($item) {
                    return [
                        'id' => (int) $item->id,
                        'order_item_id' => (int) $item->order_item_id,
                        'qty' => (int) $item->qty,
                        'received_qty' => (int) $item->received_qty,
                        'restock_qty' => (int) $item->restock_qty,
                        'reason' => $item->reason,
                        'condition' => $item->condition,
                        'resolution' => $item->resolution,
                        'item_name' => $item->orderItem?->name,
                        'item_sku' => $item->orderItem?->sku,
                        'is_inventory_product' => (bool) ($item->orderItem?->product?->manages_inventory ?? false),
                        'exchange_shipped_qty' => (int) ($item->exchange_shipped_qty ?? 0),
                        'exchange_tracking_number' => $item->exchange_tracking_number,
                        'exchange_shipped_at' => optional($item->exchange_shipped_at)->toISOString(),
                        'exchange_notes' => $item->exchange_notes,
                    ];
                })->values(),
            ];
        });

    $refunds = $order->refunds
        ->sortByDesc(function ($refund) {
            return optional($refund->created_at)->timestamp ?? 0;
        })
        ->values()
        ->map(function ($refund) {
            return [
                'id' => (int) $refund->id,
                'amount' => (int) $refund->amount,
                'reason' => $refund->reason,
                'notes' => $refund->notes,
                'created_at' => optional($refund->created_at)->toISOString(),
                'items' => $refund->items->map(function ($item) {
                    return [
                        'id' => (int) $item->id,
                        'order_item_id' => (int) $item->order_item_id,
                        'qty' => (int) $item->qty,
                        'amount' => (int) $item->amount,
                        'item_name' => $item->orderItem?->name,
                        'item_sku' => $item->orderItem?->sku,
                    ];
                })->values(),
            ];
        });

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

    $windowDays = max(1, (int) config('returns.window_days', 14));
    $deliveredAt = $shipment?->delivered_at;
    $windowStartsAt = $deliveredAt ? $deliveredAt->copy() : null;
    $windowEndsAt = $deliveredAt ? $deliveredAt->copy()->addDays($windowDays)->endOfDay() : null;
    $now = now();

    $hasReturnableItems = $items->contains(fn ($item) => (int) $item['remaining_returnable_qty'] > 0);
    $isDelivered = $order->status?->code === 'delivered';
    $isWithinReturnWindow = $windowEndsAt ? $now->lte($windowEndsAt) : false;
    $isReturnWindowExpired = $windowEndsAt ? $now->gt($windowEndsAt) : false;

    $canRequestReturn = $isDelivered
        && $hasReturnableItems
        && $isWithinReturnWindow;

    return Inertia::render('Panel/OrderShow', [
        'order' => [
            'id' => (int) $order->id,
            'order_number' => $order->order_number,
            'created_at' => optional($order->created_at)->toISOString(),
            'paid_at' => optional($order->paid_at)->toISOString(),

            'status' => [
                'code' => $order->status?->code,
                'name' => $order->status?->name,
            ],

            'amounts' => [
                'subtotal' => (int) $order->subtotal_amount,
                'shipping' => (int) $order->shipping_amount,
                'tax' => (int) $order->tax_amount,
                'discount' => (int) $order->discount_amount,
                'total' => (int) $order->total_amount,
            ],

            'currency' => [
                'code' => $order->currency?->code,
                'symbol' => $order->currency?->symbol,
                'decimal_places' => (int) ($order->currency?->decimal_places ?? 2),
            ],

            'is_pickup' => (bool) (($shipment?->method?->code ?? null) === 'pickup'),
            'shipping_label' => (($shipment?->method?->code ?? null) === 'pickup')
                ? __('ui.orders.pickup_in_store')
                : ($shipment?->method?->name ?? null),

            'billing_address' => $order->billing_address,
            'shipping_address' => $order->shipping_address,

            'items' => $items,

            'payment' => $payment ? [
                'status' => $payment->status,
                'paid_at' => optional($payment->paid_at)->toISOString(),
                'provider' => $payment->provider,
                'entity' => $payment->entity,
                'reference' => $payment->reference,
                'provider_payment_id' => $payment->provider_payment_id,
                'expires_at' => optional($payment->expires_at)->toISOString(),
                'amount' => (int) $payment->amount,
                'method' => [
                    'code' => $payment->method?->code,
                    'name' => $payment->method?->name,
                ],
            ] : null,

            'shipment' => $shipment ? [
                'status' => $shipment->status,
                'method' => [
                    'code' => $shipment->method?->code,
                    'name' => $shipment->method?->name,
                ],
                'tracking_number' => $shipment->tracking_number,
                'shipped_at' => optional($shipment->shipped_at)->toISOString(),
                'delivered_at' => optional($shipment->delivered_at)->toISOString(),
            ] : null,

            'refunds' => $refunds,
            'returns' => $returns,
            'status_timeline' => $statusTimeline,

            'refunded_total_amount' => $refundedTotalAmount,
            'remaining_refundable_amount' => $remainingRefundableAmount,
            'has_partial_refund' => $hasPartialRefund,
            'has_full_refund' => $hasFullRefund,
            'can_request_return' => $canRequestReturn,

            'return_policy' => [
                'window_days' => $windowDays,
                'starts_at' => optional($windowStartsAt)->toISOString(),
                'ends_at' => optional($windowEndsAt)->toISOString(),
                'is_within_window' => $isWithinReturnWindow,
                'is_expired' => $isReturnWindowExpired,
                'has_returnable_items' => $hasReturnableItems,
                'requires_delivered_status' => true,
            ],
        ],
    ]);
}

    public function reorder(
        string $locale,
        Request $request,
        Order $order,
        ReorderFromOrderAction $action
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $this->authorize('view', $order);

        $result = $action->execute($user, $order);

        $added = (int) $result['added_lines'];
        $skipped = $result['skipped'] ?? [];

        $successMsg = $added > 0
            ? __('ui.panel.reorder_added', ['count' => $added])
            : __('ui.panel.reorder_none_added');

        if (count($skipped) > 0) {
            $reasons = collect($skipped)
                ->take(3)
                ->map(fn ($x) => ($x['name'] ?? $x['sku'] ?? __('ui.common.item', 'Item')) . ' (' . ($x['reason'] ?? __('ui.panel.reorder_reason_unavailable')) . ')')
                ->implode(' · ');

            $errorMsg = __('ui.panel.reorder_some_skipped', ['items' => $reasons]);

            if (count($skipped) > 3) {
                $errorMsg .= ' · ' . __('ui.panel.reorder_more_items', [
                    'count' => count($skipped) - 3,
                ]);
            }

            return redirect()
                ->route('cart.index', ['locale' => $locale])
                ->with('success', $successMsg)
                ->with('error', $errorMsg);
        }

        return redirect()
            ->route('cart.index', ['locale' => $locale])
            ->with('success', $successMsg);
    }
}
