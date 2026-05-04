import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? "€";
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function formatDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString();
}

function statusBadge(statusCode, statusLabel) {
    const base = "inline-flex rounded-full px-2.5 py-1 text-xs font-medium";

    if (statusCode === "cancelled") {
        return <span className={`${base} bg-red-100 text-red-700`}>{statusLabel}</span>;
    }

    if (statusCode === "shipped" || statusCode === "delivered") {
        return <span className={`${base} bg-blue-100 text-blue-700`}>{statusLabel}</span>;
    }

    if (statusCode === "pending_payment") {
        return <span className={`${base} bg-amber-100 text-amber-700`}>{statusLabel}</span>;
    }

    if (statusCode === "processing") {
        return <span className={`${base} bg-indigo-100 text-indigo-700`}>{statusLabel}</span>;
    }

    return <span className={`${base} bg-green-100 text-green-700`}>{statusLabel}</span>;
}

function shipmentBadge(status, t) {
    const base = "inline-flex rounded-full px-2.5 py-1 text-xs font-medium";

    if (status === "pending") {
        return (
            <span className={`${base} bg-amber-100 text-amber-700`}>
                {t("ui.shipments.status_pending", "Pendente")}
            </span>
        );
    }

    if (status === "shipped") {
        return (
            <span className={`${base} bg-blue-100 text-blue-700`}>
                {t("ui.shipments.status_shipped", "Enviado")}
            </span>
        );
    }

    if (status === "delivered") {
        return (
            <span className={`${base} bg-green-100 text-green-700`}>
                {t("ui.shipments.status_delivered", "Entregue")}
            </span>
        );
    }

    if (status === "returned") {
        return (
            <span className={`${base} bg-purple-100 text-purple-700`}>
                {t("ui.shipments.status_returned", "Devolvido")}
            </span>
        );
    }

    if (status === "cancelled") {
        return (
            <span className={`${base} bg-red-100 text-red-700`}>
                {t("ui.shipments.status_cancelled", "Cancelado")}
            </span>
        );
    }

    return null;
}

function refundBadge(order, t) {
    if (order?.has_full_refund) {
        return (
            <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                {t("ui.refunds.full_refund_badge", "Refund total")}
            </span>
        );
    }

    if (order?.has_partial_refund) {
        return (
            <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                {t("ui.refunds.partial_refund_badge", "Refund parcial")}
            </span>
        );
    }

    return null;
}

function prettifyStatus(code, t) {
    const map = {
        pending_payment: t("ui.statuses.pending_payment", "A aguardar pagamento"),
        paid: t("ui.statuses.paid", "Pago"),
        processing: t("ui.statuses.processing", "A processar"),
        shipped: t("ui.statuses.shipped", "Enviado"),
        delivered: t("ui.statuses.delivered", "Entregue"),
        cancelled: t("ui.statuses.cancelled", "Cancelado"),
    };

    return map[code] ?? code;
}

export default function AdminOrdersIndex() {
    const { locale, orders, filters, availableStatuses } = usePage().props;
    const { t } = useI18n();

    const [q, setQ] = useState(filters?.q ?? "");
    const [status, setStatus] = useState(filters?.status ?? "");
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? "");
    const [dateTo, setDateTo] = useState(filters?.date_to ?? "");

    const [selectedStatuses, setSelectedStatuses] = useState({});
    const [updatingOrderId, setUpdatingOrderId] = useState(null);
    const [cancellingOrderId, setCancellingOrderId] = useState(null);

    useEffect(() => setQ(filters?.q ?? ""), [filters?.q]);
    useEffect(() => setStatus(filters?.status ?? ""), [filters?.status]);
    useEffect(() => setDateFrom(filters?.date_from ?? ""), [filters?.date_from]);
    useEffect(() => setDateTo(filters?.date_to ?? ""), [filters?.date_to]);

    useEffect(() => {
        const nextState = {};

        (orders?.data ?? []).forEach((order) => {
            const allowed = order.allowed_next_statuses ?? [];
            nextState[order.id] = allowed[0] ?? "";
        });

        setSelectedStatuses(nextState);
    }, [orders?.data]);

    function apply(e) {
        e.preventDefault();

        router.get(
            route("admin.orders.index", { locale }),
            {
                q: q || undefined,
                status: status || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            },
            { preserveScroll: true, preserveState: true }
        );
    }

    function clear() {
        setQ("");
        setStatus("");
        setDateFrom("");
        setDateTo("");

        router.get(
            route("admin.orders.index", { locale }),
            {},
            { preserveScroll: true, preserveState: true }
        );
    }

    function cancelOrder(order) {
        const statusCode = order.status?.code ?? "";

        if (["cancelled", "shipped", "delivered"].includes(statusCode)) {
            return;
        }

        const ok = confirm(
            t("ui.orders.cancel_confirm", "Cancel order :order and restore stock?")
                .replace(":order", order.order_number ?? "")
        );

        if (!ok) return;

        setCancellingOrderId(order.id);

        router.post(
            route("admin.orders.cancel", { locale, order: order.id }),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setCancellingOrderId(null),
            }
        );
    }

    function updateOrderStatus(order) {
        const nextStatus = selectedStatuses[order.id] ?? "";

        if (!nextStatus) {
            return;
        }

        if (nextStatus === order.status?.code) {
            return;
        }

        const ok = confirm(
            t("ui.orders.status_update_confirm", "Update order :order to :status?")
                .replace(":order", order.order_number ?? "")
                .replace(":status", prettifyStatus(nextStatus, t))
        );

        if (!ok) return;

        setUpdatingOrderId(order.id);

        router.patch(
            route("admin.orders.status.update", { locale, order: order.id }),
            {
                status_code: nextStatus,
                notes: null,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setUpdatingOrderId(null),
            }
        );
    }

    const qs = useMemo(() => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        return params.toString();
    }, [q, status, dateFrom, dateTo]);

    const exportOrdersHref = useMemo(() => {
        return route("admin.orders.export", { locale }) + (qs ? `?${qs}` : "");
    }, [locale, qs]);

    const exportItemsHref = useMemo(() => {
        return route("admin.orders.items.export", { locale }) + (qs ? `?${qs}` : "");
    }, [locale, qs]);

    const exportAccountingHref = useMemo(() => {
        return route("admin.orders.accounting.export", { locale }) + (qs ? `?${qs}` : "");
    }, [locale, qs]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.admin.orders_heading", "Admin · Orders")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t("ui.admin.orders_desc", "Manage orders, statuses and CSV exports.")}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("admin.dashboard", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.admin.back_to_admin", "Back to Admin")}
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title={t("ui.admin.orders_title", "Orders")} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t("ui.orders.title", "Orders")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t("ui.orders.subtitle", "List and CSV exports with filters")}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href={exportOrdersHref}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                        title={t(
                                            "ui.orders.export_orders_csv_title",
                                            "Export orders (includes total in cents and decimal)"
                                        )}
                                    >
                                        {t("ui.orders.export_orders_csv", "Export Orders CSV")}
                                    </a>

                                    <a
                                        href={exportItemsHref}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                        title={t(
                                            "ui.orders.export_items_csv_title",
                                            "Export order items (rows)"
                                        )}
                                    >
                                        {t("ui.orders.export_items_csv", "Export Items CSV")}
                                    </a>

                                    <a
                                        href={exportAccountingHref}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                        title={t(
                                            "ui.orders.export_accounting_csv_title",
                                            "Export accounting CSV with subtotal, tax, shipping and total"
                                        )}
                                    >
                                        {t("ui.orders.export_accounting_csv", "Export Accounting CSV")}
                                    </a>
                                </div>
                            </div>

                            <form
                                onSubmit={apply}
                                className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end"
                            >
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-600">
                                        {t("ui.orders.search", "Search")}
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder={t(
                                            "ui.orders.search_placeholder",
                                            "Order number, name or email…"
                                        )}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t("ui.orders.status", "Status")}
                                    </label>
                                    <select
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        {(availableStatuses ?? []).map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
                                        {t("ui.orders.apply", "Apply")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clear}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800"
                                    >
                                        {t("ui.orders.clear", "Clear")}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t("ui.orders.from", "From")}
                                    </label>
                                    <input
                                        type="date"
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t("ui.orders.until", "Until")}
                                    </label>
                                    <input
                                        type="date"
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                            </form>

                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full border">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.number", "No.")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.customer", "Customer")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.status", "Status")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.shipments.title", "Envio")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.total", "Total")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.date", "Date")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.actions", "Actions")}
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(orders?.data ?? []).map((o) => {
                                            const statusCode = o.status?.code ?? "";
                                            const statusLabel = o.status?.name ?? o.status?.code ?? "-";
                                            const allowedNextStatuses = o.allowed_next_statuses ?? [];
                                            const selectedNextStatus = selectedStatuses[o.id] ?? "";
                                            const canUpdate =
                                                allowedNextStatuses.length > 0 &&
                                                !!selectedNextStatus &&
                                                updatingOrderId !== o.id &&
                                                cancellingOrderId !== o.id;

                                            const canCancel =
                                                !["cancelled", "shipped", "delivered"].includes(statusCode) &&
                                                updatingOrderId !== o.id &&
                                                cancellingOrderId !== o.id;

                                            return (
                                                <tr key={o.id} className="hover:bg-gray-50">
                                                    <td className="border px-3 py-2 text-sm font-medium text-gray-900">
                                                        {o.order_number}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        <div className="font-medium">
                                                            {o.customer?.name ?? "-"}
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {o.customer?.email ?? "-"}
                                                        </div>
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700 align-top">
                                                        <div className="space-y-2">
                                                            <div className="flex flex-wrap gap-2">
                                                                {statusBadge(statusCode, statusLabel)}
                                                                {refundBadge(o, t)}
                                                            </div>

                                                            {allowedNextStatuses.length > 0 && (
                                                                <div className="max-w-[220px]">
                                                                    <select
                                                                        className="w-full rounded-md border px-3 py-2 text-sm"
                                                                        value={selectedNextStatus}
                                                                        onChange={(e) =>
                                                                            setSelectedStatuses((prev) => ({
                                                                                ...prev,
                                                                                [o.id]: e.target.value,
                                                                            }))
                                                                        }
                                                                        disabled={
                                                                            updatingOrderId === o.id ||
                                                                            cancellingOrderId === o.id
                                                                        }
                                                                    >
                                                                        {allowedNextStatuses.map((code) => (
                                                                            <option key={code} value={code}>
                                                                                {prettifyStatus(code, t)}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700 align-top">
                                                        {o.shipment ? (
                                                            <div className="space-y-2">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {shipmentBadge(o.shipment.status, t)}
                                                                </div>

                                                                <div className="text-xs text-gray-600">
                                                                    <div>
                                                                        <span className="font-medium text-gray-700">
                                                                            {t("ui.shipments.method", "Método")}:
                                                                        </span>{" "}
                                                                        {o.shipment.method_name ?? "-"}
                                                                    </div>

                                                                    <div>
                                                                        <span className="font-medium text-gray-700">
                                                                            {t("ui.orders.tracking_number", "Tracking")}:
                                                                        </span>{" "}
                                                                        {o.shipment.tracking_number ?? "-"}
                                                                    </div>

                                                                    {o.shipment.shipped_at ? (
                                                                        <div>
                                                                            <span className="font-medium text-gray-700">
                                                                                {t("ui.shipments.shipped_at", "Enviado em")}:
                                                                            </span>{" "}
                                                                            {formatDate(o.shipment.shipped_at)}
                                                                        </div>
                                                                    ) : null}

                                                                    {o.shipment.delivered_at ? (
                                                                        <div>
                                                                            <span className="font-medium text-gray-700">
                                                                                {t("ui.shipments.delivered_at", "Entregue em")}:
                                                                            </span>{" "}
                                                                            {formatDate(o.shipment.delivered_at)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {formatMoney(o.total_amount, o.currency)}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {formatDate(o.created_at)}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        <div className="flex flex-wrap gap-2">
                                                            {allowedNextStatuses.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateOrderStatus(o)}
                                                                    disabled={!canUpdate}
                                                                    className={[
                                                                        "rounded-md border px-3 py-1.5 text-sm",
                                                                        canUpdate
                                                                            ? "hover:bg-gray-50"
                                                                            : "cursor-not-allowed opacity-50",
                                                                    ].join(" ")}
                                                                >
                                                                    {updatingOrderId === o.id
                                                                        ? t("ui.orders.updating", "Updating...")
                                                                        : t("ui.orders.update_status", "Update")}
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => cancelOrder(o)}
                                                                disabled={!canCancel}
                                                                className={[
                                                                    "rounded-md border px-3 py-1.5 text-sm",
                                                                    canCancel
                                                                        ? "hover:bg-gray-50"
                                                                        : "cursor-not-allowed opacity-50",
                                                                ].join(" ")}
                                                            >
                                                                {cancellingOrderId === o.id
                                                                    ? t("ui.orders.cancelling", "Cancelling...")
                                                                    : t("ui.orders.cancel", "Cancel")}
                                                            </button>

                                                            {route().has("admin.orders.show") && (
                                                                <Link
                                                                    href={route("admin.orders.show", { locale, order: o.id })}
                                                                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                                                                >
                                                                    {t("ui.orders.view", "View")}
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationLinks links={orders?.links ?? []} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
