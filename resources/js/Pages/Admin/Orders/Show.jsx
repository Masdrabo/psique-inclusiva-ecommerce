import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? "€";
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function formatDateTime(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
}

function formatAddress(address) {
    if (!address || typeof address !== "object") return "-";

    const parts = [
        address.name,
        address.line1,
        address.line2,
        [address.postal_code, address.city].filter(Boolean).join(" "),
        address.region,
        address.country_code,
    ].filter(Boolean);

    return parts.length ? parts.join(", ") : "-";
}

function calculateProportionalLineAmount(lineTotalAmount, originalQty, partialQty) {
    const total = Number(lineTotalAmount || 0);
    const qty = Number(originalQty || 0);
    const partial = Number(partialQty || 0);

    if (total <= 0 || qty <= 0 || partial <= 0) {
        return 0;
    }

    if (partial >= qty) {
        return total;
    }

    return Math.floor((total * partial) / qty);
}

function makeIdempotencyKey() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `refund-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function badgeBase(extra = "") {
    return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${extra}`;
}

function statusBadge(statusCode, statusLabel) {
    if (statusCode === "cancelled") {
        return <span className={badgeBase("bg-red-100 text-red-700")}>{statusLabel}</span>;
    }

    if (statusCode === "pending_payment") {
        return <span className={badgeBase("bg-amber-100 text-amber-700")}>{statusLabel}</span>;
    }

    if (statusCode === "processing") {
        return <span className={badgeBase("bg-indigo-100 text-indigo-700")}>{statusLabel}</span>;
    }

    if (statusCode === "shipped") {
        return <span className={badgeBase("bg-blue-100 text-blue-700")}>{statusLabel}</span>;
    }

    if (statusCode === "delivered") {
        return <span className={badgeBase("bg-green-100 text-green-700")}>{statusLabel}</span>;
    }

    if (statusCode === "refunded") {
        return <span className={badgeBase("bg-purple-100 text-purple-700")}>{statusLabel}</span>;
    }

    return <span className={badgeBase("bg-gray-100 text-gray-700")}>{statusLabel}</span>;
}

function paymentBadge(status, t) {
    if (status === "refunded") {
        return (
            <span className={badgeBase("bg-purple-100 text-purple-700")}>
                {t("ui.refunds.payment_refunded_badge", "Pagamento reembolsado")}
            </span>
        );
    }

    if (status === "partially_refunded") {
        return (
            <span className={badgeBase("bg-orange-100 text-orange-700")}>
                {t("ui.refunds.payment_partial_refund_badge", "Pagamento parcialmente reembolsado")}
            </span>
        );
    }

    if (status === "paid") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {t("ui.statuses.paid", "Pago")}
            </span>
        );
    }

    if (status === "pending") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {t("ui.statuses.pending_payment", "A aguardar pagamento")}
            </span>
        );
    }

    return <span className={badgeBase("bg-gray-100 text-gray-700")}>{status ?? "-"}</span>;
}

function returnStatusBadge(status, t) {
    if (status === "requested") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {t("ui.returns.requested", "Pedida")}
            </span>
        );
    }

    if (status === "approved") {
        return (
            <span className={badgeBase("bg-blue-100 text-blue-700")}>
                {t("ui.returns.approved", "Aprovada")}
            </span>
        );
    }

    if (status === "received") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {t("ui.returns.received", "Recebida")}
            </span>
        );
    }

    if (status === "closed") {
        return (
            <span className={badgeBase("bg-gray-900 text-white")}>
                {t("ui.returns.closed", "Fechada")}
            </span>
        );
    }

    if (status === "rejected") {
        return (
            <span className={badgeBase("bg-red-100 text-red-700")}>
                {t("ui.returns.rejected", "Rejeitada")}
            </span>
        );
    }

    return <span className={badgeBase("bg-gray-100 text-gray-700")}>{status ?? "-"}</span>;
}

function shipmentStatusBadge(status, t) {
    if (status === "pending") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {t("ui.shipments.status_pending", "Pendente")}
            </span>
        );
    }

    if (status === "shipped") {
        return (
            <span className={badgeBase("bg-blue-100 text-blue-700")}>
                {t("ui.shipments.status_shipped", "Enviado")}
            </span>
        );
    }

    if (status === "delivered") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {t("ui.shipments.status_delivered", "Entregue")}
            </span>
        );
    }

    if (status === "returned") {
        return (
            <span className={badgeBase("bg-purple-100 text-purple-700")}>
                {t("ui.shipments.status_returned", "Devolvido")}
            </span>
        );
    }

    if (status === "cancelled") {
        return (
            <span className={badgeBase("bg-red-100 text-red-700")}>
                {t("ui.shipments.status_cancelled", "Cancelado")}
            </span>
        );
    }

    return <span className={badgeBase("bg-gray-100 text-gray-700")}>{status ?? "-"}</span>;
}

function SummaryCard({ label, value, tone = "text-gray-900", help = null }) {
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
            {help ? <div className="mt-1 text-xs text-gray-500">{help}</div> : null}
        </div>
    );
}

function SectionCard({ title, subtitle = null, actions = null, children }) {
    return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="text-lg font-semibold text-gray-900">{title}</div>
                    {subtitle ? <div className="mt-1 text-sm text-gray-600">{subtitle}</div> : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>

            <div className="mt-4">{children}</div>
        </div>
    );
}

function EmptyState({ children }) {
    return (
        <div className="rounded-md border border-dashed p-4 text-sm text-gray-600">
            {children}
        </div>
    );
}

function InlineInfo({ tone = "gray", children }) {
    const classes = {
        gray: "border-gray-200 bg-gray-50 text-gray-700",
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        red: "border-red-200 bg-red-50 text-red-800",
        green: "border-green-200 bg-green-50 text-green-800",
        blue: "border-blue-200 bg-blue-50 text-blue-800",
        orange: "border-orange-200 bg-orange-50 text-orange-800",
    };

    return (
        <div className={`rounded-md border px-4 py-3 text-sm ${classes[tone] ?? classes.gray}`}>
            {children}
        </div>
    );
}

function buildReceiveForms(returns) {
    const next = {};

    (returns ?? []).forEach((ret) => {
        next[ret.id] = {
            notes: "",
            items: (ret.items ?? []).map((item) => ({
                order_item_id: item.order_item_id,
                received_qty: String(item.received_qty ?? item.qty ?? 0),
                restock_qty: String(
                    item.is_inventory_product
                        ? (item.restock_qty ?? item.received_qty ?? item.qty ?? 0)
                        : 0
                ),
            })),
        };
    });

    return next;
}

function buildExchangeForms(returns) {
    const next = {};

    (returns ?? []).forEach((ret) => {
        next[ret.id] = {
            tracking_number: "",
            notes: "",
            items: (ret.items ?? [])
                .filter((item) => item.resolution === "exchange")
                .map((item) => ({
                    order_item_id: item.order_item_id,
                    shipped_qty: String(item.exchange_remaining_qty ?? 0),
                })),
        };
    });

    return next;
}

function OperationalTimeline({ order, t }) {
    const steps = useMemo(() => {
        const rows = [];
        const statusTimeline = Array.isArray(order?.status_timeline) ? order.status_timeline : [];
        const returns = Array.isArray(order?.returns) ? order.returns : [];
        const refunds = Array.isArray(order?.refunds) ? order.refunds : [];

        const push = (entry) => {
            if (!entry?.at) return;
            rows.push(entry);
        };

        statusTimeline.forEach((entry, index) => {
            const code = entry?.status_code ?? "";
            let tone = "bg-gray-500";

            if (code === "paid") tone = "bg-green-600";
            else if (code === "processing") tone = "bg-indigo-600";
            else if (code === "shipped") tone = "bg-blue-600";
            else if (code === "delivered") tone = "bg-green-700";
            else if (code === "cancelled") tone = "bg-red-600";
            else if (code === "pending_payment") tone = "bg-amber-500";
            else if (code === "refunded") tone = "bg-purple-600";

            push({
                key: `status-${entry.id ?? index}`,
                label: entry?.status_name ?? entry?.status_code ?? t("ui.orders.status", "Estado"),
                at: entry?.created_at,
                tone,
                meta: entry?.notes ?? null,
                order: 100 + index,
            });
        });

        returns.forEach((ret, retIndex) => {
            const refLabel = ret?.return_number ?? `#${ret.id}`;

            push({
                key: `return-requested-${ret.id}`,
                label: `${t("ui.returns.requested", "Pedida")} · ${refLabel}`,
                at: ret?.requested_at,
                tone: "bg-amber-500",
                meta: ret?.reason ?? null,
                order: 200 + retIndex,
            });

            push({
                key: `return-approved-${ret.id}`,
                label: `${t("ui.returns.approved", "Aprovada")} · ${refLabel}`,
                at: ret?.approved_at,
                tone: "bg-blue-600",
                meta: ret?.approved_by?.name
                    ? `${t("ui.admin_orders_show.approved_by", "Por")}: ${ret.approved_by.name}`
                    : null,
                order: 210 + retIndex,
            });

            push({
                key: `return-received-${ret.id}`,
                label: `${t("ui.returns.received", "Recebida")} · ${refLabel}`,
                at: ret?.received_at,
                tone: "bg-green-600",
                meta: ret?.received_by?.name
                    ? `${t("ui.admin_orders_show.received_by", "Recebida por")}: ${ret.received_by.name}`
                    : null,
                order: 220 + retIndex,
            });

            (ret.items ?? []).forEach((item, itemIndex) => {
                if (item?.exchange_shipped_at && Number(item?.exchange_shipped_qty ?? 0) > 0) {
                    push({
                        key: `exchange-shipped-${ret.id}-${item.id}`,
                        label: `${t("ui.admin_orders_show.exchange_resent", "Troca reenviada")} · ${item?.item_name ?? item?.item_sku ?? "-"}`,
                        at: item?.exchange_shipped_at,
                        tone: "bg-indigo-700",
                        meta: item?.exchange_tracking_number
                            ? `${t("ui.orders.tracking_number", "Tracking")}: ${item.exchange_tracking_number}`
                            : `${t("ui.returns.qty", "Qtd")}: ${item.exchange_shipped_qty}`,
                        order: 230 + retIndex + itemIndex,
                    });
                }
            });

            if (ret?.status === "rejected" && ret?.closed_at) {
                push({
                    key: `return-rejected-${ret.id}`,
                    label: `${t("ui.returns.rejected", "Rejeitada")} · ${refLabel}`,
                    at: ret?.closed_at,
                    tone: "bg-red-600",
                    meta: ret?.notes ?? null,
                    order: 240 + retIndex,
                });
            }

            if (ret?.status === "closed" && ret?.closed_at) {
                push({
                    key: `return-closed-${ret.id}`,
                    label: `${t("ui.returns.closed", "Fechada")} · ${refLabel}`,
                    at: ret?.closed_at,
                    tone: "bg-gray-900",
                    meta: ret?.notes ?? null,
                    order: 250 + retIndex,
                });
            }
        });

        refunds.forEach((refund, index) => {
            const shippingAmount = Number(refund?.shipping_amount ?? 0);
            const itemsAmount = Math.max(0, Number(refund?.amount ?? 0) - shippingAmount);

            const metaParts = [];
            if (refund?.reason) metaParts.push(refund.reason);
            if (itemsAmount > 0) {
                metaParts.push(
                    `${t("ui.refunds.items_amount", "Artigos")}: ${formatMoney(itemsAmount, order?.currency)}`
                );
            }
            if (shippingAmount > 0) {
                metaParts.push(
                    `${t("ui.refunds.shipping", "Portes")}: ${formatMoney(shippingAmount, order?.currency)}`
                );
            }

            push({
                key: `refund-${refund.id}`,
                label: `${t("ui.admin_orders_show.refund_created", "Refund criado")} · ${formatMoney(refund?.amount ?? 0, order?.currency)}`,
                at: refund?.created_at,
                tone: "bg-purple-600",
                meta: metaParts.length ? metaParts.join(" · ") : null,
                order: 300 + index,
            });
        });

        return rows
            .filter((row) => row?.at)
            .sort((a, b) => {
                const aTime = new Date(a.at).getTime();
                const bTime = new Date(b.at).getTime();

                if (aTime === bTime) {
                    return (a.order ?? 0) - (b.order ?? 0);
                }

                return aTime - bTime;
            });
    }, [order, t]);

    return (
        <SectionCard
            title={t("ui.admin_orders_show.operational_timeline", "Timeline operacional")}
            subtitle={t("ui.admin_orders_show.operational_timeline_help", "Resumo cronológico do estado, refunds e devoluções.")}
        >
            {steps.length === 0 ? (
                <EmptyState>{t("ui.admin_orders_show.no_history_yet", "Sem histórico ainda.")}</EmptyState>
            ) : (
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
                                {step.meta ? <div className="mt-1 text-xs text-gray-500">{step.meta}</div> : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

export default function AdminOrderShow() {
    const { locale, order, errors = {} } = usePage().props;
    const isPickup = !!order?.is_pickup;
    const { t } = useI18n();
    const quickRefundRef = useRef(null);

    const [statusCode, setStatusCode] = useState(order?.allowed_next_statuses?.[0]?.code ?? "");
    const [receiveForms, setReceiveForms] = useState(() => buildReceiveForms(order?.returns ?? []));
    const [exchangeForms, setExchangeForms] = useState(() => buildExchangeForms(order?.returns ?? []));

    const {
        data: shipmentData,
        setData: setShipmentData,
        processing: shipmentProcessing,
        reset: resetShipment,
    } = useForm({
        tracking_number: order?.shipment?.tracking_number ?? "",
        status: order?.shipment?.status ?? "pending",
    });

    useEffect(() => {
        setReceiveForms(buildReceiveForms(order?.returns ?? []));
        setExchangeForms(buildExchangeForms(order?.returns ?? []));
        setStatusCode(order?.allowed_next_statuses?.[0]?.code ?? "");
        resetShipment();
        setShipmentData({
            tracking_number: order?.shipment?.tracking_number ?? "",
            status: order?.shipment?.status ?? "pending",
        });
    }, [order?.returns, order?.allowed_next_statuses, order?.shipment, resetShipment, setShipmentData]);

    const refundableItems = useMemo(() => {
        return (order?.items ?? []).filter((item) => Number(item.remaining_refundable_qty ?? 0) > 0);
    }, [order?.items]);

    const refundableQtyByOrderItemId = useMemo(() => {
        return new Map(
            (order?.items ?? []).map((item) => [
                Number(item.id),
                Number(item.remaining_refundable_qty ?? 0),
            ])
        );
    }, [order?.items]);

    const initialRefundItems = useMemo(() => {
        return refundableItems.map((item) => ({
            order_item_id: item.id,
            qty: "",
        }));
    }, [refundableItems]);

    const {
        data: refundData,
        setData: setRefundData,
        processing: refundProcessing,
        reset: resetRefund,
        clearErrors: clearRefundErrors,
    } = useForm({
        reason: "",
        notes: "",
        refund_shipping: false,
        shipping_amount: "",
        idempotency_key: makeIdempotencyKey(),
        items: initialRefundItems,
    });

    useEffect(() => {
        setRefundData({
            reason: "",
            notes: "",
            refund_shipping: false,
            shipping_amount: "",
            idempotency_key: makeIdempotencyKey(),
            items: initialRefundItems,
        });
    }, [initialRefundItems, setRefundData]);

    const returnableItems = useMemo(() => {
        return (order?.items ?? []).filter((item) => Number(item.remaining_returnable_qty ?? 0) > 0);
    }, [order?.items]);

    const initialReturnItems = useMemo(() => {
        return returnableItems.map((item) => ({
            order_item_id: item.id,
            qty: "",
            reason: "",
            condition: "",
            resolution: "refund",
        }));
    }, [returnableItems]);

    const {
        data: returnData,
        setData: setReturnData,
        processing: returnProcessing,
        reset: resetReturn,
        clearErrors: clearReturnErrors,
    } = useForm({
        reason: "",
        notes: "",
        items: initialReturnItems,
    });

    useEffect(() => {
        setReturnData({
            reason: "",
            notes: "",
            items: initialReturnItems,
        });
    }, [initialReturnItems, setReturnData]);

    const remainingShippingRefundableAmount = Number(order?.remaining_shipping_refundable_amount ?? 0);
    const hasRefundableShipping = remainingShippingRefundableAmount > 0;

    const normalizedShippingRefundAmount = useMemo(() => {
        if (!refundData.refund_shipping) return 0;

        const raw = Number(refundData.shipping_amount || 0);
        if (!Number.isFinite(raw) || raw <= 0) return 0;

        return Math.min(raw, remainingShippingRefundableAmount);
    }, [refundData.refund_shipping, refundData.shipping_amount, remainingShippingRefundableAmount]);

    const normalizedRefundItems = useMemo(() => {
        return buildNormalizedRefundItems(refundData.items);
    }, [refundData.items]);

    const estimatedItemsRefundAmount = useMemo(() => {
        return normalizedRefundItems.reduce((sum, row) => {
            const item = (order?.items ?? []).find((entry) => Number(entry.id) === Number(row.order_item_id));
            if (!item) return sum;

            return (
                sum +
                calculateProportionalLineAmount(
                    item.total_amount,
                    item.qty,
                    row.qty
                )
            );
        }, 0);
    }, [normalizedRefundItems, order?.items]);

    const estimatedRefundTotal = estimatedItemsRefundAmount + normalizedShippingRefundAmount;

    function scrollToQuickRefund() {
        if (quickRefundRef.current) {
            quickRefundRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }

    function submitShipment(e) {
        e.preventDefault();

        router.patch(
            route("admin.orders.shipment.update", {
                locale,
                order: order.id,
            }),
            {
                tracking_number: shipmentData.tracking_number || null,
                status: shipmentData.status,
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function updateRefundQty(orderItemId, value) {
        clearRefundErrors();
        setRefundData(
            "items",
            (refundData.items ?? []).map((row) =>
                row.order_item_id === orderItemId ? { ...row, qty: value } : row
            )
        );
    }

    function buildNormalizedRefundItems(items) {
        return (items ?? [])
            .map((row) => ({
                order_item_id: Number(row.order_item_id),
                qty: Number(row.qty || 0),
            }))
            .filter((row) => row.order_item_id > 0 && row.qty > 0);
    }

    function submitRefundRequest(normalizedItems, reason = null, notes = null) {
        if ((!normalizedItems.length && normalizedShippingRefundAmount <= 0) || refundProcessing) {
            return;
        }

        const currentKey = refundData.idempotency_key || makeIdempotencyKey();

        router.post(
            route("admin.orders.refunds.store", {
                locale,
                order: order.id,
            }),
            {
                reason,
                notes,
                idempotency_key: currentKey,
                refund_shipping: !!refundData.refund_shipping,
                shipping_amount: refundData.refund_shipping ? normalizedShippingRefundAmount : 0,
                items: normalizedItems,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onFinish: () => {
                    setRefundData("idempotency_key", makeIdempotencyKey());
                },
            }
        );
    }

    function submitRefund(e) {
        e.preventDefault();

        submitRefundRequest(normalizedRefundItems, refundData.reason || null, refundData.notes || null);
    }

    function fullRefundNow() {
        if (refundProcessing) return;

        const normalizedItems = refundableItems
            .map((item) => ({
                order_item_id: item.id,
                qty: Number(item.remaining_refundable_qty ?? 0),
            }))
            .filter((row) => row.qty > 0);

        const includeShipping = hasRefundableShipping;

        setRefundData((current) => ({
            ...current,
            refund_shipping: includeShipping,
            shipping_amount: includeShipping ? String(remainingShippingRefundableAmount) : "",
        }));

        router.post(
            route("admin.orders.refunds.store", {
                locale,
                order: order.id,
            }),
            {
                reason: refundData.reason || null,
                notes: refundData.notes || null,
                idempotency_key: refundData.idempotency_key || makeIdempotencyKey(),
                refund_shipping: includeShipping,
                shipping_amount: includeShipping ? remainingShippingRefundableAmount : 0,
                items: normalizedItems,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onFinish: () => {
                    setRefundData("idempotency_key", makeIdempotencyKey());
                },
            }
        );
    }

    function fillFullRefund() {
        setRefundData((current) => ({
            ...current,
            refund_shipping: hasRefundableShipping,
            shipping_amount: hasRefundableShipping ? String(remainingShippingRefundableAmount) : "",
            items: refundableItems.map((item) => ({
                order_item_id: item.id,
                qty: String(item.remaining_refundable_qty ?? 0),
            })),
        }));
    }

    function fillRefundFromReturn(ret) {
        const generatedItems = (ret?.items ?? [])
            .filter((item) => item?.resolution === "refund" && Number(item?.received_qty ?? 0) > 0)
            .map((item) => {
                const orderItemId = Number(item.order_item_id);
                const available = Number(refundableQtyByOrderItemId.get(orderItemId) ?? 0);
                const qty = Math.min(Number(item.received_qty ?? 0), available);

                return {
                    order_item_id: orderItemId,
                    qty: qty > 0 ? String(qty) : "",
                };
            });

        const generatedById = new Map(
            generatedItems.map((row) => [Number(row.order_item_id), row.qty])
        );

        setRefundData({
            reason: ret?.reason ?? "",
            notes: ret?.return_number
                ? t("ui.admin_orders_show.refund_from_return_note", {
                    defaultValue: `Refund gerado a partir da devolução ${ret.return_number}`,
                    return_number: ret.return_number,
                })
                : t(
                    "ui.admin_orders_show.refund_from_received_return_note",
                    "Refund gerado a partir da devolução recebida"
                ),
            refund_shipping: false,
            shipping_amount: "",
            idempotency_key: makeIdempotencyKey(),
            items: refundableItems.map((item) => ({
                order_item_id: item.id,
                qty: generatedById.get(Number(item.id)) ?? "",
            })),
        });

        scrollToQuickRefund();
    }

    function fillRefundFromReturnWithShipping(ret) {
        const generatedItems = (ret?.items ?? [])
            .filter((item) => item?.resolution === "refund" && Number(item?.received_qty ?? 0) > 0)
            .map((item) => {
                const orderItemId = Number(item.order_item_id);
                const available = Number(refundableQtyByOrderItemId.get(orderItemId) ?? 0);
                const qty = Math.min(Number(item.received_qty ?? 0), available);

                return {
                    order_item_id: orderItemId,
                    qty: qty > 0 ? String(qty) : "",
                };
            });

        const generatedById = new Map(
            generatedItems.map((row) => [Number(row.order_item_id), row.qty])
        );

        const remainingShipping = Number(order?.remaining_shipping_refundable_amount ?? 0);

        setRefundData({
            reason: ret?.reason ?? "",
            notes: ret?.return_number
                ? t("ui.admin_orders_show.refund_from_return_note", {
                    defaultValue: `Refund gerado a partir da devolução ${ret.return_number}`,
                    return_number: ret.return_number,
                })
                : t(
                    "ui.admin_orders_show.refund_from_received_return_note",
                    "Refund gerado a partir da devolução recebida"
                ),
            refund_shipping: remainingShipping > 0,
            shipping_amount: remainingShipping > 0 ? String(remainingShipping) : "",
            idempotency_key: makeIdempotencyKey(),
            items: refundableItems.map((item) => ({
                order_item_id: item.id,
                qty: generatedById.get(Number(item.id)) ?? "",
            })),
        });

        scrollToQuickRefund();
    }

    function generateRefundFromReturn(ret) {
        if (refundProcessing) return;

        router.post(
            route("admin.orders.returns.refund", {
                locale,
                order: order.id,
                return: ret.id,
            }),
            {
                idempotency_key: makeIdempotencyKey(),
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function clearRefundForm() {
        resetRefund();
        setRefundData({
            reason: "",
            notes: "",
            refund_shipping: false,
            shipping_amount: "",
            idempotency_key: makeIdempotencyKey(),
            items: initialRefundItems,
        });
    }

    function updateReturnItem(orderItemId, patch) {
        clearReturnErrors();
        setReturnData(
            "items",
            (returnData.items ?? []).map((row) =>
                row.order_item_id === orderItemId ? { ...row, ...patch } : row
            )
        );
    }

    function submitCreateReturn(e) {
        e.preventDefault();

        const items = (returnData.items ?? [])
            .map((row) => ({
                order_item_id: Number(row.order_item_id),
                qty: Number(row.qty || 0),
                reason: row.reason || null,
                condition: row.condition || null,
                resolution: row.resolution || null,
            }))
            .filter((row) => row.order_item_id > 0 && row.qty > 0);

        if (!items.length || returnProcessing) {
            return;
        }

        router.post(
            route("admin.orders.returns.store", {
                locale,
                order: order.id,
            }),
            {
                reason: returnData.reason || null,
                notes: returnData.notes || null,
                items,
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function clearCreateReturnForm() {
        resetReturn();
        setReturnData({
            reason: "",
            notes: "",
            items: initialReturnItems,
        });
    }

    function updateOrderStatus(e) {
        e.preventDefault();
        if (!statusCode) return;

        router.patch(
            route("admin.orders.status.update", {
                locale,
                order: order.id,
            }),
            {
                status_code: statusCode,
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function approveReturn(returnId) {
        router.post(
            route("admin.orders.returns.approve", {
                locale,
                order: order.id,
                return: returnId,
            }),
            {},
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function rejectReturn(returnId) {
        router.post(
            route("admin.orders.returns.reject", {
                locale,
                order: order.id,
                return: returnId,
            }),
            {},
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function closeReturn(returnId) {
        router.post(
            route("admin.orders.returns.close", {
                locale,
                order: order.id,
                return: returnId,
            }),
            {},
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function updateReceiveField(returnId, orderItemId, field, value) {
        setReceiveForms((current) => ({
            ...current,
            [returnId]: {
                ...(current[returnId] ?? { notes: "", items: [] }),
                items: (current[returnId]?.items ?? []).map((row) =>
                    row.order_item_id === orderItemId ? { ...row, [field]: value } : row
                ),
            },
        }));
    }

    function updateReceiveNotes(returnId, value) {
        setReceiveForms((current) => ({
            ...current,
            [returnId]: {
                ...(current[returnId] ?? { notes: "", items: [] }),
                notes: value,
            },
        }));
    }

    function submitReceive(returnEntry) {
        const form = receiveForms[returnEntry.id] ?? { notes: "", items: [] };

        router.post(
            route("admin.orders.returns.receive", {
                locale,
                order: order.id,
                return: returnEntry.id,
            }),
            {
                notes: form.notes || null,
                items: (form.items ?? []).map((row) => ({
                    order_item_id: Number(row.order_item_id),
                    received_qty: Number(row.received_qty || 0),
                    restock_qty: Number(row.restock_qty || 0),
                })),
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    function updateExchangeField(returnId, orderItemId, field, value) {
        setExchangeForms((current) => ({
            ...current,
            [returnId]: {
                ...(current[returnId] ?? { tracking_number: "", notes: "", items: [] }),
                items: (current[returnId]?.items ?? []).map((row) =>
                    row.order_item_id === orderItemId ? { ...row, [field]: value } : row
                ),
            },
        }));
    }

    function updateExchangeMeta(returnId, field, value) {
        setExchangeForms((current) => ({
            ...current,
            [returnId]: {
                ...(current[returnId] ?? { tracking_number: "", notes: "", items: [] }),
                [field]: value,
            },
        }));
    }

    function submitExchangeShipment(returnEntry) {
        const form = exchangeForms[returnEntry.id] ?? { tracking_number: "", notes: "", items: [] };

        const items = (form.items ?? [])
            .map((row) => ({
                order_item_id: Number(row.order_item_id),
                shipped_qty: Number(row.shipped_qty || 0),
            }))
            .filter((row) => row.order_item_id > 0 && row.shipped_qty > 0);

        if (!items.length) return;

        router.post(
            route("admin.orders.returns.exchange_ship", {
                locale,
                order: order.id,
                return: returnEntry.id,
            }),
            {
                tracking_number: form.tracking_number || null,
                notes: form.notes || null,
                items,
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    }

    const openReturns = (order?.returns ?? []).filter((ret) =>
        ["requested", "approved", "received"].includes(ret.status)
    ).length;

    const allErrors = Object.entries(errors ?? {});

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.orders.view", "Ver")} · {order?.order_number}
                        </h2>
                        <div className="mt-1 text-sm text-gray-600">
                            {t("ui.orders.date", "Data")}: {formatDateTime(order?.created_at)}
                        </div>
                    </div>

                    <Link
                        href={route("admin.orders.index", { locale })}
                        className="text-sm text-gray-900 underline"
                    >
                        {t("ui.admin.back_to_admin", "Voltar ao Admin")}
                    </Link>
                </div>
            }
        >
            <Head title={`${t("ui.orders.view", "Ver")} ${order?.order_number ?? ""}`} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <SummaryCard
                            label={t("ui.admin_orders_show.summary_order_total", "Total encomenda")}
                            value={formatMoney(order?.total_amount ?? 0, order?.currency)}
                        />
                        <SummaryCard
                            label={t("ui.admin_orders_show.summary_total_refunded", "Total reembolsado")}
                            value={formatMoney(order?.refunded_total_amount ?? 0, order?.currency)}
                            tone="text-orange-700"
                        />
                        <SummaryCard
                            label={t("ui.admin_orders_show.summary_remaining_refundable", "Por reembolsar")}
                            value={formatMoney(order?.remaining_refundable_amount ?? 0, order?.currency)}
                            tone="text-green-700"
                        />
                        <SummaryCard
                            label={t("ui.admin_orders_show.summary_open_returns", "Devoluções abertas")}
                            value={String(openReturns)}
                            tone="text-blue-700"
                        />
                    </div>

                    {allErrors.length > 0 ? (
                        <InlineInfo tone="red">
                            <div className="font-semibold">
                                {t("ui.common.validation_error", "Please check the form fields.")}
                            </div>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                {allErrors.map(([key, value]) => (
                                    <li key={key}>
                                        <strong>{key}:</strong> {value}
                                    </li>
                                ))}
                            </ul>
                        </InlineInfo>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <div className="space-y-4 xl:col-span-2">
                            <SectionCard
                                title={t("ui.admin_orders_show.order_overview", "Visão geral")}
                                subtitle={t("ui.admin_orders_show.order_overview_help", "Estado atual, cliente, pagamento e moradas da encomenda.")}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    {statusBadge(order?.status?.code, order?.status?.name ?? "-")}
                                    {paymentBadge(order?.payment?.status, t)}
                                    {order?.shipment ? shipmentStatusBadge(order.shipment.status, t) : null}
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="text-sm">
                                        <div className="font-semibold text-gray-900">
                                            {t("ui.orders.customer", "Cliente")}
                                        </div>
                                        <div className="mt-2 text-gray-700">{order?.customer?.name ?? "-"}</div>
                                        <div className="text-gray-600">{order?.customer?.email ?? "-"}</div>
                                    </div>

                                    <div className="text-sm">
                                        <div className="font-semibold text-gray-900">
                                            {t("ui.thankyou.payment", "Pagamento")}
                                        </div>
                                        <div className="mt-2 text-gray-700">{order?.payment?.method_name ?? "-"}</div>
                                        <div className="text-gray-600">{order?.payment?.method_code ?? "-"}</div>
                                        <div className="text-gray-600">
                                            {formatMoney(order?.payment?.amount ?? 0, order?.currency)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="text-sm">
                                        <div className="font-semibold text-gray-900">
                                            {t("ui.thankyou.shipping_address", "Envio")}
                                        </div>
                                        <div className="mt-2 rounded-md bg-gray-50 p-3 text-gray-700">
                                            {order?.is_pickup
                                                ? (order?.shipping_label || t("ui.orders.pickup_in_store", "Levantamento em loja"))
                                                : formatAddress(order?.shipping_address)}
                                        </div>
                                    </div>

                                    <div className="text-sm">
                                        <div className="font-semibold text-gray-900">
                                            {t("ui.thankyou.billing_address", "Faturação")}
                                        </div>
                                        <div className="mt-2 rounded-md bg-gray-50 p-3 text-gray-700">
                                            {formatAddress(order?.billing_address)}
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>

                            {order?.shipment && !isPickup ? (
                                <SectionCard
                                    title={t("ui.shipments.title", "Envio")}
                                    subtitle={t("ui.shipments.admin_edit_help", "Atualiza tracking e estado logístico do envio.")}
                                >
                                    <div className="rounded-md bg-gray-50 p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {shipmentStatusBadge(order.shipment.status, t)}
                                        </div>

                                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {t("ui.shipments.method", "Método")}:
                                                </span>{" "}
                                                {order.shipment.method_name ?? "-"}
                                                {order.shipment.method_code ? ` (${order.shipment.method_code})` : ""}
                                            </div>

                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {t("ui.orders.tracking_number", "Tracking")}:
                                                </span>{" "}
                                                {order.shipment.tracking_number ?? "-"}
                                            </div>

                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {t("ui.shipments.shipped_at", "Enviado em")}:
                                                </span>{" "}
                                                {formatDateTime(order.shipment.shipped_at)}
                                            </div>

                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {t("ui.shipments.delivered_at", "Entregue em")}:
                                                </span>{" "}
                                                {formatDateTime(order.shipment.delivered_at)}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="text-sm font-semibold text-gray-900">
                                                {t("ui.shipments.items", "Itens do envio")}
                                            </div>

                                            {(order.shipment.items ?? []).length > 0 ? (
                                                <div className="mt-2 overflow-x-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead className="bg-white text-left text-xs uppercase tracking-wide text-gray-500">
                                                            <tr>
                                                                <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                                <th className="px-3 py-2">SKU</th>
                                                                <th className="px-3 py-2">{t("ui.thankyou.qty", "Qtd")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(order.shipment.items ?? []).map((item) => (
                                                                <tr key={item.id} className="border-t">
                                                                    <td className="px-3 py-2">{item.item_name ?? "-"}</td>
                                                                    <td className="px-3 py-2">{item.item_sku ?? "-"}</td>
                                                                    <td className="px-3 py-2">{item.qty}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-sm text-gray-600">
                                                    {t("ui.shipments.no_items", "Sem itens de envio registados.")}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <form onSubmit={submitShipment} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.orders.tracking_number", "Tracking")}
                                            </label>
                                            <input
                                                value={shipmentData.tracking_number}
                                                onChange={(e) => setShipmentData("tracking_number", e.target.value)}
                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                placeholder={t("ui.shipments.tracking_placeholder", "Ex: CTT123456789PT")}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.orders.status", "Estado")}
                                            </label>
                                            <select
                                                value={shipmentData.status}
                                                onChange={(e) => setShipmentData("status", e.target.value)}
                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                            >
                                                <option value="pending">{t("ui.shipments.status_pending", "Pendente")}</option>
                                                <option value="shipped">{t("ui.shipments.status_shipped", "Enviado")}</option>
                                                <option value="delivered">{t("ui.shipments.status_delivered", "Entregue")}</option>
                                                <option value="returned">{t("ui.shipments.status_returned", "Devolvido")}</option>
                                                <option value="cancelled">{t("ui.shipments.status_cancelled", "Cancelado")}</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            <button
                                                type="submit"
                                                disabled={shipmentProcessing}
                                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                                            >
                                                {shipmentProcessing
                                                    ? t("ui.common.saving", "A guardar...")
                                                    : t("ui.shipments.save", "Guardar envio")}
                                            </button>
                                        </div>
                                    </form>
                                </SectionCard>
                            ) : null}

                            <OperationalTimeline order={order} t={t} />

                            <SectionCard
                                title={t("ui.admin_orders_show.order_items", "Itens da encomenda")}
                                subtitle={t("ui.admin_orders_show.order_items_help", "Resumo por linha, quantidades reembolsadas e quantidades ainda devolvíveis.")}
                            >
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                <th className="px-3 py-2">SKU</th>
                                                <th className="px-3 py-2">{t("ui.thankyou.qty", "Qtd")}</th>
                                                <th className="px-3 py-2">{t("ui.thankyou.unit_price", "Unit")}</th>
                                                <th className="px-3 py-2">{t("ui.refunds.title", "Refunds")}</th>
                                                <th className="px-3 py-2">{t("ui.returns.remaining_returnable_qty", "Devolvível")}</th>
                                                <th className="px-3 py-2">{t("ui.thankyou.total", "Total")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(order?.items ?? []).map((item) => (
                                                <tr key={item.id} className="border-t">
                                                    <td className="px-3 py-3">{item.name}</td>
                                                    <td className="px-3 py-3">{item.sku}</td>
                                                    <td className="px-3 py-3">{item.qty}</td>
                                                    <td className="px-3 py-3">{formatMoney(item.unit_amount, order.currency)}</td>
                                                    <td className="px-3 py-3">
                                                        {item.refunded_qty} / {formatMoney(item.refunded_amount, order.currency)}
                                                    </td>
                                                    <td className="px-3 py-3">{item.remaining_returnable_qty}</td>
                                                    <td className="px-3 py-3">{formatMoney(item.total_amount, order.currency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </SectionCard>

                            <div ref={quickRefundRef}>
                                <SectionCard
                                    title={t("ui.admin_orders_show.quick_refund", "Refund rápido")}
                                    subtitle={t("ui.admin_orders_show.quick_refund_help", "Criar refund manual para linhas elegíveis ou preencher automaticamente o refund total.")}
                                    actions={
                                        order?.can_refund ? (
                                            <button
                                                type="button"
                                                onClick={fullRefundNow}
                                                disabled={refundProcessing}
                                                className="rounded-md border px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                {t("ui.admin_orders_show.full_refund_now", "Refund total agora")}
                                            </button>
                                        ) : null
                                    }
                                >
                                    {!order?.can_refund ? (
                                        <InlineInfo tone="amber">
                                            {t(
                                                "ui.refunds.not_available_for_order",
                                                "Este pedido não está elegível para refund neste momento."
                                            )}
                                        </InlineInfo>
                                    ) : (
                                        <form onSubmit={submitRefund} className="space-y-4">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                                        <tr>
                                                            <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                            <th className="px-3 py-2">SKU</th>
                                                            <th className="px-3 py-2">{t("ui.admin_orders_show.available", "Disponível")}</th>
                                                            <th className="px-3 py-2">{t("ui.thankyou.unit_price", "Unit")}</th>
                                                            <th className="px-3 py-2">{t("ui.admin_orders_show.qty_refund", "Qtd refund")}</th>
                                                            <th className="px-3 py-2">{t("ui.admin_orders_show.line_value", "Valor desta linha")}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {refundableItems.map((item) => {
                                                            const row = (refundData.items ?? []).find((x) => x.order_item_id === item.id);
                                                            const qty = Number(row?.qty || 0);
                                                            const proportionalAmount = calculateProportionalLineAmount(
                                                                item.total_amount,
                                                                item.qty,
                                                                qty
                                                            );

                                                            return (
                                                                <tr key={item.id} className="border-t">
                                                                    <td className="px-3 py-3">{item.name}</td>
                                                                    <td className="px-3 py-3">{item.sku}</td>
                                                                    <td className="px-3 py-3">{item.remaining_refundable_qty}</td>
                                                                    <td className="px-3 py-3">{formatMoney(item.unit_amount, order.currency)}</td>
                                                                    <td className="px-3 py-3">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={item.remaining_refundable_qty}
                                                                            value={row?.qty ?? ""}
                                                                            onChange={(e) => updateRefundQty(item.id, e.target.value)}
                                                                            className="w-24 rounded-md border px-3 py-2"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3 font-semibold">
                                                                        {formatMoney(proportionalAmount, order.currency)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {hasRefundableShipping ? (
                                                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {t("ui.refunds.shipping_refund", "Refund de portes")}
                                                    </div>
                                                    <div className="mt-1 text-sm text-gray-700">
                                                        {t(
                                                            "ui.refunds.shipping_refund_help",
                                                            "Podes incluir total ou parcialmente o valor dos portes neste refund."
                                                        )}
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
                                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!refundData.refund_shipping}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setRefundData("refund_shipping", checked);
                                                                    setRefundData(
                                                                        "shipping_amount",
                                                                        checked ? String(remainingShippingRefundableAmount) : ""
                                                                    );
                                                                }}
                                                            />
                                                            <span>
                                                                {t("ui.refunds.include_shipping_in_refund", "Incluir portes neste refund")}
                                                            </span>
                                                        </label>

                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700">
                                                                {t("ui.refunds.shipping_amount", "Valor dos portes")}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={remainingShippingRefundableAmount}
                                                                step="1"
                                                                disabled={!refundData.refund_shipping}
                                                                value={refundData.shipping_amount}
                                                                onChange={(e) => setRefundData("shipping_amount", e.target.value)}
                                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-100"
                                                            />
                                                        </div>

                                                        <div className="text-sm text-gray-700">
                                                            <div>
                                                                {t("ui.refunds.shipping_refundable_remaining", "Portes ainda reembolsáveis")}:
                                                            </div>
                                                            <div className="mt-1 font-semibold text-gray-900">
                                                                {formatMoney(remainingShippingRefundableAmount, order.currency)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className="rounded-xl border bg-gray-50 p-4">
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                    <div>
                                                        <div className="text-xs uppercase tracking-wide text-gray-500">
                                                            {t("ui.refunds.items_amount", "Artigos")}
                                                        </div>
                                                        <div className="mt-1 text-lg font-semibold text-gray-900">
                                                            {formatMoney(estimatedItemsRefundAmount, order.currency)}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="text-xs uppercase tracking-wide text-gray-500">
                                                            {t("ui.refunds.shipping", "Portes")}
                                                        </div>
                                                        <div className="mt-1 text-lg font-semibold text-gray-900">
                                                            {formatMoney(normalizedShippingRefundAmount, order.currency)}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="text-xs uppercase tracking-wide text-gray-500">
                                                            {t("ui.refunds.estimated_total", "Total estimado")}
                                                        </div>
                                                        <div className="mt-1 text-lg font-semibold text-orange-700">
                                                            {formatMoney(estimatedRefundTotal, order.currency)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        {t("ui.refunds.reason", "Motivo")}
                                                    </label>
                                                    <input
                                                        value={refundData.reason}
                                                        onChange={(e) => setRefundData("reason", e.target.value)}
                                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        {t("ui.refunds.notes", "Notas")}
                                                    </label>
                                                    <input
                                                        value={refundData.notes}
                                                        onChange={(e) => setRefundData("notes", e.target.value)}
                                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={refundProcessing}
                                                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                                                >
                                                    {t("ui.refunds.create", "Criar refund")}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={fillFullRefund}
                                                    disabled={refundProcessing}
                                                    className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    {t("ui.refunds.fill_full_refund", "Preencher total")}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={clearRefundForm}
                                                    disabled={refundProcessing}
                                                    className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    {t("ui.orders.clear", "Limpar")}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </SectionCard>
                            </div>

                            <SectionCard
                                title={t("ui.returns.title", "Devoluções")}
                                subtitle={t("ui.admin_orders_show.returns_help", "Aprovação, receção, troca e fecho da devolução num único fluxo.")}
                            >
                                {(order?.returns ?? []).length === 0 ? (
                                    <EmptyState>
                                        {t("ui.admin_orders_show.no_returns_yet", "Ainda não existem devoluções nesta encomenda.")}
                                    </EmptyState>
                                ) : (
                                    <div className="space-y-4">
                                        {order.returns.map((ret) => {
                                            const receiveForm = receiveForms[ret.id] ?? { notes: "", items: [] };
                                            const exchangeForm = exchangeForms[ret.id] ?? {
                                                tracking_number: "",
                                                notes: "",
                                                items: [],
                                            };
                                            const exchangeRows = (ret.items ?? []).filter((item) => item.resolution === "exchange");
                                            const refundRows = (ret.items ?? []).filter((item) => item.resolution === "refund");
                                            const refundableFromThisReturn = refundRows.some(
                                                (item) => Number(item?.received_qty ?? 0) > 0
                                            );

                                            const pendingRefundQty = refundRows.reduce((sum, item) => {
                                                return sum + Number(item?.remaining_refundable_for_this_return_item ?? 0);
                                            }, 0);

                                            const hasPendingRefund = pendingRefundQty > 0;
                                            const canCloseReturn = !hasPendingRefund;

                                            return (
                                                <details
                                                    key={ret.id}
                                                    className="rounded-xl border"
                                                    open={ret.status !== "closed"}
                                                >
                                                    <summary className="cursor-pointer list-none p-4">
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold text-gray-900">
                                                                        {ret.return_number ?? `#${ret.id}`}
                                                                    </span>
                                                                    {returnStatusBadge(ret.status, t)}
                                                                </div>
                                                                <div className="mt-1 text-sm text-gray-600">
                                                                    {t("ui.returns.requested_at", "Pedida")}: {formatDateTime(ret.requested_at)}
                                                                </div>
                                                            </div>

                                                            <div className="text-sm text-gray-600">
                                                                {ret.items.length} {t("ui.admin_orders_show.items_count_suffix", "artigo(s)")}
                                                            </div>
                                                        </div>
                                                    </summary>

                                                    <div className="border-t p-4">
                                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                                            <div className="rounded-md bg-gray-50 p-3 text-sm">
                                                                <div className="font-semibold text-gray-900">
                                                                    {t("ui.admin_orders_show.summary", "Resumo")}
                                                                </div>
                                                                <div className="mt-2 text-gray-700">
                                                                    {t("ui.returns.reason", "Motivo")}: {ret.reason || "-"}
                                                                </div>
                                                                <div className="text-gray-700">
                                                                    {t("ui.returns.notes", "Notas")}: {ret.notes || "-"}
                                                                </div>
                                                                <div className="text-gray-700">
                                                                    {t("ui.returns.approved_at", "Aprovada")}: {formatDateTime(ret.approved_at)}
                                                                </div>
                                                                <div className="text-gray-700">
                                                                    {t("ui.returns.received_at", "Recebida")}: {formatDateTime(ret.received_at)}
                                                                </div>
                                                                <div className="text-gray-700">
                                                                    {t("ui.returns.closed_at", "Fechada")}: {formatDateTime(ret.closed_at)}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-md bg-gray-50 p-3 text-sm">
                                                                <div className="font-semibold text-gray-900">
                                                                    {t("ui.admin_orders_show.potential_refund", "Refund potencial")}
                                                                </div>
                                                                <div className="mt-2 text-gray-700">
                                                                    {formatMoney(
                                                                        refundRows.reduce(
                                                                            (sum, item) => sum + Number(item.potential_refund_amount || 0),
                                                                            0
                                                                        ),
                                                                        order.currency
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-md bg-gray-50 p-3 text-sm">
                                                                <div className="font-semibold text-gray-900">
                                                                    {t("ui.admin_orders_show.exchanges_to_ship", "Trocas por reenviar")}
                                                                </div>
                                                                <div className="mt-2 text-gray-700">
                                                                    {exchangeRows.reduce(
                                                                        (sum, item) => sum + Number(item.exchange_remaining_qty || 0),
                                                                        0
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 overflow-x-auto">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                                                    <tr>
                                                                        <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                                        <th className="px-3 py-2">SKU</th>
                                                                        <th className="px-3 py-2">{t("ui.returns.resolution", "Resolução")}</th>
                                                                        <th className="px-3 py-2">{t("ui.returns.qty", "Qtd")}</th>
                                                                        <th className="px-3 py-2">{t("ui.returns.received_qty", "Recebida")}</th>
                                                                        <th className="px-3 py-2">{t("ui.returns.restock_qty", "Restock")}</th>
                                                                        <th className="px-3 py-2">{t("ui.thankyou.unit_price", "Unit")}</th>
                                                                        <th className="px-3 py-2">{t("ui.refunds.refund", "Refund")}</th>
                                                                        <th className="px-3 py-2">{t("ui.admin_orders_show.resent", "Reenviado")}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(ret.items ?? []).map((item) => (
                                                                        <tr key={item.id} className="border-t">
                                                                            <td className="px-3 py-3">{item.item_name ?? "-"}</td>
                                                                            <td className="px-3 py-3">{item.item_sku ?? "-"}</td>
                                                                            <td className="px-3 py-3">{item.resolution ?? "-"}</td>
                                                                            <td className="px-3 py-3">{item.qty}</td>
                                                                            <td className="px-3 py-3">{item.received_qty}</td>
                                                                            <td className="px-3 py-3">
                                                                                {item.is_inventory_product ? item.restock_qty : "N/A"}
                                                                            </td>
                                                                            <td className="px-3 py-3">{formatMoney(item.unit_amount, order.currency)}</td>
                                                                            <td className="px-3 py-3">
                                                                                {item.resolution === "refund"
                                                                                    ? formatMoney(item.received_refund_amount, order.currency)
                                                                                    : "-"}
                                                                            </td>
                                                                            <td className="px-3 py-3">
                                                                                {item.resolution === "exchange"
                                                                                    ? `${item.exchange_shipped_qty} / ${item.received_qty}`
                                                                                    : "-"}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {ret.status === "requested" ? (
                                                            <div className="mt-4 flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => approveReturn(ret.id)}
                                                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                                                >
                                                                    {t("ui.returns.approve", "Aprovar")}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => rejectReturn(ret.id)}
                                                                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                                                >
                                                                    {t("ui.returns.reject", "Rejeitar")}
                                                                </button>
                                                            </div>
                                                        ) : null}

                                                        {ret.status === "approved" ? (
                                                            <div className="mt-6 rounded-xl border bg-white p-4">
                                                                <div className="text-base font-semibold text-gray-900">
                                                                    {t("ui.admin_orders_show.return_receive_title", "Receção da devolução")}
                                                                </div>
                                                                <div className="mt-1 text-sm text-gray-600">
                                                                    {t(
                                                                        "ui.admin_orders_show.return_receive_help",
                                                                        "O restock é facultativo e pode ser 0 mesmo com artigo recebido."
                                                                    )}
                                                                </div>

                                                                <div className="mt-4 overflow-x-auto">
                                                                    <table className="min-w-full text-sm">
                                                                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                                                            <tr>
                                                                                <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                                                <th className="px-3 py-2">{t("ui.admin_orders_show.returned_qty", "Qtd devolvida")}</th>
                                                                                <th className="px-3 py-2">{t("ui.returns.received_qty", "Recebida")}</th>
                                                                                <th className="px-3 py-2">{t("ui.returns.restock_qty", "Restock")}</th>
                                                                                <th className="px-3 py-2">{t("ui.returns.resolution", "Resolução")}</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {(ret.items ?? []).map((item) => {
                                                                                const row = (receiveForm.items ?? []).find(
                                                                                    (x) => x.order_item_id === item.order_item_id
                                                                                );

                                                                                return (
                                                                                    <tr key={item.id} className="border-t">
                                                                                        <td className="px-3 py-3">{item.item_name}</td>
                                                                                        <td className="px-3 py-3">{item.qty}</td>
                                                                                        <td className="px-3 py-3">
                                                                                            <input
                                                                                                type="number"
                                                                                                min="0"
                                                                                                max={item.qty}
                                                                                                value={row?.received_qty ?? ""}
                                                                                                onChange={(e) =>
                                                                                                    updateReceiveField(
                                                                                                        ret.id,
                                                                                                        item.order_item_id,
                                                                                                        "received_qty",
                                                                                                        e.target.value
                                                                                                    )
                                                                                                }
                                                                                                className="w-24 rounded-md border px-3 py-2"
                                                                                            />
                                                                                        </td>
                                                                                        <td className="px-3 py-3">
                                                                                            {item.is_inventory_product ? (
                                                                                                <input
                                                                                                    type="number"
                                                                                                    min="0"
                                                                                                    max={row?.received_qty ?? item.qty}
                                                                                                    value={row?.restock_qty ?? ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateReceiveField(
                                                                                                            ret.id,
                                                                                                            item.order_item_id,
                                                                                                            "restock_qty",
                                                                                                            e.target.value
                                                                                                        )
                                                                                                    }
                                                                                                    className="w-24 rounded-md border px-3 py-2"
                                                                                                />
                                                                                            ) : (
                                                                                                <span className="text-gray-500">N/A</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-3 py-3">{item.resolution ?? "-"}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                <div className="mt-4">
                                                                    <label className="block text-sm font-medium text-gray-700">
                                                                        {t("ui.returns.notes", "Notas")}
                                                                    </label>
                                                                    <textarea
                                                                        rows={3}
                                                                        value={receiveForm.notes ?? ""}
                                                                        onChange={(e) => updateReceiveNotes(ret.id, e.target.value)}
                                                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                    />
                                                                </div>

                                                                <div className="mt-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => submitReceive(ret)}
                                                                        className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                                                                    >
                                                                        {t("ui.admin_orders_show.mark_as_received", "Marcar como recebida")}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        {ret.status === "received" ? (
                                                            <div className="mt-6 space-y-4">
                                                                {refundableFromThisReturn ? (
                                                                    <InlineInfo tone="orange">
                                                                        <div className="text-base font-semibold text-gray-900">
                                                                            {t("ui.admin_orders_show.pending_refund_from_return", "Refund pendente desta devolução")}
                                                                        </div>
                                                                        <div className="mt-1 text-sm text-gray-700">
                                                                            {t(
                                                                                "ui.admin_orders_show.pending_refund_from_return_help",
                                                                                "Podes preencher automaticamente o formulário de refund com base nas quantidades recebidas desta devolução."
                                                                            )}
                                                                        </div>
                                                                        {hasPendingRefund ? (
                                                                            <div className="mt-2 text-sm font-medium text-orange-800">
                                                                                {t(
                                                                                    "ui.admin_orders_show.pending_refund_exists",
                                                                                    "Ainda existem artigos/quantidades desta devolução por reembolsar."
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="mt-2 text-sm font-medium text-green-700">
                                                                                {t(
                                                                                    "ui.admin_orders_show.no_pending_refund_exists",
                                                                                    "Não existe refund pendente desta devolução."
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => generateRefundFromReturn(ret)}
                                                                                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                                                                            >
                                                                                {t(
                                                                                    "ui.admin_orders_show.generate_refund_from_return",
                                                                                    "Gerar reembolso desta devolução"
                                                                                )}
                                                                            </button>

                                                                            {Number(order?.remaining_shipping_refundable_amount ?? 0) > 0 ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => fillRefundFromReturnWithShipping(ret)}
                                                                                    className="rounded-md border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
                                                                                >
                                                                                    {t(
                                                                                        "ui.admin_orders_show.generate_refund_from_return_with_shipping",
                                                                                        "Gerar reembolso desta devolução + portes"
                                                                                    )}
                                                                                </button>
                                                                            ) : null}
                                                                        </div>
                                                                    </InlineInfo>
                                                                ) : null}

                                                                {exchangeRows.length > 0 ? (
                                                                    <div className="rounded-xl border bg-white p-4">
                                                                        <div className="text-base font-semibold text-gray-900">
                                                                            {t("ui.admin_orders_show.exchange_reship_title", "Reenvio de troca")}
                                                                        </div>
                                                                        <div className="mt-1 text-sm text-gray-600">
                                                                            {t(
                                                                                "ui.admin_orders_show.exchange_reship_help",
                                                                                "Regista o reenvio dos artigos de substituição."
                                                                            )}
                                                                        </div>

                                                                        <div className="mt-4 overflow-x-auto">
                                                                            <table className="min-w-full text-sm">
                                                                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2">{t("ui.email.item", "Item")}</th>
                                                                                        <th className="px-3 py-2">{t("ui.returns.received_qty", "Recebida")}</th>
                                                                                        <th className="px-3 py-2">{t("ui.admin_orders_show.already_resent", "Já reenviada")}</th>
                                                                                        <th className="px-3 py-2">{t("ui.admin_orders_show.to_resend", "Por reenviar")}</th>
                                                                                        <th className="px-3 py-2">{t("ui.admin_orders_show.qty_to_resend", "Qtd a reenviar")}</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {exchangeRows.map((item) => {
                                                                                        const row = (exchangeForm.items ?? []).find(
                                                                                            (x) => x.order_item_id === item.order_item_id
                                                                                        );

                                                                                        return (
                                                                                            <tr key={item.id} className="border-t">
                                                                                                <td className="px-3 py-3">{item.item_name}</td>
                                                                                                <td className="px-3 py-3">{item.received_qty}</td>
                                                                                                <td className="px-3 py-3">{item.exchange_shipped_qty}</td>
                                                                                                <td className="px-3 py-3">{item.exchange_remaining_qty}</td>
                                                                                                <td className="px-3 py-3">
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min="0"
                                                                                                        max={item.exchange_remaining_qty}
                                                                                                        value={row?.shipped_qty ?? ""}
                                                                                                        onChange={(e) =>
                                                                                                            updateExchangeField(
                                                                                                                ret.id,
                                                                                                                item.order_item_id,
                                                                                                                "shipped_qty",
                                                                                                                e.target.value
                                                                                                            )
                                                                                                        }
                                                                                                        className="w-24 rounded-md border px-3 py-2"
                                                                                                    />
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>

                                                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700">
                                                                                    {t("ui.orders.tracking_number", "Tracking")}
                                                                                </label>
                                                                                <input
                                                                                    value={exchangeForm.tracking_number ?? ""}
                                                                                    onChange={(e) =>
                                                                                        updateExchangeMeta(ret.id, "tracking_number", e.target.value)
                                                                                    }
                                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700">
                                                                                    {t("ui.returns.notes", "Notas")}
                                                                                </label>
                                                                                <input
                                                                                    value={exchangeForm.notes ?? ""}
                                                                                    onChange={(e) =>
                                                                                        updateExchangeMeta(ret.id, "notes", e.target.value)
                                                                                    }
                                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-4">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => submitExchangeShipment(ret)}
                                                                                className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
                                                                            >
                                                                                {t("ui.admin_orders_show.register_reshipment", "Registar reenvio")}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : null}

                                                                {!canCloseReturn ? (
                                                                    <InlineInfo tone="red">
                                                                        {t(
                                                                            "ui.admin_orders_show.cannot_close_return_pending_refund",
                                                                            "Não podes fechar esta devolução enquanto existir refund pendente relativo aos artigos recebidos com resolução de refund."
                                                                        )}
                                                                    </InlineInfo>
                                                                ) : null}

                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => closeReturn(ret.id)}
                                                                        disabled={!canCloseReturn}
                                                                        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        title={
                                                                            canCloseReturn
                                                                                ? t("ui.returns.close", "Fechar devolução")
                                                                                : t(
                                                                                    "ui.admin_orders_show.pending_refund_exists_short",
                                                                                    "Existe refund pendente nesta devolução"
                                                                                )
                                                                        }
                                                                    >
                                                                        {t("ui.returns.close", "Fechar devolução")}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        {ret.status === "rejected" ? (
                                                            <div className="mt-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => closeReturn(ret.id)}
                                                                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                                                >
                                                                    {t("ui.returns.close", "Fechar devolução")}
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard
                                title={t("ui.admin_orders_show.manual_return_create", "Criar devolução manual")}
                                subtitle={t("ui.admin_orders_show.manual_return_create_help", "Criar uma devolução administrativa diretamente sobre a encomenda.")}
                            >
                                <form onSubmit={submitCreateReturn} className="space-y-4">
                                    <div className="space-y-3">
                                        {returnableItems.map((item) => {
                                            const row = (returnData.items ?? []).find((x) => x.order_item_id === item.id);

                                            return (
                                                <div key={item.id} className="rounded-md border p-4">
                                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{item.name}</div>
                                                            <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                                                            <div className="mt-1 text-xs text-gray-600">
                                                                {t("ui.admin_orders_show.available_to_return", "Disponível para devolver")}:{" "}
                                                                <strong>{item.remaining_returnable_qty}</strong>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                            <div>
                                                                <label className="block text-xs text-gray-600">
                                                                    {t("ui.returns.qty", "Qty")}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={item.remaining_returnable_qty}
                                                                    value={row?.qty ?? ""}
                                                                    onChange={(e) => updateReturnItem(item.id, { qty: e.target.value })}
                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs text-gray-600">
                                                                    {t("ui.returns.resolution", "Resolução")}
                                                                </label>
                                                                <select
                                                                    value={row?.resolution ?? "refund"}
                                                                    onChange={(e) => updateReturnItem(item.id, { resolution: e.target.value })}
                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                >
                                                                    <option value="refund">{t("ui.returns.resolution_refund", "Refund")}</option>
                                                                    <option value="exchange">{t("ui.returns.resolution_exchange", "Troca")}</option>
                                                                    <option value="inspection">{t("ui.admin_orders_show.resolution_inspection", "Inspeção")}</option>
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs text-gray-600">
                                                                    {t("ui.returns.item_reason", "Motivo do artigo")}
                                                                </label>
                                                                <input
                                                                    value={row?.reason ?? ""}
                                                                    onChange={(e) => updateReturnItem(item.id, { reason: e.target.value })}
                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs text-gray-600">
                                                                    {t("ui.returns.condition", "Condição")}
                                                                </label>
                                                                <select
                                                                    value={row?.condition ?? ""}
                                                                    onChange={(e) => updateReturnItem(item.id, { condition: e.target.value })}
                                                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                                                >
                                                                    <option value="">{t("ui.common.select", "Selecionar")}</option>
                                                                    <option value="sealed">{t("ui.admin_orders_show.condition_sealed", "Selado")}</option>
                                                                    <option value="opened">{t("ui.admin_orders_show.condition_opened", "Aberto")}</option>
                                                                    <option value="used">{t("ui.admin_orders_show.condition_used", "Usado")}</option>
                                                                    <option value="damaged">{t("ui.admin_orders_show.condition_damaged", "Danificado")}</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.returns.reason", "Motivo")}
                                            </label>
                                            <input
                                                value={returnData.reason}
                                                onChange={(e) => setReturnData("reason", e.target.value)}
                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.returns.notes", "Notas")}
                                            </label>
                                            <input
                                                value={returnData.notes}
                                                onChange={(e) => setReturnData("notes", e.target.value)}
                                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            disabled={returnProcessing}
                                            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                                        >
                                            {t("ui.returns.create", "Criar devolução")}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={clearCreateReturnForm}
                                            disabled={returnProcessing}
                                            className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {t("ui.orders.clear", "Limpar")}
                                        </button>
                                    </div>
                                </form>
                            </SectionCard>
                        </div>

                        <div className="space-y-4">
                            <SectionCard
                                title={t("ui.admin_orders_show.financial_summary", "Resumo financeiro")}
                                subtitle={t("ui.admin_orders_show.financial_summary_help", "Valores finais da encomenda, descontos e totais.")}
                            >
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>{t("ui.thankyou.subtotal", "Subtotal")}</span>
                                        <span>{formatMoney(order?.subtotal_amount ?? 0, order?.currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t("ui.thankyou.shipping", "Shipping")}</span>
                                        <span>{formatMoney(order?.shipping_amount ?? 0, order?.currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t("ui.thankyou.tax", "Tax")}</span>
                                        <span>{formatMoney(order?.tax_amount ?? 0, order?.currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t("ui.thankyou.discount", "Discount")}</span>
                                        <span>- {formatMoney(order?.discount_amount ?? 0, order?.currency)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-3 font-semibold">
                                        <span>{t("ui.thankyou.total", "Total")}</span>
                                        <span>{formatMoney(order?.total_amount ?? 0, order?.currency)}</span>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard
                                title={t("ui.refunds.history", "Histórico de refunds")}
                                subtitle={t("ui.admin_orders_show.refund_history_help", "Registos de refund já criados para esta encomenda.")}
                            >
                                {(order?.refunds ?? []).length === 0 ? (
                                    <EmptyState>{t("ui.refunds.empty", "Sem refunds ainda.")}</EmptyState>
                                ) : (
                                    <div className="space-y-3">
                                        {order.refunds.map((refund) => {
                                            const shippingAmount = Number(refund.shipping_amount ?? 0);
                                            const itemsAmount = Math.max(0, Number(refund.amount ?? 0) - shippingAmount);

                                            return (
                                                <div key={refund.id} className="rounded-md border p-3 text-sm">
                                                    <div className="font-semibold text-gray-900">
                                                        #{refund.id} · {formatMoney(refund.amount, order.currency)}
                                                    </div>
                                                    <div className="mt-1 text-gray-600">{formatDateTime(refund.created_at)}</div>

                                                    <div className="mt-2 space-y-1 text-gray-700">
                                                        <div>
                                                            {t("ui.refunds.items_amount", "Artigos")}: {formatMoney(itemsAmount, order.currency)}
                                                        </div>
                                                        <div>
                                                            {t("ui.refunds.shipping", "Portes")}: {formatMoney(shippingAmount, order.currency)}
                                                        </div>
                                                    </div>

                                                    {refund.reason ? (
                                                        <div className="mt-2 text-gray-700">
                                                            {t("ui.refunds.reason", "Motivo")}: {refund.reason}
                                                        </div>
                                                    ) : null}
                                                    {refund.notes ? (
                                                        <div className="text-gray-700">
                                                            {t("ui.refunds.notes", "Notas")}: {refund.notes}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard
                                title={t("ui.admin_orders_show.status_timeline", "Timeline de estados")}
                                subtitle={t("ui.admin_orders_show.status_timeline_help", "Histórico técnico das transições de estado da encomenda.")}
                            >
                                <div className="space-y-3">
                                    {(order?.status_timeline ?? []).length === 0 ? (
                                        <EmptyState>
                                            {t("ui.admin_orders_show.no_status_history", "Sem histórico de estados.")}
                                        </EmptyState>
                                    ) : (
                                        order.status_timeline.map((entry) => (
                                            <div key={entry.id} className="border-l-2 border-gray-200 pl-3">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {entry.status_name ?? entry.status_code ?? "-"}
                                                </div>
                                                <div className="text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
                                                {entry.notes ? <div className="mt-1 text-sm text-gray-600">{entry.notes}</div> : null}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
