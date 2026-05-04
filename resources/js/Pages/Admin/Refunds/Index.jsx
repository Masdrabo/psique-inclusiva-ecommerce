import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
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

export default function AdminRefundsIndex() {
    const { locale, refunds, filters } = usePage().props;
    const { t } = useI18n();

    const [q, setQ] = useState(filters?.q ?? "");
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? "");
    const [dateTo, setDateTo] = useState(filters?.date_to ?? "");

    useEffect(() => setQ(filters?.q ?? ""), [filters?.q]);
    useEffect(() => setDateFrom(filters?.date_from ?? ""), [filters?.date_from]);
    useEffect(() => setDateTo(filters?.date_to ?? ""), [filters?.date_to]);

    function apply(e) {
        e.preventDefault();

        router.get(
            route("admin.refunds.index", { locale }),
            {
                q: q || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            },
            { preserveScroll: true, preserveState: true }
        );
    }

    function clear() {
        setQ("");
        setDateFrom("");
        setDateTo("");

        router.get(
            route("admin.refunds.index", { locale }),
            {},
            { preserveScroll: true, preserveState: true }
        );
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.admin.refunds_management_heading", "Refunds")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(
                                "ui.admin.refunds_management_desc",
                                "Refunds are ordered by most recent first."
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
            <Head title={t("ui.admin.refunds_management_title", "Refunds")} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t("ui.admin.refunds_card_title", "Refunds")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t(
                                            "ui.admin.refunds_management_note",
                                            "Latest issued refunds are shown first."
                                        )}
                                    </div>
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
                                            "ui.admin.refunds_search_placeholder",
                                            "Refund ref, order, customer, email or reason…"
                                        )}
                                    />
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

                                <div></div>

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
                                                {t("ui.admin.refund_reference", "Ref.")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_order", "Order")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_customer", "Customer")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.claim_amount", "Amount")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.refund_reason", "Reason")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.refund_created_by", "Issued by")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.admin.refund_date", "Date")}
                                            </th>
                                            <th className="border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {t("ui.orders.actions", "Actions")}
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(refunds?.data ?? []).length > 0 ? (
                                            refunds.data.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50">
                                                    <td className="border px-3 py-2 text-sm font-medium text-gray-900">
                                                        {row.label ?? "—"}
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
                                                        {formatMoney(row.amount, row.currency)}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {row.reason || "—"}
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        <div className="font-medium">
                                                            {row.created_by?.name ?? "—"}
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {row.created_by?.email ?? "—"}
                                                        </div>
                                                    </td>

                                                    <td className="border px-3 py-2 text-sm text-gray-700">
                                                        {formatDateTime(row.created_at)}
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
                                                        "ui.admin.no_refunds_found",
                                                        "No refunds found for the selected filters."
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationLinks links={refunds?.links ?? []} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
