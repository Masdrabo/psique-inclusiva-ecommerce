import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
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

function StatCard({ label, value, sub, href }) {
    const body = (
        <div className="border bg-white shadow-sm sm:rounded-lg">
            <div className="p-5">
                <div className="text-xs font-semibold text-gray-600">{label}</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
                {sub ? <div className="mt-1 text-xs text-gray-600">{sub}</div> : null}
            </div>
        </div>
    );

    if (!href) return body;

    return (
        <Link href={href} className="block transition hover:opacity-95">
            {body}
        </Link>
    );
}

function AdminCard({ href, icon, title, description }) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
        >
            <div className="flex flex-col gap-3">
                <div className="text-3xl">{icon}</div>
                <div className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                    {title}
                </div>
                <div className="text-sm text-gray-600">{description}</div>
            </div>
        </Link>
    );
}

function CaseTypeBadge({ row, t }) {
    if (row?.type === "refund") {
        return (
            <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                {t("ui.admin.refund_badge", "Refund")}
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {t("ui.admin.return_badge", "Return")}
        </span>
    );
}

function StatusBadge({ status }) {
    const map = {
        requested: "bg-amber-100 text-amber-700",
        approved: "bg-blue-100 text-blue-700",
        received: "bg-green-100 text-green-700",
        closed: "bg-gray-900 text-white",
        rejected: "bg-red-100 text-red-700",
        refunded: "bg-purple-100 text-purple-700",
    };

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"
                }`}
        >
            {status ?? "—"}
        </span>
    );
}

export default function AdminDashboard() {
    const { locale, kpis, currency, meta, recentClaims = [] } = usePage().props;
    const { t } = useI18n();
    const [showAllClaims, setShowAllClaims] = useState(false);

    const visibleClaims = useMemo(() => {
        if (showAllClaims) return recentClaims;
        return recentClaims.slice(0, 1);
    }, [recentClaims, showAllClaims]);

    const remainingClaimsCount = Math.max(0, recentClaims.length - 1);

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t("ui.admin.dashboard_heading", "Painel Admin")}
                </h2>
            }
        >
            <Head title={t("ui.admin.dashboard_title", "Admin")} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label={t("ui.analytics.revenue_today", "REVENUE TODAY")}
                            value={formatMoney(kpis?.revenue_today ?? 0, currency)}
                            sub={`${t("ui.analytics.day", "Day")}: ${meta?.today ?? ""}`}
                        />

                        <StatCard
                            label={t("ui.analytics.orders_today", "ORDERS TODAY")}
                            value={kpis?.orders_today ?? 0}
                            sub={`${t("ui.analytics.day", "Day")}: ${meta?.today ?? ""}`}
                        />

                        <StatCard
                            label={t("ui.analytics.revenue_month", "REVENUE MONTH")}
                            value={formatMoney(kpis?.revenue_month ?? 0, currency)}
                            sub={`${t("ui.analytics.since", "Since")}: ${meta?.month ?? ""}`}
                        />

                        <StatCard
                            label={t("ui.analytics.orders_month", "ORDERS MONTH")}
                            value={kpis?.orders_month ?? 0}
                            sub={`${t("ui.analytics.since", "Since")}: ${meta?.month ?? ""}`}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label={t("ui.admin.returns_open", "Open returns")}
                            value={kpis?.returns_open ?? 0}
                            sub={t("ui.admin.returns_open_sub", "Requests still pending")}
                            href={route("admin.returns.index", { locale, scope: "open" })}
                        />

                        <StatCard
                            label={t("ui.admin.returns_total", "Total returns")}
                            value={kpis?.returns_total ?? 0}
                            sub={t("ui.admin.returns_total_sub", "Global history")}
                            href={route("admin.returns.index", { locale })}
                        />

                        <StatCard
                            label={t("ui.admin.orders_with_refunds", "Orders with refunds")}
                            value={kpis?.orders_with_refunds ?? 0}
                            sub={t("ui.admin.orders_with_refunds_sub", "Orders with refund issued")}
                            href={route("admin.refunds.index", { locale })}
                        />

                        <StatCard
                            label={t("ui.admin.refunds_month", "Refunds this month")}
                            value={formatMoney(kpis?.refunds_month ?? 0, currency)}
                            sub={`${t("ui.analytics.since", "Since")}: ${meta?.month ?? ""}`}
                            href={route("admin.refunds.index", { locale })}
                        />
                    </div>

                    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                        <div className="border-b px-6 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t("ui.admin.recent_returns_refunds", "Recent returns and refunds")}
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600">
                                        {t(
                                            "ui.admin.recent_returns_refunds_desc",
                                            "Latest customer requests or cases processed in admin."
                                        )}
                                    </div>
                                </div>

                                {recentClaims.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllClaims((prev) => !prev)}
                                        className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {showAllClaims
                                            ? t("ui.admin.show_less_claims", "Hide extra")
                                            : `${t("ui.admin.show_more_claims", "Show more")} (${remainingClaimsCount})`}
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3">{t("ui.admin.claim_type", "Type")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_reference", "Ref.")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_order", "Order")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_customer", "Customer")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_status", "Status")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_amount", "Amount")}</th>
                                        <th className="px-6 py-3">{t("ui.admin.claim_date", "Date")}</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentClaims.length > 0 ? (
                                        visibleClaims.map((row) => (
                                            <tr key={`${row.type}-${row.id}`} className="border-t">
                                                <td className="px-6 py-4">
                                                    <CaseTypeBadge row={row} t={t} />
                                                </td>

                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {row.label ?? "—"}
                                                </td>

                                                <td className="px-6 py-4">{row.order_number ?? "—"}</td>

                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">
                                                        {row.customer_name ?? "—"}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {row.customer_email ?? "—"}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <StatusBadge status={row.status} />
                                                </td>

                                                <td className="px-6 py-4">
                                                    {row.amount != null ? formatMoney(row.amount, currency) : "—"}
                                                </td>

                                                <td className="px-6 py-4 text-gray-600">
                                                    {formatDateTime(row.created_at)}
                                                </td>

                                                <td className="px-6 py-4 text-right">
                                                    {row.order_id ? (
                                                        <Link
                                                            href={route("admin.orders.show", {
                                                                locale,
                                                                order: row.order_id,
                                                            })}
                                                            className="font-medium text-indigo-600 hover:text-indigo-800"
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
                                                    "ui.admin.no_recent_returns_refunds",
                                                    "There are no returns or refunds yet."
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <AdminCard
                            href={route("admin.analytics.index", { locale })}
                            icon="📈"
                            title={t("ui.admin.analytics_card_title", "KPIs & Analytics")}
                            description={t(
                                "ui.admin.analytics_card_desc",
                                "Charts, top products and breakdowns"
                            )}
                        />

                        <AdminCard
                            href={route("admin.users.index", { locale })}
                            icon="👤"
                            title={t("ui.admin.users_card_title", "Users & Roles")}
                            description={t(
                                "ui.admin.users_card_desc",
                                "Manage users and roles"
                            )}
                        />

                        <AdminCard
                            href={route("admin.coupons.index", { locale })}
                            icon="🏷️"
                            title={t("ui.admin.coupons_card_title", "Coupons")}
                            description={t(
                                "ui.admin.coupons_card_desc",
                                "Create and manage discount coupons"
                            )}
                        />

                        <AdminCard
                            href={route("admin.orders.index", { locale })}
                            icon="🧾"
                            title={t("ui.admin.orders_card_title", "Orders")}
                            description={t(
                                "ui.admin.orders_card_desc",
                                "List and CSV export"
                            )}
                        />

                        <AdminCard
                            href={route("admin.returns.index", { locale })}
                            icon="↩️"
                            title={t("ui.admin.returns_card_title", "Returns")}
                            description={t(
                                "ui.admin.returns_card_desc",
                                "View return requests ordered by newest and open first"
                            )}
                        />

                        <AdminCard
                            href={route("admin.refunds.index", { locale })}
                            icon="💸"
                            title={t("ui.admin.refunds_card_title", "Refunds")}
                            description={t(
                                "ui.admin.refunds_card_desc",
                                "View issued refunds ordered by newest first"
                            )}
                        />

                        <AdminCard
                            href={route("admin.donations.index", { locale })}
                            icon="❤️"
                            title={t("ui.admin.donations_card_title", "Donativos")}
                            description={t(
                                "ui.admin.donations_card_desc",
                                "Ver e gerir todos os donativos realizados"
                            )}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
