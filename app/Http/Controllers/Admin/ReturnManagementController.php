<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderReturn;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReturnManagementController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $scope = trim((string) $request->query('scope', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));

        if (!in_array($scope, ['', 'open', 'closed'], true)) {
            $scope = '';
        }

        $openStatuses = ['requested', 'approved', 'received'];
        $closedStatuses = ['closed', 'rejected'];

        $returns = $this->filteredReturnsQuery($q, $status, $scope, $dateFrom, $dateTo, $openStatuses, $closedStatuses)
            ->with([
                'order:id,order_number,user_id,currency_id',
                'order.user:id,name,email',
                'order.currency:id,code,symbol,decimal_places',
                'items:id,return_id,order_item_id,qty,resolution',
                'items.orderItem:id,unit_amount',
            ])
            ->select([
                'id',
                'order_id',
                'return_number',
                'status',
                'reason',
                'notes',
                'requested_at',
                'approved_at',
                'received_at',
                'closed_at',
                'created_at',
            ])
            ->orderByRaw("
                CASE
                    WHEN status IN ('requested', 'approved', 'received') THEN 0
                    ELSE 1
                END
            ")
            ->orderByRaw('COALESCE(requested_at, created_at) DESC')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(function (OrderReturn $return) {
                $estimatedAmount = (int) $return->items->sum(function ($item) {
                    $unitAmount = (int) ($item->orderItem?->unit_amount ?? 0);
                    $qty = (int) ($item->qty ?? 0);

                    return $unitAmount * $qty;
                });

                $totalQty = (int) $return->items->sum('qty');

                return [
                    'id' => (int) $return->id,
                    'return_number' => $return->return_number,
                    'status' => $return->status,
                    'reason' => $return->reason,
                    'notes' => $return->notes,
                    'qty' => $totalQty,
                    'amount' => $estimatedAmount,
                    'requested_at' => optional($return->requested_at ?? $return->created_at)?->toISOString(),
                    'approved_at' => optional($return->approved_at)?->toISOString(),
                    'received_at' => optional($return->received_at)?->toISOString(),
                    'closed_at' => optional($return->closed_at)?->toISOString(),
                    'order' => [
                        'id' => (int) $return->order?->id,
                        'order_number' => $return->order?->order_number,
                    ],
                    'customer' => [
                        'name' => $return->order?->user?->name,
                        'email' => $return->order?->user?->email,
                    ],
                    'currency' => [
                        'code' => $return->order?->currency?->code,
                        'symbol' => $return->order?->currency?->symbol,
                        'decimal_places' => (int) ($return->order?->currency?->decimal_places ?? 2),
                    ],
                ];
            });

        $availableStatuses = [
            ['value' => '', 'label' => __('ui.common.all')],
            ['value' => 'requested', 'label' => __('ui.admin.return_status_requested')],
            ['value' => 'approved', 'label' => __('ui.admin.return_status_approved')],
            ['value' => 'received', 'label' => __('ui.admin.return_status_received')],
            ['value' => 'closed', 'label' => __('ui.admin.return_status_closed')],
            ['value' => 'rejected', 'label' => __('ui.admin.return_status_rejected')],
        ];

        $availableScopes = [
            ['value' => '', 'label' => __('ui.admin.return_scope_all')],
            ['value' => 'open', 'label' => __('ui.admin.return_scope_open')],
            ['value' => 'closed', 'label' => __('ui.admin.return_scope_closed')],
        ];

        return Inertia::render('Admin/Returns/Index', [
            'returns' => $returns,
            'filters' => [
                'q' => $q,
                'status' => $status,
                'scope' => $scope,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'availableStatuses' => $availableStatuses,
            'availableScopes' => $availableScopes,
        ]);
    }

    private function filteredReturnsQuery(
        string $q,
        string $status,
        string $scope,
        string $dateFrom,
        string $dateTo,
        array $openStatuses,
        array $closedStatuses
    ): Builder {
        $query = OrderReturn::query();

        if ($q !== '') {
            $query->where(function (Builder $qq) use ($q) {
                $qq->where('return_number', 'like', "%{$q}%")
                    ->orWhere('reason', 'like', "%{$q}%")
                    ->orWhere('notes', 'like', "%{$q}%")
                    ->orWhereHas('order', function (Builder $orderQuery) use ($q) {
                        $orderQuery->where('order_number', 'like', "%{$q}%")
                            ->orWhereHas('user', function (Builder $userQuery) use ($q) {
                                $userQuery->where('name', 'like', "%{$q}%")
                                    ->orWhere('email', 'like', "%{$q}%");
                            });
                    });
            });
        }

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($scope === 'open') {
            $query->whereIn('status', $openStatuses);
        } elseif ($scope === 'closed') {
            $query->whereIn('status', $closedStatuses);
        }

        if ($dateFrom !== '') {
            $query->whereDate('requested_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $query->whereDate('requested_at', '<=', $dateTo);
        }

        return $query;
    }
}
