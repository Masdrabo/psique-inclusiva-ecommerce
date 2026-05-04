import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function statusBadgeClass(status) {
  switch (status) {
    case "active":
      return "border-green-200 bg-green-50 text-green-700";
    case "suspended":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    case "banned":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function formatDateTimeLocalInput(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeLabel(value, locale) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default function AdminUsersIndex() {
  const { locale, users, roles, statuses, filters, counts, auth } = usePage().props;
  const { t } = useI18n();

  const [q, setQ] = useState(filters?.q ?? "");
  const [role, setRole] = useState(filters?.role ?? "");
  const [status, setStatus] = useState(filters?.status ?? "");
  const [drafts, setDrafts] = useState({});

  useEffect(() => setQ(filters?.q ?? ""), [filters?.q]);
  useEffect(() => setRole(filters?.role ?? ""), [filters?.role]);
  useEffect(() => setStatus(filters?.status ?? ""), [filters?.status]);

  useEffect(() => {
    const next = {};

    for (const u of users?.data ?? []) {
      next[u.id] = {
        status: u.status ?? "active",
        suspended_until: formatDateTimeLocalInput(u.suspended_until),
        ban_reason: u.ban_reason ?? "",
      };
    }

    setDrafts(next);
  }, [users]);

  const meId = auth?.user?.id;

  function apply(e) {
    e.preventDefault();

    router.get(
      route("admin.users.index", { locale }),
      {
        q: q || undefined,
        role: role || undefined,
        status: status || undefined,
      },
      { preserveScroll: true, preserveState: true }
    );
  }

  function clear() {
    setQ("");
    setRole("");
    setStatus("");

    router.get(
      route("admin.users.index", { locale }),
      {},
      { preserveScroll: true, preserveState: true }
    );
  }

  function updateRole(userId, nextRole) {
    router.patch(
      route("admin.users.role", { locale, user: userId }),
      { role: nextRole },
      { preserveScroll: true }
    );
  }

  function updateDraft(userId, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? {}),
        [field]: value,
      },
    }));
  }

  function saveStatus(userId) {
    const draft = drafts[userId] ?? {};

    router.patch(
      route("admin.users.status", { locale, user: userId }),
      {
        status: draft.status ?? "active",
        suspended_until:
          draft.status === "suspended" ? draft.suspended_until || null : null,
        ban_reason: draft.ban_reason || null,
      },
      { preserveScroll: true }
    );
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (status) params.set("status", status);

    return (
      route("admin.users.export", { locale }) +
      (params.toString() ? `?${params.toString()}` : "")
    );
  }, [locale, q, role, status]);

  function statusLabel(value) {
    switch (value) {
      case "active":
        return t("ui.users.status_active", "Active");
      case "suspended":
        return t("ui.users.status_suspended", "Suspended");
      case "banned":
        return t("ui.users.status_banned", "Blocked");
      default:
        return value ?? "—";
    }
  }

  function roleLabel(value) {
    switch (value) {
      case "admin":
        return "Admin";
      case "manager":
        return "Manager";
      case "customer":
        return "Customer";
      default:
        return value ?? "—";
    }
  }

  return (
    <AuthenticatedLayout
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
              {t("ui.admin.users_heading", "Admin · Users")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                "ui.admin.users_desc",
                "Manage users, roles, account status and CSV exports."
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
      <Head title={t("ui.admin.users_title", "Users")} />

      <div className="py-6">
        <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t("ui.users.total", "TOTAL")}
              value={counts?.total ?? 0}
            />
            <StatCard
              label={t("ui.users.admins", "ADMINS")}
              value={counts?.admin ?? 0}
            />
            <StatCard
              label={t("ui.users.managers", "MANAGERS")}
              value={counts?.manager ?? 0}
            />
            <StatCard
              label={t("ui.users.customers", "CUSTOMERS")}
              value={counts?.customer ?? 0}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {t("ui.users.title", "Users")}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t(
                      "ui.users.subtitle",
                      "Manage roles and account status safely"
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={exportHref}
                    className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    title={t(
                      "ui.users.export_csv_title",
                      "Export CSV with the current filters"
                    )}
                  >
                    {t("ui.users.export_csv", "Export CSV")}
                  </a>
                </div>
              </div>

              <form
                onSubmit={apply}
                className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4"
              >
                <div className="lg:col-span-2">
                  <label className="block text-xs text-gray-600">
                    {t("ui.users.search", "Search")}
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("ui.users.search_placeholder", "Name or email…")}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600">
                    {t("ui.users.role", "Role")}
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {(roles ?? []).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600">
                    {t("ui.users.status", "Status")}
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {(statuses ?? []).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 lg:col-span-4">
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
                    {t("ui.users.apply", "Apply")}
                  </button>

                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800"
                  >
                    {t("ui.users.clear", "Clear")}
                  </button>
                </div>
              </form>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-[22%] border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        {t("ui.users.name", "Name")}
                      </th>
                      <th className="w-[24%] border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        {t("ui.users.email", "Email")}
                      </th>
                      <th className="w-[16%] border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        {t("ui.users.role", "Role")}
                      </th>
                      <th className="w-[38%] border px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        {t("ui.users.moderation", "Moderation")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(users?.data ?? []).map((u) => {
                      const isMe = Number(u.id) === Number(meId);
                      const draft = drafts[u.id] ?? {
                        status: u.status ?? "active",
                        suspended_until: formatDateTimeLocalInput(u.suspended_until),
                        ban_reason: u.ban_reason ?? "",
                      };

                      return (
                        <tr key={u.id} className="align-top hover:bg-gray-50">
                          <td className="border px-3 py-3 text-sm">
                            <div className="space-y-1.5">
                              <div>
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(
                                    u.status
                                  )}`}
                                >
                                  {statusLabel(u.status)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {u.name}
                                </span>

                                {isMe && (
                                  <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                                    {t("ui.users.me", "you")}
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 text-[11px] text-gray-500">
                                <div>
                                  {t("ui.users.created_at", "Created")}:{" "}
                                  {formatDateTimeLabel(u.created_at, locale)}
                                </div>

                                {u.status === "suspended" && (
                                  <div>
                                    {t("ui.users.suspended_until", "Suspended until")}:{" "}
                                    {formatDateTimeLabel(u.suspended_until, locale)}
                                  </div>
                                )}

                                {u.banned_by?.name && (
                                  <div>
                                    {t("ui.users.updated_by", "Updated by")}:{" "}
                                    {u.banned_by.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="border px-3 py-3 text-sm text-gray-700">
                            <span className="break-all">{u.email}</span>
                          </td>

                          <td className="border px-3 py-3 text-sm">
                            <div className="space-y-2">
                              <div className="text-xs text-gray-500">
                                {t("ui.users.current_role", "Current role")}:{" "}
                                <span className="font-medium text-gray-700">
                                  {roleLabel(u.role)}
                                </span>
                              </div>

                              <select
                                className="w-full rounded-md border px-2 py-1.5 text-sm"
                                value={u.role}
                                disabled={isMe}
                                onChange={(e) => updateRole(u.id, e.target.value)}
                                title={
                                  isMe
                                    ? t(
                                        "ui.users.cannot_change_own_role",
                                        "You cannot change your own role."
                                      )
                                    : t("ui.users.change_role", "Change role")
                                }
                              >
                                {(roles ?? [])
                                  .filter((r) => r.value !== "")
                                  .map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </td>

                          <td className="border px-3 py-3 text-sm">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs text-gray-600">
                                      {t("ui.users.status", "Status")}
                                    </label>
                                    <select
                                      className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                                      value={draft.status ?? "active"}
                                      disabled={isMe}
                                      onChange={(e) =>
                                        updateDraft(u.id, "status", e.target.value)
                                      }
                                    >
                                      {(statuses ?? [])
                                        .filter((s) => s.value !== "")
                                        .map((s) => (
                                          <option key={s.value} value={s.value}>
                                            {s.label}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  {draft.status === "suspended" && (
                                    <div>
                                      <label className="block text-xs text-gray-600">
                                        {t(
                                          "ui.users.suspended_until_field",
                                          "Suspend until"
                                        )}
                                      </label>
                                      <input
                                        type="datetime-local"
                                        className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                                        value={draft.suspended_until ?? ""}
                                        disabled={isMe}
                                        onChange={(e) =>
                                          updateDraft(
                                            u.id,
                                            "suspended_until",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-xs text-gray-600">
                                    {t("ui.users.reason", "Reason")}
                                  </label>
                                  <textarea
                                    rows={draft.status === "suspended" ? 5 : 4}
                                    className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                                    value={draft.ban_reason ?? ""}
                                    disabled={isMe}
                                    onChange={(e) =>
                                      updateDraft(u.id, "ban_reason", e.target.value)
                                    }
                                    placeholder={t(
                                      "ui.users.reason_placeholder",
                                      "Internal reason for moderation…"
                                    )}
                                  />
                                </div>
                              </div>

                              {u.ban_reason && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                  <span className="font-semibold text-gray-700">
                                    {t("ui.users.reason", "Reason")}:
                                  </span>{" "}
                                  {u.ban_reason}
                                </div>
                              )}

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={isMe}
                                  onClick={() => saveStatus(u.id)}
                                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  title={
                                    isMe
                                      ? t(
                                          "ui.users.cannot_change_own_status",
                                          "You cannot change your own account status."
                                        )
                                      : t("ui.users.save_status", "Save status")
                                  }
                                >
                                  {t("ui.users.save_status", "Save status")}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationLinks links={users?.links ?? []} />
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
