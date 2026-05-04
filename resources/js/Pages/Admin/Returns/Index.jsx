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

function formatDateTime(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

function prettifyReturnStatus(status, t) {
    const map = {
        requested: t("ui.admin.return_status_requested", "Requested"),
        approved: t("ui.admin.return_status_approved", "Approved"),
        received: t("ui.admin.return_status_received", "Received"),
        closed: t("ui.admin.return_status_closed", "Closed"),
        rejected: t("ui.admin.return_status_rejected", "Rejected"),
    };

    return map[status] ?? status ?? "—";
}

function StatusBadge({ status, t }) {
    const styles = {
        requested: "bg-amber-100 text-amber-700",
        approved: "bg-blue-100 text-blue-700",
        received: "bg-green-100 text-green-700",
        closed: "bg-gray-900 text-white",
        rejected: "bg-red-100 text-red-700",
    };

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                styles[status] ?? "bg-gray-100 text-gray-700"
            }`}
        >
            {prettifyReturnStatus(status, t)}
        </span>
    );
}

export default function AdminReturnsIndex() {
    const { locale, returns, filters, availableStatuses = [], availableScopes = [] } = usePage().props;
    const { t } = useI18n();

    const [q, setQ] = useState(filters?.q ?? "");
    const [status, setStatus] = useState(filters?.status ?? "");
    const [scope, setScope] = useState(filters?.scope ?? "");
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? "");
    const [dateTo, setDateTo] = useState(filters?.date_to ?? "");

    useEffect(() => setQ(filters?.q ?? ""), [filters?.q]);
    useEffect(() => setStatus(filters?.status ?? ""), [filters?.status]);
    useEffect(() => setScope(filters?.scope ?? ""), [filters?.scope]);
    useEffect(() => setDateFrom(filters?.date_from ?? ""), [filters?.date_from]);
    useEffect(() => setDateTo(filters?.date_to ?? ""), [filters?.date_to]);

    function apply(e) {
        e.preventDefault();

        router.get(
            route("admin.returns.index", { locale }),
            {
                q: q || undefined,
                status: status || undefined,
                scope: scope || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            },
            { preserveScroll: true, preserveState: true }
        );
    }

    function clear() {
        setQ("");
        setStatus("");
        setScope("");
        setDateFrom("");
        setDateTo("");

        router.get(
            route("admin.returns.index", { locale }),
            {},
            { preserveScroll: true, preserveState: true }
        );
    }

    const qs = useMemo(() => {
        const params = new URLSearchParams();

        if (q) params.set("q", q);
        if (status) params.set("status", status);
        if (scope) params.set("scope", scope);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        return params.toString();
    }, [q, status, scope, dateFrom, dateTo]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.admin.returns_management_heading", "Returns")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(
                                "ui.admin.returns_management_desc",
                                "Open requests first, then closed, always ordered by most recent request."
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("admin.dashboard", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.admin.back_to_admin", "Back to Admin")}
                        </Link>

                        <Link
                            href={route("admin.orders.index", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.admin.orders_card_title", "Orders")}
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title={t("ui.admin.returns_management_title", "Returns")} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t("ui.admin.returns_card_title", "Returns")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t(
                                            "ui.admin.returns_management_note",
                                            "Requests needing action are shown first."
                                        )}
                                    </div>
                                </div>
                            </div>

                            <form
                                onSubmit={apply}
                                className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end"
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
                                            "ui.admin.returns_search_placeholder",
                                            "Return number, order, customer, email or reason…"
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
                                        {availableStatuses.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-600">
                                        {t("ui.admin.return_scope_label", "Scope")}
                                    </label>
                                    <select
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                        value={scope}
                                        onChange={(e) => setScope(e.target.value)}
                                    >
                                        {availableScopes.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
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
                                                {t("ui.admin.claim_reference", "Ref.")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_order", "Order")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_customer", "Customer")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_status", "Status")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.return_quantity", "Qty")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_amount", "Amount")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.return_requested_at", "Requested")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.actions", "Actions")}
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(returns?.data ?? []).length > 0 ? (
                                            returns.data.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50">
                                                    <td className="border px-3 py-2 text-sm font-medium text-gray-900">
                                                        {row.return_number ?? "—"}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {row.order?.order_number ?? "—"}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        <div className="font-medium">
                                                            {row.customer?.name ?? "—"}
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {row.customer?.email ?? "—"}
                                                        </div>
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        <StatusBadge status={row.status} t={t} />
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {row.qty ?? 0}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {formatMoney(row.amount, row.currency)}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {formatDateTime(row.requested_at)}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {row.order?.id ? (
                                                            <Link
                                                                href={route("admin.orders.show", {
                                                                    locale,
                                                                    order: row.order.id,
                                                                })}
                                                                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                                                            >
                                                                {t("ui.common.open", "Open")}
                                                            </Link>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                                                    {t(
                                                        "ui.admin.no_returns_found",
                                                        "No returns found for the selected filters."
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationLinks links={returns?.links ?? []} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
