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
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function FilterButton({ children, onClick, type = "button", variant = "primary" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={[
        "rounded-md px-4 py-2 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-gray-900 text-white hover:bg-gray-800"
          : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
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

function StatusBadge({ active, t }) {
  return active ? (
    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
      {t("ui.common.active", "Active")}
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
      {t("ui.common.inactive", "Inactive")}
    </span>
  );
}

function TypeBadge({ type, t }) {
  if (type === "percentage") {
    return (
      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
        {t("ui.coupons.admin.type_percentage", "Percentage")}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      {t("ui.coupons.admin.type_fixed_amount", "Fixed amount")}
    </span>
  );
}

function ValidityBlock({ coupon, t }) {
  const hasWindow = !!coupon.starts_at || !!coupon.ends_at;

  if (!hasWindow) {
    return (
      <div className="text-sm text-gray-500">
        {t("ui.coupons.admin.no_validity_limit", "No validity limit")}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm text-gray-700">
      <div>
        <span className="font-medium text-gray-900">
          {t("ui.coupons.admin.starts_at", "Starts")}:
        </span>{" "}
        {formatDate(coupon.starts_at)}
      </div>
      <div>
        <span className="font-medium text-gray-900">
          {t("ui.coupons.admin.ends_at", "Ends")}:
        </span>{" "}
        {formatDate(coupon.ends_at)}
      </div>
    </div>
  );
}

export default function AdminCouponsIndex() {
  const { locale, coupons, filters, statusOptions, currency = null } = usePage().props;
  const { t } = useI18n();

  const [q, setQ] = useState(filters?.q ?? "");
  const [status, setStatus] = useState(filters?.status ?? "");

  useEffect(() => setQ(filters?.q ?? ""), [filters?.q]);
  useEffect(() => setStatus(filters?.status ?? ""), [filters?.status]);

  const rows = useMemo(() => coupons?.data ?? [], [coupons]);

  function apply(e) {
    e.preventDefault();

    router.get(
      route("admin.coupons.index", { locale }),
      {
        q: q || undefined,
        status: status || undefined,
      },
      { preserveState: true, preserveScroll: true }
    );
  }

  function clear() {
    setQ("");
    setStatus("");

    router.get(
      route("admin.coupons.index", { locale }),
      {},
      {
        preserveState: true,
        preserveScroll: true,
      }
    );
  }

  function toggleCoupon(couponId) {
    router.patch(
      route("admin.coupons.toggle", { locale, coupon: couponId }),
      {},
      { preserveScroll: true }
    );
  }

  return (
    <AuthenticatedLayout
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
              {t("ui.coupons.admin.heading", "Admin · Coupons")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("ui.coupons.admin.subtitle", "Manage discount coupons")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={route("admin.coupons.create", { locale })}
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              {t("ui.coupons.admin.create", "New coupon")}
            </Link>

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
      <Head title={t("ui.coupons.admin.title", "Coupons")} />

      <div className="py-6">
        <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
          <Panel
            title={t("ui.coupons.admin.filters_title", "Filters")}
            description={t(
              "ui.coupons.admin.filters_desc",
              "Search coupons by code or name and narrow the list by status."
            )}
          >
            <form
              onSubmit={apply}
              className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-end"
            >
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {t("ui.common.search", "Search")}
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t(
                    "ui.coupons.admin.search_placeholder",
                    "Code or name…"
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {t("ui.coupons.admin.status_label", "Status")}
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {(statusOptions ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <FilterButton type="submit">
                    {t("ui.common.search", "Search")}
                  </FilterButton>

                  <FilterButton type="button" variant="secondary" onClick={clear}>
                    {t("ui.common.clear", "Clear")}
                  </FilterButton>
                </div>
              </div>
            </form>
          </Panel>

          <Panel
            title={t("ui.coupons.admin.title", "Coupons")}
            description={t(
              "ui.coupons.admin.list_desc",
              "Review coupon value, usage, validity and activation state."
            )}
            action={
              rows.length > 0 ? (
                <div className="text-sm text-gray-500">
                  {t("ui.coupons.admin.total_results", "Results")}:{" "}
                  <span className="font-semibold text-gray-900">
                    {coupons?.meta?.total ?? rows.length}
                  </span>
                </div>
              ) : null
            }
          >
            {rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.code", "Code")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.name", "Name")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.type", "Type")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.value", "Value")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.uses", "Uses")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.status_label", "Status")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("ui.coupons.admin.validity", "Validity")}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t("ui.common.actions", "Actions")}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((coupon) => (
                        <tr
                          key={coupon.id}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-900">
                              {coupon.code}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-800">
                              {coupon.name || "—"}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <TypeBadge type={coupon.type} t={t} />
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">
                              {coupon.type === "fixed_amount"
                                ? formatMoney(coupon.amount, currency)
                                : `${coupon.percentage}%`}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-700">
                              <span className="font-medium text-gray-900">
                                {coupon.total_uses}
                              </span>
                              {coupon.max_total_uses
                                ? ` / ${coupon.max_total_uses}`
                                : ` ${t("ui.coupons.admin.unlimited", "(unlimited)")}`}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge active={coupon.is_active} t={t} />
                          </td>

                          <td className="px-4 py-4">
                            <ValidityBlock coupon={coupon} t={t} />
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={route("admin.coupons.edit", {
                                  locale,
                                  coupon: coupon.id,
                                })}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                              >
                                {t("ui.common.edit", "Edit")}
                              </Link>

                              <button
                                type="button"
                                onClick={() => toggleCoupon(coupon.id)}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                              >
                                {coupon.is_active
                                  ? t("ui.coupons.admin.deactivate", "Deactivate")
                                  : t("ui.coupons.admin.activate", "Activate")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationLinks links={coupons?.links ?? []} />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {t("ui.coupons.admin.empty_title", "No coupons found")}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {t(
                    "ui.coupons.admin.empty_text",
                    "Try adjusting the filters or create a new coupon."
                  )}
                </div>
                <div className="mt-5">
                  <Link
                    href={route("admin.coupons.create", { locale })}
                    className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    {t("ui.coupons.admin.create", "New coupon")}
                  </Link>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
