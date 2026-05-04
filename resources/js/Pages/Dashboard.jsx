import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaginationLinks from '@/Components/PaginationLinks';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? '€';
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
}

function badgeBase(extra = '') {
    return `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${extra}`;
}

function OrderStatusBadge({ status }) {
    const code = status?.code ?? '';
    const label = status?.name ?? status?.code ?? '-';

    if (code === 'cancelled') {
        return <span className={badgeBase('bg-red-100 text-red-700')}>{label}</span>;
    }

    if (code === 'pending_payment') {
        return <span className={badgeBase('bg-amber-100 text-amber-700')}>{label}</span>;
    }

    if (code === 'processing') {
        return <span className={badgeBase('bg-indigo-100 text-indigo-700')}>{label}</span>;
    }

    if (code === 'shipped') {
        return <span className={badgeBase('bg-blue-100 text-blue-700')}>{label}</span>;
    }

    if (code === 'delivered') {
        return <span className={badgeBase('bg-green-100 text-green-700')}>{label}</span>;
    }

    if (code === 'refunded') {
        return <span className={badgeBase('bg-purple-100 text-purple-700')}>{label}</span>;
    }

    return <span className={badgeBase('bg-gray-100 text-gray-700')}>{label}</span>;
}

function ShipmentBadge({ shipment, t }) {
    const status = shipment?.status ?? '';

    if (status === 'pending') {
        return (
            <span className={badgeBase('bg-amber-100 text-amber-700')}>
                {t('ui.shipments.status_pending', 'Pendente')}
            </span>
        );
    }

    if (status === 'shipped') {
        return (
            <span className={badgeBase('bg-blue-100 text-blue-700')}>
                {t('ui.shipments.status_shipped', 'Enviado')}
            </span>
        );
    }

    if (status === 'delivered') {
        return (
            <span className={badgeBase('bg-green-100 text-green-700')}>
                {t('ui.shipments.status_delivered', 'Entregue')}
            </span>
        );
    }

    if (status === 'returned') {
        return (
            <span className={badgeBase('bg-purple-100 text-purple-700')}>
                {t('ui.shipments.status_returned', 'Devolvido')}
            </span>
        );
    }

    if (status === 'cancelled') {
        return (
            <span className={badgeBase('bg-red-100 text-red-700')}>
                {t('ui.shipments.status_cancelled', 'Cancelado')}
            </span>
        );
    }

    return null;
}

function PaymentBadge({ payment, t }) {
    const status = payment?.status;

    if (status === 'refunded') {
        return (
            <span className={badgeBase('bg-purple-100 text-purple-700')}>
                {t('ui.refunds.payment_refunded_badge', 'Pagamento reembolsado')}
            </span>
        );
    }

    if (status === 'partially_refunded') {
        return (
            <span className={badgeBase('bg-orange-100 text-orange-700')}>
                {t('ui.refunds.payment_partial_refund_badge', 'Pagamento parcialmente reembolsado')}
            </span>
        );
    }

    if (status === 'paid') {
        return (
            <span className={badgeBase('bg-green-100 text-green-700')}>
                {t('ui.statuses.paid', 'Pago')}
            </span>
        );
    }

    if (status === 'pending') {
        return (
            <span className={badgeBase('bg-amber-100 text-amber-700')}>
                {t('ui.payments.pending', 'Pending')}
            </span>
        );
    }

    if (status === 'authorized') {
        return (
            <span className={badgeBase('bg-amber-100 text-amber-700')}>
                {t('ui.payments.authorized', 'Authorized')}
            </span>
        );
    }

    return null;
}

function RefundBadge({ refundedAmount, remainingAmount, totalAmount, t }) {
    const refunded = Number(refundedAmount ?? 0);
    const remaining = Number(remainingAmount ?? 0);
    const total = Number(totalAmount ?? 0);

    if (refunded <= 0) {
        return null;
    }

    if (total > 0 && remaining <= 0) {
        return (
            <span className={badgeBase('bg-purple-100 text-purple-700')}>
                {t('ui.refunds.full_refund_badge', 'Refund total')}
            </span>
        );
    }

    return (
        <span className={badgeBase('bg-orange-100 text-orange-700')}>
            {t('ui.refunds.partial_refund_badge', 'Refund parcial')}
        </span>
    );
}

function ReturnBadge({ returnsCount, openReturnsCount, t }) {
    const total = Number(returnsCount ?? 0);
    const open = Number(openReturnsCount ?? 0);

    if (total <= 0) {
        return null;
    }

    if (open > 0) {
        return (
            <span className={badgeBase('bg-blue-100 text-blue-700')}>
                {t('ui.returns.open_returns_badge', 'Devoluções abertas')}: {open}
            </span>
        );
    }

    return (
        <span className={badgeBase('bg-gray-100 text-gray-700')}>
            {t('ui.returns.returns_badge', 'Devoluções')}: {total}
        </span>
    );
}

function Chip({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                active
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50',
            ].join(' ')}
        >
            {children}
        </button>
    );
}

function CounterPill({ value }) {
    return (
        <span className="inline-flex items-center rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold leading-4">
            {value}
        </span>
    );
}

function SummaryCard({ label, value, sub, tone = 'text-gray-900' }) {
    return (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
            {sub ? <div className="mt-1 text-sm text-gray-600">{sub}</div> : null}
        </div>
    );
}

function EmptyState({ t, locale, onClear }) {
    return (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
            <div className="text-lg font-semibold text-gray-900">
                {t('ui.dashboard.no_orders_found_title', 'Nenhuma encomenda encontrada')}
            </div>
            <div className="mt-2 text-sm text-gray-600">
                {t(
                    'ui.dashboard.no_orders_found',
                    'No orders were found with the applied filters.'
                )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={onClear}
                    className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                    {t('ui.dashboard.clear_filters', 'Clear filters')}
                </button>

                <Link
                    href={route('shop.index', { locale })}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                    {t('ui.dashboard.go_to_shop', 'Ir para a loja')}
                </Link>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { t } = useI18n();
    const { locale, orders, filters, availableStatuses, summary, statusCounters } = usePage().props;

    const [q, setQ] = useState(filters?.q ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');

    useEffect(() => {
        setQ(filters?.q ?? '');
        setStatus(filters?.status ?? '');
    }, [filters?.q, filters?.status]);

    const data = orders?.data ?? [];

    const currencyForSummary = useMemo(() => {
        return data?.[0]?.currency ?? { symbol: '€', decimal_places: 2 };
    }, [data]);

    const countersMap = useMemo(() => {
        const m = new Map();
        (statusCounters ?? []).forEach((s) => m.set(s.code, s.count));
        return m;
    }, [statusCounters]);

    const totalAll = summary?.total_orders ?? 0;

    const chips = useMemo(() => {
        const base = [
            {
                code: '',
                name: t('ui.common.all', 'All'),
                count: totalAll,
            },
        ];

        const rest = (availableStatuses ?? []).map((s) => ({
            code: s.code,
            name: s.name,
            count: countersMap.get(s.code) ?? 0,
        }));

        return [...base, ...rest];
    }, [availableStatuses, countersMap, totalAll, t]);

    function goWith(next) {
        router.get(route('dashboard', { locale }), next, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    function applyFilters(e) {
        e.preventDefault();
        goWith({ q: q || undefined, status: status || undefined });
    }

    function clearFilters() {
        setQ('');
        setStatus('');
        goWith({});
    }

    function setStatusQuick(nextStatusCode) {
        const next = nextStatusCode ? nextStatusCode : '';
        setStatus(next);
        goWith({ q: q || undefined, status: next || undefined });
    }

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        {t('ui.common.dashboard', 'Dashboard')}
                    </h2>
                    <div className="mt-1 text-sm text-gray-600">
                        {t('ui.dashboard.orders_subtitle', 'Order history and status')}
                    </div>
                </div>
            }
        >
            <Head title={t('ui.common.dashboard', 'Dashboard')} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            label={t('ui.dashboard.total_orders', 'TOTAL ORDERS')}
                            value={summary?.total_orders ?? 0}
                            sub={t('ui.dashboard.total_orders_sub', 'All your orders')}
                        />

                        <SummaryCard
                            label={t('ui.dashboard.total_spent_paid', 'TOTAL SPENT (PAID)')}
                            value={formatMoney(summary?.total_spent_paid ?? 0, currencyForSummary)}
                            sub={t('ui.dashboard.total_spent_paid_sub', 'Paid orders only')}
                        />

                        <SummaryCard
                            label={t('ui.dashboard.pending_orders', 'PENDING')}
                            value={summary?.count_pending_payment ?? 0}
                            sub={t('ui.dashboard.pending_orders_sub', 'Waiting for payment')}
                            tone="text-amber-700"
                        />

                        <SummaryCard
                            label={t('ui.dashboard.paid_orders', 'PAID')}
                            value={summary?.count_paid ?? 0}
                            sub={t('ui.dashboard.paid_orders_sub', 'Confirmed')}
                            tone="text-green-700"
                        />
                    </div>

                    <div className="rounded-2xl border bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t('ui.dashboard.orders_title', 'Your orders')}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t('ui.dashboard.orders_subtitle', 'Order history and status')}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    <Link
                                        href={route('panel.donations.index', { locale })}
                                        className="text-sm font-medium text-emerald-700 underline"
                                    >
                                        Os meus donativos
                                    </Link>

                                    <Link
                                        href={route('shop.index', { locale })}
                                        className="text-sm font-medium text-gray-900 underline"
                                    >
                                        {t('ui.dashboard.continue_shopping', 'Continuar a comprar')}
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {chips.map((c) => (
                                    <Chip
                                        key={c.code || '__all__'}
                                        active={(status || '') === (c.code || '')}
                                        onClick={() => setStatusQuick(c.code)}
                                    >
                                        <span>{c.name}</span>
                                        <CounterPill value={c.count} />
                                    </Chip>
                                ))}
                            </div>

                            <form onSubmit={applyFilters} className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px_auto]">
                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t('ui.dashboard.search_order_number', 'Search order number')}
                                    </label>
                                    <input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        placeholder={t('ui.dashboard.search_order_number_placeholder', 'ORD-2026...')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t('ui.orders.status', 'Status')}
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    >
                                        <option value="">{t('ui.common.all', 'All')}</option>
                                        {(availableStatuses ?? []).map((s) => (
                                            <option key={s.code} value={s.code}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-2 lg:self-end">
                                    <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                                        {t('ui.orders.apply', 'Apply')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                    >
                                        {t('ui.orders.clear', 'Clear')}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 space-y-4">
                                {data.length === 0 ? (
                                    <EmptyState t={t} locale={locale} onClear={clearFilters} />
                                ) : (
                                    data.map((o) => (
                                        <div key={o.id} className="rounded-2xl border p-5 transition hover:bg-gray-50/50">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0 space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-base font-semibold text-gray-900">
                                                            #{o.order_number}
                                                        </div>
                                                        <OrderStatusBadge status={o.status} />
                                                        <ShipmentBadge shipment={o.shipment} t={t} />
                                                        <RefundBadge
                                                            refundedAmount={o.refunded_total_amount}
                                                            remainingAmount={o.remaining_refundable_amount}
                                                            totalAmount={o.amounts?.total}
                                                            t={t}
                                                        />
                                                        <ReturnBadge
                                                            returnsCount={o.returns_count}
                                                            openReturnsCount={o.open_returns_count}
                                                            t={t}
                                                        />
                                                        <PaymentBadge payment={o.payment} t={t} />
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-3">
                                                        <div>
                                                            {t('ui.dashboard.order_date', 'Date')}:{' '}
                                                            <span className="font-medium">{formatDate(o.created_at)}</span>
                                                        </div>
                                                        <div>
                                                            {t('ui.dashboard.order_items', 'Items')}:{' '}
                                                            <span className="font-medium">{o.items_count}</span>
                                                        </div>
                                                        <div>
                                                            {t('ui.thankyou.total', 'Total')}:{' '}
                                                            <span className="font-medium">
                                                                {formatMoney(o.amounts?.total, o.currency)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {o.shipment ? (
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                                                            <div>
                                                                <span className="font-medium text-gray-900">
                                                                    {t('ui.shipments.method', 'Método')}:
                                                                </span>{' '}
                                                                {o.shipment?.method?.name ?? '-'}
                                                            </div>

                                                            <div>
                                                                <span className="font-medium text-gray-900">
                                                                    {t('ui.orders.tracking_number', 'Tracking')}:
                                                                </span>{' '}
                                                                {o.shipment?.tracking_number ?? '-'}
                                                            </div>

                                                            {o.shipment?.shipped_at ? (
                                                                <div>
                                                                    <span className="font-medium text-blue-700">
                                                                        {t('ui.shipments.shipped_at', 'Enviado em')}:
                                                                    </span>{' '}
                                                                    {formatDate(o.shipment.shipped_at)}
                                                                </div>
                                                            ) : null}

                                                            {o.shipment?.delivered_at ? (
                                                                <div>
                                                                    <span className="font-medium text-green-700">
                                                                        {t('ui.shipments.delivered_at', 'Entregue em')}:
                                                                    </span>{' '}
                                                                    {formatDate(o.shipment.delivered_at)}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ) : null}

                                                    {(Number(o.refunded_total_amount ?? 0) > 0 || Number(o.remaining_refundable_amount ?? 0) > 0) && (
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                                                            <div>
                                                                <span className="font-medium text-orange-700">
                                                                    {t('ui.refunds.title', 'Refunds')}:
                                                                </span>{' '}
                                                                {formatMoney(o.refunded_total_amount ?? 0, o.currency)}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-green-700">
                                                                    {t('ui.refunds.remaining', 'Remaining refundable')}:
                                                                </span>{' '}
                                                                {formatMoney(o.remaining_refundable_amount ?? 0, o.currency)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {Number(o.returns_count ?? 0) > 0 ? (
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                                                            <div>
                                                                <span className="font-medium text-blue-700">
                                                                    {t('ui.returns.returns_badge', 'Devoluções')}:
                                                                </span>{' '}
                                                                {o.returns_count}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-indigo-700">
                                                                    {t('ui.returns.open_returns_badge', 'Devoluções abertas')}:
                                                                </span>{' '}
                                                                {o.open_returns_count ?? 0}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="flex shrink-0 items-center gap-3 lg:flex-col lg:items-end">
                                                    <div className="text-lg font-semibold text-gray-900">
                                                        {formatMoney(o.amounts?.total, o.currency)}
                                                    </div>

                                                    <Link
                                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                                        href={route('panel.orders.show', { locale, order: o.id })}
                                                    >
                                                        {t('ui.dashboard.view_order_detail', 'View detail')}
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <PaginationLinks links={orders?.links ?? []} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
