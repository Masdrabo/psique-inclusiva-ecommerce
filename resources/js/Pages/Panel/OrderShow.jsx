import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? '€';
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
}

function formatDateOnly(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
}

function formatAddress(address) {
    if (!address || typeof address !== 'object') return '—';

    const parts = [
        address.name,
        address.line1,
        address.line2,
        [address.postal_code, address.city].filter(Boolean).join(' '),
        address.region,
        address.country_code,
    ].filter(Boolean);

    return parts.join('\n');
}

function badgeBase(extra = '') {
    return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${extra}`;
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

function RefundBadge({ order, t }) {
    const refundedAmount = Number(order?.refunded_total_amount ?? 0);
    const totalAmount = Number(order?.amounts?.total ?? 0);
    const remaining = Number(order?.remaining_refundable_amount ?? 0);

    if (refundedAmount <= 0) {
        return null;
    }

    if (totalAmount > 0 && remaining <= 0) {
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

function ReturnSummaryBadge({ order, t }) {
    const returns = Array.isArray(order?.returns) ? order.returns : [];
    if (returns.length <= 0) {
        return null;
    }

    const open = returns.filter((ret) =>
        ['requested', 'approved', 'received'].includes(ret?.status)
    ).length;

    if (open > 0) {
        return (
            <span className={badgeBase('bg-blue-100 text-blue-700')}>
                {t('ui.returns.open_returns_badge', 'Devoluções abertas')}: {open}
            </span>
        );
    }

    return (
        <span className={badgeBase('bg-gray-100 text-gray-700')}>
            {t('ui.returns.returns_badge', 'Devoluções')}: {returns.length}
        </span>
    );
}

function ShipmentStatusBadge({ status, t }) {
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

    return <span className={badgeBase('bg-gray-100 text-gray-700')}>{status ?? '-'}</span>;
}

function returnStatusBadge(status, t) {
    if (status === 'requested') {
        return <span className={badgeBase('bg-amber-100 text-amber-700')}>{t('ui.returns.requested', 'Pedida')}</span>;
    }

    if (status === 'approved') {
        return <span className={badgeBase('bg-blue-100 text-blue-700')}>{t('ui.returns.approved', 'Aprovada')}</span>;
    }

    if (status === 'received') {
        return <span className={badgeBase('bg-green-100 text-green-700')}>{t('ui.returns.received', 'Recebida')}</span>;
    }

    if (status === 'closed') {
        return <span className={badgeBase('bg-gray-900 text-white')}>{t('ui.returns.closed', 'Fechada')}</span>;
    }

    if (status === 'rejected') {
        return <span className={badgeBase('bg-red-100 text-red-700')}>{t('ui.returns.rejected', 'Rejeitada')}</span>;
    }

    return <span className={badgeBase('bg-gray-100 text-gray-700')}>{status ?? '-'}</span>;
}

function SectionCard({ title, subtitle, children }) {
    return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-1">
                <div className="text-lg font-semibold text-gray-900">{title}</div>
                {subtitle ? <div className="text-sm text-gray-600">{subtitle}</div> : null}
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

function SummaryStat({ label, value, tone = 'text-gray-900' }) {
    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
        </div>
    );
}

function InfoBox({ children }) {
    return (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {children}
        </div>
    );
}

function CopyButton({ value, label, t }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            alert(t('ui.thankyou.copied', 'Copiado!'));
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
        >
            {copied ? t('ui.thankyou.copied', 'Copiado!') : label}
        </button>
    );
}

function PendingPaymentDetails({ order, t }) {
    const payment = order?.payment;
    const methodCode = payment?.method?.code;

    if (!payment || payment.status !== 'pending') return null;

    if (methodCode === 'ifthenpay_mb') {
        return (
            <SectionCard
                title={t('ui.order_show.pending_mb_title', 'Dados para pagamento Multibanco')}
                subtitle={t(
                    'ui.order_show.pending_mb_subtitle',
                    'Usa estes dados para concluir o pagamento numa caixa Multibanco, homebanking ou app bancária.'
                )}
            >
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t('ui.thankyou.entity', 'Entidade')}
                            </div>
                            <div className="mt-1 text-xl font-bold text-gray-900">
                                {payment.entity || '—'}
                            </div>
                            <CopyButton
                                value={payment.entity}
                                label={t('ui.thankyou.copy_entity', 'Copiar entidade')}
                                t={t}
                            />
                        </div>

                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t('ui.thankyou.reference', 'Referência')}
                            </div>
                            <div className="mt-1 text-xl font-bold text-gray-900">
                                {payment.reference || '—'}
                            </div>
                            <CopyButton
                                value={payment.reference}
                                label={t('ui.thankyou.copy_reference', 'Copiar referência')}
                                t={t}
                            />
                        </div>

                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t('ui.thankyou.total', 'Total')}
                            </div>
                            <div className="mt-1 text-xl font-bold text-gray-900">
                                {formatMoney(payment.amount || order?.amounts?.total, order.currency)}
                            </div>
                        </div>
                    </div>

                    {payment.expires_at ? (
                        <div className="mt-4 text-xs text-gray-600">
                            {t('ui.donations.thankyou.expires_at', 'Válido até')}: {' '}
                            <span className="font-semibold">
                                {formatDateTime(payment.expires_at)}
                            </span>
                        </div>
                    ) : null}
                </div>
            </SectionCard>
        );
    }

    if (methodCode === 'ifthenpay_mbway') {
        return (
            <SectionCard
                title={t('ui.order_show.pending_mbway_title', 'Pagamento MB WAY pendente')}
                subtitle={t(
                    'ui.order_show.pending_mbway_subtitle',
                    'Confirma o pagamento na app MB WAY no telemóvel associado à encomenda.'
                )}
            >
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t('ui.thankyou.total', 'Total')}
                            </div>
                            <div className="mt-1 text-xl font-bold text-gray-900">
                                {formatMoney(payment.amount || order?.amounts?.total, order.currency)}
                            </div>
                        </div>

                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t('ui.donations.thankyou.request_id', 'Pedido')}
                            </div>
                            <div className="mt-1 break-all text-sm font-semibold text-gray-900">
                                {payment.provider_payment_id || payment.reference || '—'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                        {t(
                            'ui.order_show.mbway_pending_notice',
                            'O pedido MB WAY pode expirar em poucos minutos. Se já não aparecer na app, contacta-nos para gerar um novo pedido.'
                        )}
                    </div>
                </div>
            </SectionCard>
        );
    }

    return null;
}

function Timeline({ order, t }) {
    const steps = useMemo(() => {
        const items = [];
        const history = Array.isArray(order?.status_timeline) ? order.status_timeline : [];
        const returns = Array.isArray(order?.returns) ? order.returns : [];
        const refunds = Array.isArray(order?.refunds) ? order.refunds : [];

        const findStatusDate = (code) => {
            const hit = history.find((x) => x.status_code === code);
            return hit?.created_at ?? null;
        };

        const pushStep = (step) => {
            if (!step?.at) return;
            items.push(step);
        };

        const createdAt = order?.created_at ?? null;
        const paidAt = order?.paid_at ?? null;
        const processingAt = findStatusDate('processing');
        const shippedAt = findStatusDate('shipped') ?? order?.shipment?.shipped_at ?? null;
        const deliveredAt = findStatusDate('delivered') ?? order?.shipment?.delivered_at ?? null;
        const cancelledAt = findStatusDate('cancelled');
        const refundedAt = findStatusDate('refunded');
        const hasRefund = Number(order?.refunded_total_amount ?? 0) > 0;

        pushStep({
            key: `created-${createdAt ?? 'na'}`,
            label: t('ui.order_show.timeline_created', 'Encomenda criada'),
            at: createdAt,
            tone: 'bg-gray-900',
            priority: 10,
        });

        if (paidAt || ['paid', 'partially_refunded', 'refunded'].includes(order?.payment?.status)) {
            pushStep({
                key: `paid-${paidAt ?? 'na'}`,
                label: t('ui.order_show.timeline_paid', 'Pagamento confirmado'),
                at: paidAt,
                tone: 'bg-green-600',
                priority: 20,
            });
        }

        pushStep({
            key: `processing-${processingAt ?? 'na'}`,
            label: t('ui.order_show.timeline_processing', 'Em processamento'),
            at: processingAt,
            tone: 'bg-indigo-600',
            priority: 30,
        });

        pushStep({
            key: `shipped-${shippedAt ?? 'na'}`,
            label: t('ui.order_show.timeline_shipped', 'Encomenda enviada'),
            at: shippedAt,
            tone: 'bg-blue-600',
            priority: 40,
        });

        pushStep({
            key: `delivered-${deliveredAt ?? 'na'}`,
            label: t('ui.order_show.timeline_delivered', 'Encomenda entregue'),
            at: deliveredAt,
            tone: 'bg-green-700',
            priority: 50,
        });

        returns.forEach((ret) => {
            pushStep({
                key: `return-requested-${ret.id}`,
                label: `${t('ui.returns.requested', 'Pedida')} · ${ret.return_number ?? `#${ret.id}`}`,
                at: ret.requested_at,
                tone: 'bg-amber-500',
                priority: 60,
            });

            pushStep({
                key: `return-approved-${ret.id}`,
                label: `${t('ui.returns.approved', 'Aprovada')} · ${ret.return_number ?? `#${ret.id}`}`,
                at: ret.approved_at,
                tone: 'bg-blue-600',
                priority: 70,
            });

            pushStep({
                key: `return-received-${ret.id}`,
                label: `${t('ui.returns.received', 'Recebida')} · ${ret.return_number ?? `#${ret.id}`}`,
                at: ret.received_at,
                tone: 'bg-green-600',
                priority: 80,
            });

            pushStep({
                key: `return-closed-${ret.id}`,
                label: `${t('ui.returns.closed', 'Fechada')} · ${ret.return_number ?? `#${ret.id}`}`,
                at: ret.closed_at,
                tone: 'bg-gray-900',
                priority: 100,
            });

            if (ret.status === 'rejected' && ret.closed_at) {
                pushStep({
                    key: `return-rejected-${ret.id}`,
                    label: `${t('ui.returns.rejected', 'Rejeitada')} · ${ret.return_number ?? `#${ret.id}`}`,
                    at: ret.closed_at,
                    tone: 'bg-red-600',
                    priority: 95,
                });
            }

            (ret.items ?? []).forEach((item) => {
                if (item.exchange_shipped_at && Number(item.exchange_shipped_qty ?? 0) > 0) {
                    pushStep({
                        key: `exchange-shipped-${ret.id}-${item.id}`,
                        label: `${t('ui.returns.exchange_resent_timeline', 'Artigo de troca reenviado')} · ${item.item_name ?? item.item_sku ?? '-'}`,
                        at: item.exchange_shipped_at,
                        tone: 'bg-indigo-700',
                        priority: 90,
                        meta: item.exchange_tracking_number
                            ? `${t('ui.orders.tracking_number', 'Tracking')}: ${item.exchange_tracking_number}`
                            : null,
                    });
                }
            });
        });

        if (hasRefund) {
            const latestRefundAt =
                refunds
                    .map((refund) => refund?.created_at)
                    .filter(Boolean)
                    .sort()
                    .at(-1) ?? refundedAt ?? null;

            pushStep({
                key: `refund-${latestRefundAt ?? 'na'}`,
                label:
                    Number(order?.remaining_refundable_amount ?? 0) <= 0
                        ? t('ui.refunds.full_refund_badge', 'Refund total')
                        : t('ui.refunds.partial_refund_badge', 'Refund parcial'),
                at: latestRefundAt,
                tone:
                    Number(order?.remaining_refundable_amount ?? 0) <= 0
                        ? 'bg-purple-600'
                        : 'bg-orange-500',
                priority: 85,
            });
        }

        pushStep({
            key: `cancelled-${cancelledAt ?? 'na'}`,
            label: t('ui.statuses.cancelled', 'Cancelado'),
            at: cancelledAt,
            tone: 'bg-red-600',
            priority: 110,
        });

        return items
            .filter((step) => step?.at)
            .sort((a, b) => {
                const aTime = new Date(a.at).getTime();
                const bTime = new Date(b.at).getTime();

                if (aTime === bTime) {
                    return (a.priority ?? 0) - (b.priority ?? 0);
                }

                return aTime - bTime;
            });
    }, [order, t]);

    if (steps.length === 0) return null;

    return (
        <SectionCard
            title={t('ui.order_show.timeline', 'Timeline')}
            subtitle={t('ui.order_show.timeline_subtitle', 'Histórico operacional da encomenda')}
        >
            <div className="space-y-4">
                {steps.map((step, index) => (
                    <div key={step.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full ${step.tone}`} />
                            {index !== steps.length - 1 ? (
                                <div className="mt-1 h-full min-h-[24px] w-px bg-gray-200" />
                            ) : null}
                        </div>

                        <div className="pb-1">
                            <div className="text-sm font-medium text-gray-900">{step.label}</div>
                            <div className="text-xs text-gray-600">{formatDateTime(step.at)}</div>
                            {step.meta ? (
                                <div className="mt-1 text-xs text-gray-500">{step.meta}</div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

export default function OrderShow() {
    const { locale, order } = usePage().props;
    const { t } = useI18n();

    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const isPickup = !!order?.is_pickup;
    const hasShipment = !!order?.shipment && !isPickup;

    const pricesIncludeTax =
        Boolean(order?.prices_include_tax) ||
        orderItems.some((item) => !!item?.meta?.price_includes_tax);

    const returnableItems = useMemo(() => {
        return orderItems.filter((item) => Number(item.remaining_returnable_qty ?? 0) > 0);
    }, [orderItems]);

    const initialReturnItems = useMemo(() => {
        return returnableItems.map((item) => ({
            order_item_id: item.id,
            qty: '',
            reason: '',
            condition: '',
            resolution: 'refund',
        }));
    }, [returnableItems]);

    const {
        data,
        setData,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        reason: '',
        notes: '',
        items: initialReturnItems,
    });

    useEffect(() => {
        setData({
            reason: '',
            notes: '',
            items: initialReturnItems,
        });
    }, [initialReturnItems, setData]);

    function reorder() {
        if (loading) return;
        setLoading(true);

        router.post(
            route('panel.orders.reorder', { locale, order: order.id }),
            {},
            {
                preserveScroll: true,
                onFinish: () => setLoading(false),
            }
        );
    }

    function updateReturnItem(orderItemId, field, value) {
        clearErrors();
        setSubmitError('');

        setData(
            'items',
            (data.items ?? []).map((row) =>
                row.order_item_id === orderItemId ? { ...row, [field]: value } : row
            )
        );
    }

    function submitReturn(e) {
        e.preventDefault();
        clearErrors();
        setSubmitError('');

        const normalizedItems = (data.items ?? [])
            .map((row) => ({
                order_item_id: Number(row.order_item_id),
                qty: Number(row.qty || 0),
                reason: row.reason ? String(row.reason).trim() : null,
                condition: row.condition ? String(row.condition).trim() : null,
                resolution: row.resolution ? String(row.resolution).trim() : null,
            }))
            .filter((row) => row.order_item_id > 0 && row.qty > 0);

        if (!normalizedItems.length) {
            setSubmitError(
                t(
                    'ui.returns.select_item_required',
                    'Seleciona pelo menos um artigo e indica uma quantidade superior a 0.'
                )
            );
            return;
        }

        router.post(
            route('panel.orders.returns.store', { locale, order: order.id }),
            {
                reason: data.reason ? String(data.reason).trim() : null,
                notes: data.notes ? String(data.notes).trim() : null,
                items: normalizedItems,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: false,
                onSuccess: () => {
                    reset();
                    setData({
                        reason: '',
                        notes: '',
                        items: initialReturnItems,
                    });
                    setSubmitError('');
                },
                onError: () => {
                    setSubmitError(
                        t(
                            'ui.common.validation_error',
                            'Please check the form fields.'
                        )
                    );
                },
            }
        );
    }

    function clearReturnForm() {
        clearErrors();
        setSubmitError('');
        reset();
        setData({
            reason: '',
            notes: '',
            items: initialReturnItems,
        });
    }

    const returnPolicy = order?.return_policy ?? {};
    const showReturnWindowNotice = Boolean(returnPolicy?.ends_at);

    const pageHeader = (
        <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
                {t('ui.order_show.title', 'Order')}
            </h2>
            <div className="mt-1 text-sm text-gray-600">
                #{order.order_number}
            </div>
        </div>
    );

    const pageHeaderActions = (
        <>
            <Link
                href={route('dashboard', { locale })}
                className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
                {t('ui.order_show.back_to_dashboard', 'Back to Dashboard')}
            </Link>

            <button
                type="button"
                onClick={reorder}
                disabled={loading}
                className={[
                    'rounded-md px-4 py-2 text-sm font-semibold',
                    loading
                        ? 'bg-gray-300 text-gray-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800',
                ].join(' ')}
                title={t(
                    'ui.order_show.reorder_title',
                    'Add the items from this order to the cart'
                )}
            >
                {loading
                    ? t('ui.order_show.reordering', 'Adding...')
                    : t('ui.order_show.reorder', 'Buy again')}
            </button>
        </>
    );

    return (
        <AuthenticatedLayout
            header={pageHeader}
            headerActions={pageHeaderActions}
        >
            <Head title={`${t('ui.order_show.title', 'Order')} #${order.order_number}`} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <SummaryStat
                            label={t('ui.thankyou.total', 'Total')}
                            value={formatMoney(order.amounts.total, order.currency)}
                        />
                        <SummaryStat
                            label={t('ui.refunds.title', 'Refunds')}
                            value={formatMoney(order.refunded_total_amount ?? 0, order.currency)}
                            tone="text-orange-700"
                        />
                        <SummaryStat
                            label={t('ui.refunds.remaining', 'Remaining refundable')}
                            value={formatMoney(order.remaining_refundable_amount ?? 0, order.currency)}
                            tone="text-green-700"
                        />
                        <SummaryStat
                            label={t('ui.returns.returns_badge', 'Devoluções')}
                            value={String((order?.returns ?? []).length)}
                            tone="text-blue-700"
                        />
                    </div>

                    <SectionCard
                        title={`#${order.order_number}`}
                        subtitle={t('ui.order_show.order_summary_subtitle', 'Resumo da encomenda')}
                    >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="flex flex-wrap gap-2">
                                    <OrderStatusBadge status={order.status} />
                                    <RefundBadge order={order} t={t} />
                                    <ReturnSummaryBadge order={order} t={t} />
                                    <PaymentBadge payment={order.payment} t={t} />
                                    {order?.shipment ? (
                                        <ShipmentStatusBadge status={order.shipment.status} t={t} />
                                    ) : null}
                                </div>

                                <div className="mt-3 space-y-1 text-sm text-gray-600">
                                    <div>
                                        {t('ui.order_show.created_at', 'Created')}:{' '}
                                        <span className="font-medium">{formatDateTime(order.created_at)}</span>
                                    </div>

                                    {order.paid_at && (
                                        <div>
                                            {t('ui.order_show.paid_at', 'Paid')}:{' '}
                                            <span className="font-medium">{formatDateTime(order.paid_at)}</span>
                                        </div>
                                    )}

                                    {order?.payment?.method?.name ? (
                                        <div>
                                            {t('ui.thankyou.payment', 'Payment')}:{' '}
                                            <span className="font-medium">{order.payment.method.name}</span>
                                        </div>
                                    ) : null}

                                    {order?.shipping_label ? (
                                        <div>
                                            {t('ui.thankyou.shipping', 'Shipping')}:{' '}
                                            <span className="font-medium">{order.shipping_label}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-lg font-semibold text-gray-900">
                                    {formatMoney(order.amounts.total, order.currency)}
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <PendingPaymentDetails order={order} t={t} />

                    {order?.shipment ? (
                        <SectionCard
                            title={t('ui.shipments.title', 'Envio')}
                            subtitle={t('ui.order_show.shipment_subtitle', 'Método de envio e progresso da entrega')}
                        >
                            <div className="flex flex-wrap gap-2">
                                <ShipmentStatusBadge status={order.shipment.status} t={t} />
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                                <div>
                                    <span className="font-medium text-gray-900">
                                        {t('ui.shipments.method', 'Método')}:
                                    </span>{' '}
                                    {order.shipment.method?.name ?? '-'}
                                </div>

                                <div>
                                    <span className="font-medium text-gray-900">
                                        {t('ui.orders.tracking_number', 'Tracking')}:
                                    </span>{' '}
                                    {order.shipment.tracking_number ?? '-'}
                                </div>

                                <div>
                                    <span className="font-medium text-gray-900">
                                        {t('ui.shipments.shipped_at', 'Enviado em')}:
                                    </span>{' '}
                                    {formatDateTime(order.shipment.shipped_at)}
                                </div>

                                <div>
                                    <span className="font-medium text-gray-900">
                                        {t('ui.shipments.delivered_at', 'Entregue em')}:
                                    </span>{' '}
                                    {formatDateTime(order.shipment.delivered_at)}
                                </div>
                            </div>
                        </SectionCard>
                    ) : null}

                    {pricesIncludeTax ? (
                        <InfoBox>
                            <div>
                                {t(
                                    'ui.checkout.tax_included',
                                    'Os preços dos artigos já incluem IVA quando aplicável.'
                                )}
                            </div>
                            <div className="mt-1">
                                {t(
                                    'ui.checkout.tax_calculated_after_discount',
                                    'O IVA é calculado após aplicação dos descontos.'
                                )}
                            </div>
                        </InfoBox>
                    ) : (
                        <InfoBox>
                            {t(
                                'ui.checkout.tax_calculated_after_discount',
                                'O IVA é calculado após aplicação dos descontos.'
                            )}
                        </InfoBox>
                    )}

                    <Timeline order={order} t={t} />

                    <SectionCard
                        title={t('ui.thankyou.items', 'Items')}
                        subtitle={t('ui.order_show.items_subtitle', 'Artigos desta encomenda')}
                    >
                        <div className="space-y-3">
                            {orderItems.map((it) => (
                                <div key={it.id} className="rounded-xl border p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="text-sm">
                                            <div className="font-medium text-gray-900">{it.name}</div>
                                            <div className="text-gray-600">
                                                {t('ui.common.sku', 'SKU')}: {it.sku} · {t('ui.thankyou.qty', 'Qty')}: {it.qty}
                                            </div>
                                            <div className="text-gray-600">
                                                {t('ui.thankyou.unit_price', 'Unit')}:{' '}
                                                {formatMoney(it.unit_amount, order.currency)}
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {typeof it.refunded_qty !== 'undefined' ? (
                                                    <>
                                                        <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                                            {t('ui.refunds.refunded_qty', 'Refunded qty')}: {it.refunded_qty}
                                                        </span>
                                                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                                            {t('ui.refunds.remaining_qty', 'Remaining qty')}: {it.remaining_refundable_qty}
                                                        </span>
                                                    </>
                                                ) : null}

                                                {typeof it.returned_qty !== 'undefined' ? (
                                                    <>
                                                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                                            {t('ui.returns.returned_qty', 'Returned qty')}: {it.returned_qty}
                                                        </span>
                                                        <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                            {t('ui.returns.remaining_returnable_qty', 'Remaining returnable qty')}: {it.remaining_returnable_qty}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="text-sm font-semibold text-gray-900">
                                            {formatMoney(it.total_amount, order.currency)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title={t('ui.order_show.financial_summary', 'Resumo financeiro')}
                        subtitle={t('ui.order_show.financial_summary_subtitle', 'Totais e valores reembolsáveis')}
                    >
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>{t('ui.thankyou.subtotal', 'Subtotal')}</span>
                                <span>{formatMoney(order.amounts.subtotal, order.currency)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>{t('ui.thankyou.shipping', 'Shipping')}</span>
                                <span>{formatMoney(order.amounts.shipping, order.currency)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>{t('ui.thankyou.tax', 'Tax')}</span>
                                <span>{formatMoney(order.amounts.tax, order.currency)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>{t('ui.thankyou.discount', 'Discount')}</span>
                                <span>- {formatMoney(order.amounts.discount, order.currency)}</span>
                            </div>

                            <div className="flex justify-between border-t pt-3 text-base font-semibold">
                                <span>{t('ui.thankyou.total', 'Total')}</span>
                                <span>{formatMoney(order.amounts.total, order.currency)}</span>
                            </div>

                            <div className="flex justify-between text-orange-700">
                                <span>{t('ui.refunds.title', 'Refunds')}</span>
                                <span>{formatMoney(order.refunded_total_amount ?? 0, order.currency)}</span>
                            </div>

                            <div className="flex justify-between border-t pt-3 font-semibold text-green-700">
                                <span>{t('ui.refunds.remaining', 'Remaining refundable')}</span>
                                <span>{formatMoney(order.remaining_refundable_amount ?? 0, order.currency)}</span>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title={t('ui.order_show.addresses', 'Addresses')}
                        subtitle={t('ui.order_show.addresses_subtitle', 'Moradas guardadas no momento da compra')}
                    >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="text-sm">
                                <div className="font-semibold text-gray-900">
                                    {t('ui.thankyou.shipping_address', 'Shipping')}
                                </div>
                                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-700">
                                    {isPickup
                                        ? (order?.shipping_label || t('ui.orders.pickup_in_store', 'Levantamento em loja'))
                                        : hasShipment
                                            ? formatAddress(order?.shipping_address)
                                            : t(
                                                "ui.thankyou.no_shipping_required_short",
                                                "This order does not require physical shipping."
                                            )}
                                </pre>
                            </div>

                            <div className="text-sm">
                                <div className="font-semibold text-gray-900">
                                    {t('ui.thankyou.billing_address', 'Billing')}
                                </div>
                                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-700">
                                    {formatAddress(order.billing_address)}
                                </pre>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title={t('ui.refunds.history', 'Refund history')}
                        subtitle={t('ui.order_show.refunds_history_subtitle', 'Reembolsos registados nesta encomenda')}
                    >
                        {(order.refunds ?? []).length === 0 ? (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                                {t('ui.refunds.empty', 'No refunds yet.')}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {order.refunds.map((refund) => (
                                    <div key={refund.id} className="rounded-xl border p-4">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="font-semibold text-gray-900">
                                                    #{refund.id} · {formatMoney(refund.amount, order.currency)}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {formatDateTime(refund.created_at)}
                                                </div>
                                            </div>

                                            <div className="text-sm text-gray-700">
                                                {refund.reason ? (
                                                    <div>
                                                        <strong>{t('ui.refunds.reason', 'Reason')}:</strong> {refund.reason}
                                                    </div>
                                                ) : null}

                                                {refund.notes ? (
                                                    <div className="mt-1">
                                                        <strong>{t('ui.refunds.notes', 'Notes')}:</strong> {refund.notes}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 overflow-x-auto">
                                            <table className="min-w-full border">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.email.item', 'Item')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.common.sku', 'SKU')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.refunds.qty', 'Qty')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.refunds.amount', 'Amount')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(refund.items ?? []).map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.item_name ?? '-'}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.item_sku ?? '-'}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.qty}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {formatMoney(item.amount, order.currency)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('ui.returns.history', 'Return history')}
                        subtitle={t('ui.order_show.returns_history_subtitle', 'Pedidos de devolução e respetivo estado')}
                    >
                        {(order.returns ?? []).length === 0 ? (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                                {t('ui.returns.empty', 'No returns yet.')}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {order.returns.map((ret) => (
                                    <div key={ret.id} className="rounded-xl border p-4">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-semibold text-gray-900">
                                                        {ret.return_number ?? `#${ret.id}`}
                                                    </div>
                                                    {returnStatusBadge(ret.status, t)}
                                                </div>

                                                <div className="mt-1 space-y-1 text-sm text-gray-600">
                                                    <div>
                                                        {t('ui.returns.requested_at', 'Requested')}: {formatDateTime(ret.requested_at)}
                                                    </div>
                                                    {ret.approved_at ? (
                                                        <div>
                                                            {t('ui.returns.approved_at', 'Approved')}: {formatDateTime(ret.approved_at)}
                                                        </div>
                                                    ) : null}
                                                    {ret.received_at ? (
                                                        <div>
                                                            {t('ui.returns.received_at', 'Received')}: {formatDateTime(ret.received_at)}
                                                        </div>
                                                    ) : null}
                                                    {ret.closed_at ? (
                                                        <div>
                                                            {t('ui.returns.closed_at', 'Closed')}: {formatDateTime(ret.closed_at)}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="text-sm text-gray-700">
                                                {ret.reason ? (
                                                    <div>
                                                        <strong>{t('ui.returns.reason', 'Reason')}:</strong> {ret.reason}
                                                    </div>
                                                ) : null}

                                                {ret.notes ? (
                                                    <div className="mt-1">
                                                        <strong>{t('ui.returns.notes', 'Notes')}:</strong> {ret.notes}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 overflow-x-auto">
                                            <table className="min-w-full border">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.email.item', 'Item')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.common.sku', 'SKU')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.returns.qty', 'Qty')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.returns.received_qty', 'Received qty')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.returns.restock_qty', 'Restock qty')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.returns.resolution', 'Resolution')}
                                                        </th>
                                                        <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                            {t('ui.orders.tracking_number', 'Tracking')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(ret.items ?? []).map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.item_name ?? '-'}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.item_sku ?? '-'}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.qty}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.received_qty}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.restock_qty}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.resolution ?? '-'}
                                                                {item.resolution === 'exchange' && Number(item.exchange_shipped_qty ?? 0) > 0 ? (
                                                                    <div className="mt-1 text-xs text-indigo-700">
                                                                        {t('ui.returns.exchange_resent', 'Troca reenviada')} · {item.exchange_shipped_qty}
                                                                        {item.exchange_shipped_at ? ` · ${formatDateTime(item.exchange_shipped_at)}` : ''}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td className="border px-3 py-2 text-sm text-gray-700">
                                                                {item.exchange_tracking_number ?? '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('ui.returns.request_return', 'Request a return')}
                        subtitle={t('ui.order_show.request_return_subtitle', 'Pedir devolução ou troca para artigos elegíveis')}
                    >
                        {showReturnWindowNotice ? (
                            <div
                                className={[
                                    'rounded-xl border px-4 py-3 text-sm',
                                    order?.return_policy?.is_expired
                                        ? 'border-red-200 bg-red-50 text-red-800'
                                        : order?.return_policy?.is_within_window
                                            ? 'border-green-200 bg-green-50 text-green-800'
                                            : 'border-amber-200 bg-amber-50 text-amber-900',
                                ].join(' ')}
                            >
                                {order?.return_policy?.is_within_window ? (
                                    <div>
                                        {t(
                                            'ui.returns.window_notice_open',
                                            'You have :days days to request a return after delivery. Deadline: :date.'
                                        )
                                            .replace(':days', String(order?.return_policy?.window_days ?? ''))
                                            .replace(':date', formatDateOnly(order?.return_policy?.ends_at))}
                                    </div>
                                ) : order?.return_policy?.is_expired ? (
                                    <div>
                                        {t(
                                            'ui.returns.window_notice_expired',
                                            'The return window for this order expired on :date.'
                                        ).replace(':date', formatDateOnly(order?.return_policy?.ends_at))}
                                    </div>
                                ) : (
                                    <div>
                                        {t(
                                            'ui.returns.window_notice_wait_delivery',
                                            'Returns become available after delivery and within the legal return window.'
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {!order.can_request_return ? (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                {order?.return_policy?.is_expired
                                    ? t('ui.returns.window_expired_short', 'The return window for this order has expired.')
                                    : order?.status?.code !== 'delivered'
                                        ? t('ui.returns.only_after_delivery', 'You can only request a return after the order has been delivered.')
                                        : !order?.return_policy?.has_returnable_items
                                            ? t('ui.returns.no_eligible_items', 'There are no eligible items for return in this order.')
                                            : t(
                                                'ui.returns.not_available_for_order',
                                                'A return request is not available for this order in its current state.'
                                            )}
                            </div>
                        ) : (
                            <form onSubmit={submitReturn} className="mt-4 space-y-4">
                                <div className="space-y-3">
                                    {returnableItems.map((item) => {
                                        const row = (data.items ?? []).find((x) => x.order_item_id === item.id);

                                        return (
                                            <div key={item.id} className="rounded-xl border p-4">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div>
                                                        <div className="font-medium text-gray-900">{item.name}</div>
                                                        <div className="text-sm text-gray-600">{t('ui.common.sku', 'SKU')}: {item.sku}</div>
                                                        <div className="mt-1 text-xs text-gray-600">
                                                            {t('ui.returns.remaining_returnable_qty', 'Remaining returnable qty')}:{' '}
                                                            <strong>{item.remaining_returnable_qty}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <label className="block text-xs text-gray-600">
                                                                {t('ui.returns.qty', 'Qty')}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={item.remaining_returnable_qty}
                                                                value={row?.qty ?? ''}
                                                                onChange={(e) => updateReturnItem(item.id, 'qty', e.target.value)}
                                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600">
                                                                {t('ui.returns.resolution', 'Resolution')}
                                                            </label>
                                                            <select
                                                                value={row?.resolution ?? 'refund'}
                                                                onChange={(e) => updateReturnItem(item.id, 'resolution', e.target.value)}
                                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                            >
                                                                <option value="refund">{t('ui.returns.resolution_refund', 'Refund')}</option>
                                                                <option value="exchange">{t('ui.returns.resolution_exchange', 'Exchange')}</option>
                                                                <option value="inspection">{t('ui.returns.resolution_inspection', 'Inspection')}</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600">
                                                                {t('ui.returns.item_reason', 'Item reason')}
                                                            </label>
                                                            <input
                                                                value={row?.reason ?? ''}
                                                                onChange={(e) => updateReturnItem(item.id, 'reason', e.target.value)}
                                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600">
                                                                {t('ui.returns.condition', 'Condition')}
                                                            </label>
                                                            <select
                                                                value={row?.condition ?? ''}
                                                                onChange={(e) => updateReturnItem(item.id, 'condition', e.target.value)}
                                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                            >
                                                                <option value="">{t('ui.common.select', 'Select')}</option>
                                                                <option value="sealed">{t('ui.returns.condition_sealed', 'Sealed')}</option>
                                                                <option value="opened">{t('ui.returns.condition_opened', 'Opened')}</option>
                                                                <option value="used">{t('ui.returns.condition_used', 'Used')}</option>
                                                                <option value="damaged">{t('ui.returns.condition_damaged', 'Damaged')}</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('ui.returns.reason', 'Reason')}
                                    </label>
                                    <input
                                        value={data.reason}
                                        onChange={(e) => {
                                            clearErrors();
                                            setSubmitError('');
                                            setData('reason', e.target.value);
                                        }}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('ui.returns.notes', 'Notes')}
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={data.notes}
                                        onChange={(e) => {
                                            clearErrors();
                                            setSubmitError('');
                                            setData('notes', e.target.value);
                                        }}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    />
                                </div>

                                {submitError ? (
                                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                        {submitError}
                                    </div>
                                ) : null}

                                {Object.keys(errors ?? {}).length > 0 ? (
                                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                        <div className="font-semibold">
                                            {t('ui.common.validation_error', 'Please check the form fields.')}
                                        </div>
                                        <ul className="mt-2 list-disc space-y-1 pl-5">
                                            {Object.entries(errors).map(([key, value]) => (
                                                <li key={key}>
                                                    <strong>{key}:</strong> {value}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        {processing
                                            ? t('ui.returns.submitting', 'Submitting...')
                                            : t('ui.returns.submit_request', 'Submit return request')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={clearReturnForm}
                                        disabled={processing}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {t('ui.common.clear', 'Clear')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </SectionCard>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
