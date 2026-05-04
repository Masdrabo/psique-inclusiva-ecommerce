<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $days = (int) $request->query('days', 30);
        if (!in_array($days, [7, 14, 30, 60, 90], true)) {
            $days = 30;
        }

        $now = now();
        $start = $now->copy()->subDays($days - 1)->startOfDay();
        $end = $now->copy()->endOfDay();

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

        // Revenue por dia (qualquer encomenda efetivamente paga, por paid_at)
        $paidRows = DB::table('orders')
            ->whereNotNull('orders.paid_at')
            ->whereBetween('orders.paid_at', [$start, $end])
            ->selectRaw('DATE(orders.paid_at) as day, SUM(orders.total_amount) as revenue_cents, COUNT(*) as paid_orders')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        // Orders criadas por dia (todas, por created_at)
        $createdRows = DB::table('orders')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders_created')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $paidMap = [];
        foreach ($paidRows as $r) {
            $paidMap[(string) $r->day] = [
                'revenue_cents' => (int) $r->revenue_cents,
                'paid_orders' => (int) $r->paid_orders,
            ];
        }

        $createdMap = [];
        foreach ($createdRows as $r) {
            $createdMap[(string) $r->day] = (int) $r->orders_created;
        }

        $series = [];
        $cursor = $start->copy();

        while ($cursor <= $end) {
            $day = $cursor->toDateString();

            $series[] = [
                'day' => $day,
                'revenue_cents' => $paidMap[$day]['revenue_cents'] ?? 0,
                'paid_orders' => $paidMap[$day]['paid_orders'] ?? 0,
                'orders_created' => $createdMap[$day] ?? 0,
            ];

            $cursor->addDay();

            if (count($series) > 400) {
                break;
            }
        }

        // Breakdown de estados da encomenda (sem pós-venda)
        $statusBreakdown = DB::table('orders')
            ->join('order_statuses', 'orders.status_id', '=', 'order_statuses.id')
            ->whereBetween('orders.created_at', [$start, $end])
            ->whereNotIn('order_statuses.code', ['refunded', 'partially_refunded'])
            ->selectRaw('order_statuses.code as code, order_statuses.name as name, COUNT(*) as count')
            ->groupBy('code', 'name')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => [
                'code' => $r->code,
                'name' => $r->name,
                'count' => (int) $r->count,
            ])
            ->values();

        // Top produtos (pagos no período)
        $topProducts = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNotNull('orders.paid_at')
            ->whereBetween('orders.paid_at', [$start, $end])
            ->selectRaw('order_items.name as name, SUM(order_items.qty) as qty')
            ->groupBy('order_items.name')
            ->orderByDesc('qty')
            ->limit(20)
            ->get()
            ->map(fn ($r) => [
                'name' => $r->name ?? '(sem nome)',
                'qty' => (int) $r->qty,
            ])
            ->values();

        // Pós-venda real: devoluções
        $returnBreakdown = DB::table('returns')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => [
                'code' => 'return_' . $r->status,
                'count' => (int) $r->count,
            ]);

        // Pós-venda real: reembolsos
        // A tua tabela refunds real não tem coluna status disponível nesta BD,
        // por isso para já contamos o total do período.
        $refundCount = (int) DB::table('refunds')
            ->whereBetween('created_at', [$start, $end])
            ->count();

        $refundBreakdown = collect();

        if ($refundCount > 0) {
            $refundBreakdown->push([
                'code' => 'refund_total',
                'count' => $refundCount,
            ]);
        }

        $postSaleBreakdown = collect()
            ->concat($returnBreakdown)
            ->concat($refundBreakdown)
            ->sortByDesc('count')
            ->values();

        $periodRevenue = array_sum(array_map(fn ($x) => (int) $x['revenue_cents'], $series));
        $periodPaidOrders = array_sum(array_map(fn ($x) => (int) $x['paid_orders'], $series));
        $periodCreatedOrders = array_sum(array_map(fn ($x) => (int) $x['orders_created'], $series));

        return Inertia::render('Admin/Analytics', [
            'currency' => $currencyInfo,
            'days' => $days,
            'range' => [
                'start' => $start->toDateString(),
                'end' => $now->toDateString(),
            ],
            'totals' => [
                'revenue_cents' => (int) $periodRevenue,
                'paid_orders' => (int) $periodPaidOrders,
                'orders_created' => (int) $periodCreatedOrders,
            ],
            'series' => $series,
            'statusBreakdown' => $statusBreakdown,
            'postSaleBreakdown' => $postSaleBreakdown,
            'topProducts' => $topProducts,
        ]);
    }
}
