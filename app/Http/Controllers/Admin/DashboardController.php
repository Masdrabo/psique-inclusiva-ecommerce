<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\OrderReturn;
use App\Models\Refund;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $now = now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd = $now->copy()->endOfMonth();

        $currency = Currency::query()
            ->select(['id', 'code', 'symbol', 'decimal_places'])
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()
                ->select(['id', 'code', 'symbol', 'decimal_places'])
                ->where('is_active', true)
                ->first();

        $currencyInfo = $currency ? [
            'code' => $currency->code,
            'symbol' => $currency->symbol,
            'decimal_places' => (int) $currency->decimal_places,
        ] : [
            'code' => 'EUR',
            'symbol' => '€',
            'decimal_places' => 2,
        ];

        // Faturação de hoje:
        // conta qualquer encomenda efetivamente paga hoje, independentemente do estado atual
        $revenueToday = (int) DB::table('orders')
            ->whereNotNull('orders.paid_at')
            ->whereBetween('orders.paid_at', [$todayStart, $todayEnd])
            ->sum('orders.total_amount');

        // Encomendas criadas hoje
        $ordersToday = (int) DB::table('orders')
            ->whereBetween('created_at', [$todayStart, $todayEnd])
            ->count();

        // Faturação do mês:
        // conta qualquer encomenda efetivamente paga neste mês, independentemente do estado atual
        $revenueMonth = (int) DB::table('orders')
            ->whereNotNull('orders.paid_at')
            ->whereBetween('orders.paid_at', [$monthStart, $monthEnd])
            ->sum('orders.total_amount');

        // Encomendas criadas no mês
        $ordersMonth = (int) DB::table('orders')
            ->whereBetween('created_at', [$monthStart, $monthEnd])
            ->count();

        $returnsOpen = (int) DB::table('returns')
            ->whereIn('status', ['requested', 'approved', 'received'])
            ->count();

        $returnsTotal = (int) DB::table('returns')->count();

        $ordersWithRefunds = (int) DB::table('refunds')
            ->whereNotNull('order_id')
            ->distinct()
            ->count('order_id');

        $refundsMonth = (int) DB::table('refunds')
            ->whereBetween('created_at', [$monthStart, $monthEnd])
            ->sum('amount');

        $recentReturns = OrderReturn::query()
            ->with(['order.user'])
            ->latest('requested_at')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(function (OrderReturn $return) {
                return [
                    'type' => 'return',
                    'id' => (int) $return->id,
                    'order_id' => (int) $return->order_id,
                    'order_number' => $return->order?->order_number,
                    'customer_name' => $return->order?->user?->name,
                    'customer_email' => $return->order?->user?->email,
                    'status' => $return->status,
                    'label' => $return->return_number,
                    'amount' => null,
                    'created_at' => optional($return->requested_at ?? $return->created_at)->toISOString(),
                    'sort_at' => optional($return->requested_at ?? $return->created_at)->timestamp ?? 0,
                ];
            });

        $recentRefunds = Refund::query()
            ->with(['order.user'])
            ->latest('created_at')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(function (Refund $refund) {
                return [
                    'type' => 'refund',
                    'id' => (int) $refund->id,
                    'order_id' => (int) $refund->order_id,
                    'order_number' => $refund->order?->order_number,
                    'customer_name' => $refund->order?->user?->name,
                    'customer_email' => $refund->order?->user?->email,
                    'status' => 'refunded',
                    'label' => 'REF-' . $refund->id,
                    'amount' => (int) $refund->amount,
                    'created_at' => optional($refund->created_at)->toISOString(),
                    'sort_at' => optional($refund->created_at)->timestamp ?? 0,
                ];
            });

        $recentClaims = $recentReturns
            ->concat($recentRefunds)
            ->sortByDesc('sort_at')
            ->take(8)
            ->map(function (array $row) {
                unset($row['sort_at']);
                return $row;
            })
            ->values();

        return Inertia::render('Admin/Dashboard', [
            'kpis' => [
                'revenue_today' => $revenueToday,
                'orders_today' => $ordersToday,
                'revenue_month' => $revenueMonth,
                'orders_month' => $ordersMonth,
                'returns_open' => $returnsOpen,
                'returns_total' => $returnsTotal,
                'orders_with_refunds' => $ordersWithRefunds,
                'refunds_month' => $refundsMonth,
            ],
            'currency' => $currencyInfo,
            'recentClaims' => $recentClaims,
            'meta' => [
                'today' => $todayStart->toDateString(),
                'month' => $monthStart->toDateString(),
            ],
        ]);
    }
}
