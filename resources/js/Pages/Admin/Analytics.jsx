import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

function formatMoney(cents, currency) {
  const dp = currency?.decimal_places ?? 2;
  const symbol = currency?.symbol ?? "€";
  const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
  return `${value} ${symbol}`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-600">{sub}</div> : null}
    </div>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-1.5 text-sm font-semibold transition",
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Panel({ title, description, children, action = null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-gray-600">{description}</div>
            ) : null}
          </div>

          {action}
        </div>
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}

function dayLabel(yyyyMMdd) {
  const [, m, d] = String(yyyyMMdd).split("-");
  return `${m}/${d}`;
}

export default function AdminAnalytics() {
  const {
    locale,
    currency,
    days,
    range,
    totals,
    series,
    statusBreakdown,
    topProducts,
    postSaleBreakdown = [],
  } = usePage().props;

  const { t } = useI18n();
  const [showAllTopProducts, setShowAllTopProducts] = useState(false);

  const data = useMemo(() => {
    return (series ?? []).map((x) => ({
      ...x,
      day_short: dayLabel(x.day),
      revenue: Number(x.revenue_cents || 0),
      orders_created: Number(x.orders_created || 0),
      paid_orders: Number(x.paid_orders || 0),
    }));
  }, [series]);

  const visibleTopProducts = useMemo(() => {
    if (showAllTopProducts) return topProducts ?? [];
    return (topProducts ?? []).slice(0, 7);
  }, [topProducts, showAllTopProducts]);

  const hiddenTopProductsCount = Math.max(0, (topProducts ?? []).length - 7);

  function setDays(nextDays) {
    router.get(
      route("admin.analytics.index", { locale }),
      { days: nextDays },
      { preserveScroll: true, preserveState: true }
    );
  }

  return (
    <AuthenticatedLayout
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
              {t("ui.admin.analytics_heading", "Admin · KPIs & Analytics")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                "ui.admin.analytics_desc",
                "Track revenue, orders, top products and order status performance."
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
          </div>
        </div>
      }
    >
      <Head title={t("ui.admin.analytics_title", "KPIs & Analytics")} />

      <div className="py-6">
        <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm text-gray-600">
                  {t("ui.analytics.period", "Period")}:{" "}
                  <span className="font-semibold">{range?.start}</span> →{" "}
                  <span className="font-semibold">{range?.end}</span>
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {t(
                    "ui.analytics.revenue_info",
                    "Revenue uses paid orders only (paid_at). Orders use created orders (created_at)."
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[7, 14, 30, 60, 90].map((n) => (
                  <FilterButton
                    key={n}
                    active={Number(days) === n}
                    onClick={() => setDays(n)}
                  >
                    {n}d
                  </FilterButton>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("ui.analytics.revenue_period", "REVENUE (PERIOD)")}
              value={formatMoney(totals?.revenue_cents ?? 0, currency)}
            />
            <StatCard
              label={t("ui.analytics.paid_orders_period", "PAID ORDERS (PERIOD)")}
              value={totals?.paid_orders ?? 0}
            />
            <StatCard
              label={t("ui.analytics.created_orders_period", "CREATED ORDERS (PERIOD)")}
              value={totals?.orders_created ?? 0}
            />
            <StatCard
              label={t("ui.analytics.avg_revenue_per_order", "AVG. REVENUE / PAID ORDER")}
              value={
                totals?.paid_orders > 0
                  ? formatMoney(
                      Math.round((totals?.revenue_cents ?? 0) / totals.paid_orders),
                      currency
                    )
                  : formatMoney(0, currency)
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title={t("ui.analytics.revenue_per_day", "Revenue per day")}
              description={t("ui.analytics.paid_only", "Paid only (paid_at)")}
            >
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day_short" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatMoney(Number(value || 0), currency)
                      }
                      labelFormatter={(label) =>
                        `${t("ui.analytics.day", "Day")} ${label}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={t("ui.analytics.revenue", "Revenue")}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title={t("ui.analytics.orders_per_day", "Orders per day")}
              description={t(
                "ui.analytics.created_and_paid",
                "Created (created_at) and paid (paid_at)"
              )}
            >
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day_short" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="orders_created"
                      name={t("ui.analytics.created_orders", "Created orders")}
                      fill="#94a3b8"
                    />
                    <Bar
                      dataKey="paid_orders"
                      name={t("ui.analytics.paid_orders", "Paid orders")}
                      fill="#22c55e"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <Panel
                title={t("ui.analytics.top_products", "Top products")}
                description={t(
                  "ui.analytics.top_products_desc",
                  "By quantity (paid in period)"
                )}
                action={
                  hiddenTopProductsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllTopProducts((prev) => !prev)}
                      className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {showAllTopProducts
                        ? t("ui.analytics.show_less", "Show less")
                        : `${t("ui.analytics.show_more", "Show more")} (${hiddenTopProductsCount})`}
                    </button>
                  ) : null
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3">
                          {t("ui.analytics.product", "Product")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("ui.analytics.qty", "Qty")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTopProducts.map((p, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-sm text-gray-800">{p.name}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {p.qty}
                          </td>
                        </tr>
                      ))}

                      {(topProducts ?? []).length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-gray-600"
                            colSpan="2"
                          >
                            {t("ui.analytics.insufficient_data", "Not enough data.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <div className="xl:col-span-1">
              <Panel
                title={t("ui.analytics.status_breakdown", "Status breakdown")}
                description={t(
                  "ui.analytics.status_breakdown_desc",
                  "Orders created in the period"
                )}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3">
                          {t("ui.analytics.status", "Status")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("ui.analytics.qty", "Qty")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(statusBreakdown ?? []).map((s, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {s.name ?? s.code}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {s.count}
                          </td>
                        </tr>
                      ))}

                      {(statusBreakdown ?? []).length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-gray-600"
                            colSpan="2"
                          >
                            {t("ui.analytics.insufficient_data", "Not enough data.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <div className="xl:col-span-1">
              <Panel
                title={t("ui.analytics.post_sale_breakdown", "Returns & refunds")}
                description={t(
                  "ui.analytics.post_sale_breakdown_desc",
                  "Post-sale cases created in the period"
                )}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3">
                          {t("ui.analytics.type", "Type")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("ui.analytics.qty", "Qty")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(postSaleBreakdown ?? []).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {t(`ui.analytics.post_sale.${row.code}`, row.code)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {row.count}
                          </td>
                        </tr>
                      ))}

                      {(postSaleBreakdown ?? []).length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-gray-600"
                            colSpan="2"
                          >
                            {t("ui.analytics.insufficient_data", "Not enough data.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
