<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Refund;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RefundManagementController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $dateFrom = trim((string) $request->query('date_from', ''));
        $dateTo = trim((string) $request->query('date_to', ''));

        $refunds = $this->filteredRefundsQuery($q, $dateFrom, $dateTo)
            ->with([
                'order:id,order_number,user_id,currency_id',
                'order.user:id,name,email',
                'order.currency:id,code,symbol,decimal_places',
                'createdBy:id,name,email',
            ])
            ->select([
                'id',
                'order_id',
                'payment_id',
                'amount',
                'reason',
                'notes',
                'created_by_user_id',
                'created_at',
            ])
            ->latest('created_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(function (Refund $refund) {
                return [
                    'id' => (int) $refund->id,
                    'label' => 'RF-' . str_pad((string) $refund->id, 6, '0', STR_PAD_LEFT),
                    'amount' => (int) $refund->amount,
                    'reason' => $refund->reason,
                    'notes' => $refund->notes,
                    'created_at' => optional($refund->created_at)?->toISOString(),
                    'order' => [
                        'id' => (int) $refund->order?->id,
                        'order_number' => $refund->order?->order_number,
                    ],
                    'customer' => [
                        'name' => $refund->order?->user?->name,
                        'email' => $refund->order?->user?->email,
                    ],
                    'created_by' => [
                        'name' => $refund->createdBy?->name,
                        'email' => $refund->createdBy?->email,
                    ],
                    'currency' => [
                        'code' => $refund->order?->currency?->code,
                        'symbol' => $refund->order?->currency?->symbol,
                        'decimal_places' => (int) ($refund->order?->currency?->decimal_places ?? 2),
                    ],
                ];
            });

        return Inertia::render('Admin/Refunds/Index', [
            'refunds' => $refunds,
            'filters' => [
                'q' => $q,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    private function filteredRefundsQuery(
        string $q,
        string $dateFrom,
        string $dateTo
    ): Builder {
        $query = Refund::query();

        if ($q !== '') {
            $query->where(function (Builder $qq) use ($q) {
                $qq->where('reason', 'like', "%{$q}%")
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

        if ($dateFrom !== '') {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        return $query;
    }
}
