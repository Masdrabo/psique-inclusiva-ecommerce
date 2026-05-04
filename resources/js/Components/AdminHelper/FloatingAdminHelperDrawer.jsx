import { Link, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

function LightbulbIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4.95 11.95C8.12 15.02 9 16.2 9 17.5h6c0-1.3.88-2.48 1.95-3.55A7 7 0 0 0 12 2Z"
      />
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ChecklistItem({ done, children }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <span>{children}</span>
    </div>
  );
}

function TipCard({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-gray-600">{children}</div>
    </div>
  );
}

function safeRoute(name, params = {}) {
  try {
    return route(name, params);
  } catch {
    return null;
  }
}

export default function FloatingAdminHelperDrawer({ locale }) {
  const { t } = useI18n();
  const page = usePage();
  const authUser = page.props?.auth?.user ?? null;
  const url = page.url ?? "";

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const role = authUser?.role ?? null;
  const canSee = role === "admin" || role === "manager";

  const isAdminArea = url.startsWith(`/${locale}/admin`);
  const isManagerArea = url.startsWith(`/${locale}/manager`);

  const context = useMemo(() => {
    if (url.startsWith(`/${locale}/admin/users`)) return "users";
    if (url.startsWith(`/${locale}/manager/products`)) return "products";
    if (url.startsWith(`/${locale}/manager/categories`)) return "categories";
    if (url.startsWith(`/${locale}/admin/returns`)) return "returns";
    if (url.startsWith(`/${locale}/admin/refunds`)) return "refunds";
    if (url.startsWith(`/${locale}/admin/orders`)) return "orders";
    if (isAdminArea || isManagerArea) return "dashboard";

    return null;
  }, [url, locale, isAdminArea, isManagerArea]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    function onClickOutside(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [url]);

  const links = useMemo(() => {
    const adminDashboard = safeRoute("admin.dashboard", { locale });
    const managerDashboard = safeRoute("manager.dashboard", { locale });
    const users =
      role === "admin" ? safeRoute("admin.users.index", { locale }) : null;
    const products = safeRoute("manager.products.index", { locale });
    const categories = safeRoute("manager.categories.index", { locale });
    const inventories = safeRoute("manager.inventories.index", { locale });
    const orders =
      role === "admin" ? safeRoute("admin.orders.index", { locale }) : null;
    const returns =
      role === "admin" ? safeRoute("admin.returns.index", { locale }) : null;
    const refunds =
      role === "admin" ? safeRoute("admin.refunds.index", { locale }) : null;

    return {
      adminDashboard,
      managerDashboard,
      users,
      products,
      categories,
      inventories,
      orders,
      returns,
      refunds,
    };
  }, [locale, role]);

  const helper = useMemo(() => {
    const config = {
      dashboard: {
        title: t("ui.admin_helper.contexts.dashboard.title", "Admin helper"),
        subtitle: t(
          "ui.admin_helper.contexts.dashboard.subtitle",
          "Quick guidance for store and administrative tasks."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.store_setup", "Store setup"),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.categories_created",
                  "Create categories before adding products."
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.products_created",
                  "Create products and review their content."
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.stock_reviewed",
                  "Review stock regularly to avoid unavailable products."
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.store_flow_title",
                  "Suggested store flow"
                ),
                body: t(
                  "ui.admin_helper.tips.store_flow_body",
                  "Start with categories, then products, then prices and stock. This helps avoid incomplete product records."
                ),
              },
            ],
            actions: [
              links.categories && {
                href: links.categories,
                label: t(
                  "ui.admin_helper.actions.manage_categories",
                  "Manage categories"
                ),
              },
              links.products && {
                href: links.products,
                label: t(
                  "ui.admin_helper.actions.manage_products",
                  "Manage products"
                ),
              },
              links.inventories && {
                href: links.inventories,
                label: t(
                  "ui.admin_helper.actions.manage_stock",
                  "Manage stock"
                ),
              },
            ].filter(Boolean),
          },
          {
            title: t("ui.admin_helper.sections.admin_tasks", "Admin tasks"),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.users_reviewed",
                  "Review users, roles and moderation actions carefully."
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.returns_refunds",
                  "For returns and refunds, confirm order status, returned items and stock impact first."
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.roles_title",
                  "Roles and permissions"
                ),
                body: t(
                  "ui.admin_helper.tips.roles_body",
                  "Use manager for day-to-day store operations and reserve admin for sensitive platform actions."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.tips.refunds_title",
                  "Refund and return caution"
                ),
                body: t(
                  "ui.admin_helper.tips.refunds_body",
                  "Use refunds only after validating the order state and any returned items. When stock should be restored, confirm the physical return first."
                ),
              },
            ],
            actions: [
              role === "admin" && links.users
                ? {
                    href: links.users,
                    label: t(
                      "ui.admin_helper.actions.manage_users",
                      "Manage users"
                    ),
                  }
                : null,
              role === "admin" && links.orders
                ? {
                    href: links.orders,
                    label: t(
                      "ui.admin_helper.actions.open_orders",
                      "Open orders"
                    ),
                  }
                : null,
              role === "admin" && links.returns
                ? {
                    href: links.returns,
                    label: t(
                      "ui.admin_helper.actions.manage_returns",
                      "Manage returns"
                    ),
                  }
                : null,
              role === "admin" && links.refunds
                ? {
                    href: links.refunds,
                    label: t(
                      "ui.admin_helper.actions.manage_refunds",
                      "Manage refunds"
                    ),
                  }
                : null,
              isAdminArea && links.adminDashboard
                ? {
                    href: links.adminDashboard,
                    label: t(
                      "ui.admin_helper.actions.back_to_dashboard",
                      "Back to dashboard"
                    ),
                  }
                : null,
              isManagerArea && links.managerDashboard
                ? {
                    href: links.managerDashboard,
                    label: t(
                      "ui.admin_helper.actions.back_to_dashboard",
                      "Back to dashboard"
                    ),
                  }
                : null,
            ].filter(Boolean),
          },
        ],
      },

      users: {
        title: t("ui.admin_helper.contexts.users.title", "Users guide"),
        subtitle: t(
          "ui.admin_helper.contexts.users.subtitle",
          "Guidance for roles, suspensions and account blocking."
        ),
        sections: [
          {
            title: t(
              "ui.admin_helper.sections.user_moderation",
              "User moderation"
            ),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.review_role_first",
                  "Review the user's role before changing account status."
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks.use_suspension_for_temporary",
                  "Use suspension for temporary issues and blocking for serious or permanent cases."
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.checks_add_reason",
                  "Add an internal reason whenever moderation is applied."
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.user_status_title",
                  "When to use each status"
                ),
                body: t(
                  "ui.admin_helper.tips.user_status_body",
                  "Active restores access. Suspended is best for temporary restrictions with a date. Blocked is better for severe or indefinite situations."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.tips.user_safety_title",
                  "Administrative safety"
                ),
                body: t(
                  "ui.admin_helper.tips.user_safety_body",
                  "Avoid removing the last active admin. Keep at least one trusted admin account with full access."
                ),
              },
            ],
            actions: [
              links.adminDashboard && {
                href: links.adminDashboard,
                label: t(
                  "ui.admin_helper.actions.back_to_dashboard",
                  "Back to dashboard"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },

      products: {
        title: t("ui.admin_helper.contexts.products.title", "Products guide"),
        subtitle: t(
          "ui.admin_helper.contexts.products.subtitle",
          "Guidance for creating, editing and maintaining products."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.products", "Products"),
            checklist: [
              {
                done: true,
                label: t("ui.admin_helper.products.name", "Name in PT and EN"),
              },
              {
                done: true,
                label: t("ui.admin_helper.products.sku", "SKU defined"),
              },
              {
                done: true,
                label: t("ui.admin_helper.products.price", "Price defined"),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.products.categories",
                  "Category assigned"
                ),
              },
              {
                done: true,
                label: t("ui.admin_helper.products.images", "Images added"),
              },
              {
                done: true,
                label: t("ui.admin_helper.products.slug", "Slug checked"),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.products.seo",
                  "SEO reviewed if needed"
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.products_title",
                  "Good product workflow"
                ),
                body: t(
                  "ui.admin_helper.tips.products_body",
                  "Create the category first, then the product, then validate price, media and stock before final review."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.products.tip_title",
                  "Validation before publishing"
                ),
                body: t(
                  "ui.admin_helper.products.tip_body",
                  "Always confirm PT/EN, SKU, price, category and images before activating the product."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.products.type_tip_title",
                  "Business type matters"
                ),
                body: t(
                  "ui.admin_helper.products.type_tip_body",
                  "Physical products usually require shipping, weight and stock. Digital services use delivery settings. Membership fees need period and renewal rules."
                ),
              },
            ],
            actions: [
              links.categories && {
                href: links.categories,
                label: t(
                  "ui.admin_helper.actions.open_categories",
                  "Open categories"
                ),
              },
              links.products && {
                href: links.products,
                label: t(
                  "ui.admin_helper.actions.open_products",
                  "Open products"
                ),
              },
              links.inventories && {
                href: links.inventories,
                label: t(
                  "ui.admin_helper.actions.manage_stock",
                  "Manage stock"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },

      categories: {
        title: t(
          "ui.admin_helper.contexts.categories.title",
          "Categories guide"
        ),
        subtitle: t(
          "ui.admin_helper.contexts.categories.subtitle",
          "Guidance for organizing the store structure clearly."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.categories", "Categories"),
            checklist: [
              {
                done: true,
                label: t("ui.admin_helper.categories.name", "Name in PT and EN"),
              },
              {
                done: true,
                label: t("ui.admin_helper.categories.slug", "Slug checked"),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.categories.parent",
                  "Parent category reviewed if needed"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.categories.image",
                  "Representative image reviewed"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.categories.seo",
                  "SEO fields reviewed if needed"
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.categories_title",
                  "Category organization"
                ),
                body: t(
                  "ui.admin_helper.tips.categories_body",
                  "Use categories that are simple, descriptive and easy for staff to maintain over time."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.categories.tip_title",
                  "Before creating products"
                ),
                body: t(
                  "ui.admin_helper.categories.tip_body",
                  "A clear category structure makes product assignment and storefront navigation much easier."
                ),
              },
            ],
            actions: [
              links.categories && {
                href: links.categories,
                label: t(
                  "ui.admin_helper.actions.manage_categories",
                  "Manage categories"
                ),
              },
              links.products && {
                href: links.products,
                label: t(
                  "ui.admin_helper.actions.open_products",
                  "Open products"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },

      orders: {
        title: t("ui.admin_helper.contexts.orders.title", "Orders guide"),
        subtitle: t(
          "ui.admin_helper.contexts.orders.subtitle",
          "Guidance for processing orders, returns and refunds."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.orders", "Orders"),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.validate_status",
                  "Validate order status"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.validate_shipment",
                  "Validate shipment tracking and shipment status"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.check_return",
                  "Confirm returned item received"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.stock",
                  "Validate stock restock"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.refund",
                  "Confirm refund type"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.orders.close",
                  "Close case after validation"
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.tips.refunds_title",
                  "Refund and return caution"
                ),
                body: t(
                  "ui.admin_helper.tips.refunds_body",
                  "Use refunds only after validating the order state and any returned items. When stock should be restored, confirm the physical return first."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.orders.tip_title",
                  "Recommended complaint flow"
                ),
                body: t(
                  "ui.admin_helper.orders.tip_body",
                  "Check the order, validate the return, decide stock impact, complete the correct refund action and only then close the case."
                ),
              },
            ],
            actions: [
              links.orders && {
                href: links.orders,
                label: t("ui.admin_helper.actions.open_orders", "Open orders"),
              },
              links.returns && {
                href: links.returns,
                label: t(
                  "ui.admin_helper.actions.open_returns",
                  "Open returns"
                ),
              },
              links.refunds && {
                href: links.refunds,
                label: t(
                  "ui.admin_helper.actions.open_refunds",
                  "Open refunds"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },

      returns: {
        title: t("ui.admin_helper.contexts.returns.title", "Returns guide"),
        subtitle: t(
          "ui.admin_helper.contexts.returns.subtitle",
          "Guidance for approving, receiving and closing returns."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.returns", "Returns"),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.returns.request",
                  "Review request details, customer and order"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.returns.approve",
                  "Approve or reject the return correctly"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.returns.receive",
                  "Confirm physical receipt before next steps"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.returns.stock",
                  "Decide restock quantity carefully"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.returns.close",
                  "Close only after all dependent actions are completed"
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.returns.tip_title",
                  "Safe return handling"
                ),
                body: t(
                  "ui.admin_helper.returns.tip_body",
                  "Do not close a return before completing the necessary refund or exchange actions linked to the received items."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.returns.exchange_tip_title",
                  "Exchanges need follow-up"
                ),
                body: t(
                  "ui.admin_helper.returns.exchange_tip_body",
                  "When the resolution is exchange, register the reshipment and tracking information after receiving the returned goods."
                ),
              },
            ],
            actions: [
              links.orders && {
                href: links.orders,
                label: t("ui.admin_helper.actions.open_orders", "Open orders"),
              },
              links.returns && {
                href: links.returns,
                label: t(
                  "ui.admin_helper.actions.manage_returns",
                  "Manage returns"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },

      refunds: {
        title: t("ui.admin_helper.contexts.refunds.title", "Refunds guide"),
        subtitle: t(
          "ui.admin_helper.contexts.refunds.subtitle",
          "Guidance for validating and issuing refunds safely."
        ),
        sections: [
          {
            title: t("ui.admin_helper.sections.refunds", "Refunds"),
            checklist: [
              {
                done: true,
                label: t(
                  "ui.admin_helper.refunds.validate_order",
                  "Validate order eligibility before refund"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.refunds.amount",
                  "Confirm quantities and refund amount"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.refunds.reason",
                  "Register a clear reason or note"
                ),
              },
              {
                done: true,
                label: t(
                  "ui.admin_helper.refunds.final_check",
                  "Confirm everything before issuing the refund"
                ),
              },
            ],
            tips: [
              {
                title: t(
                  "ui.admin_helper.refunds.tip_title",
                  "Refunds are sensitive"
                ),
                body: t(
                  "ui.admin_helper.refunds.tip_body",
                  "Refunds should only be issued for eligible orders and quantities. Review previous refunds first to avoid duplication."
                ),
              },
              {
                title: t(
                  "ui.admin_helper.refunds.idempotency_tip_title",
                  "Avoid duplicates"
                ),
                body: t(
                  "ui.admin_helper.refunds.idempotency_tip_body",
                  "Use the refund flow carefully and avoid repeating submissions, especially when the order already has previous refund records."
                ),
              },
            ],
            actions: [
              links.orders && {
                href: links.orders,
                label: t("ui.admin_helper.actions.open_orders", "Open orders"),
              },
              links.refunds && {
                href: links.refunds,
                label: t(
                  "ui.admin_helper.actions.manage_refunds",
                  "Manage refunds"
                ),
              },
            ].filter(Boolean),
          },
        ],
      },
    };

    return context ? config[context] ?? config.dashboard : null;
  }, [context, isAdminArea, isManagerArea, links, role, t]);

  if (!canSee || !context || !helper) {
    return null;
  }

  return (
    <div
      ref={wrapRef}
      className="fixed right-20 top-20 z-[998] sm:right-24 sm:top-22"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("ui.admin_helper.button_label", "Open admin guide")}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-lg ring-1 ring-black/5 transition hover:bg-amber-50"
      >
        <LightbulbIcon />
      </button>

      {open && (
        <div className="absolute right-0 mt-3 flex h-[min(680px,calc(100vh-8.5rem))] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
            <div className="pr-4">
              <h2 className="text-sm font-semibold text-gray-900">
                {helper.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {helper.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label={t("ui.common.close", "Close")}
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {(helper.sections ?? []).map((section, index) => (
              <Section key={`${section.title}-${index}`} title={section.title}>
                {(section.checklist ?? []).map((item, itemIndex) => (
                  <ChecklistItem
                    key={`${section.title}-check-${itemIndex}`}
                    done={Boolean(item.done)}
                  >
                    {item.label}
                  </ChecklistItem>
                ))}

                {(section.tips ?? []).map((tip, tipIndex) => (
                  <TipCard
                    key={`${section.title}-tip-${tipIndex}`}
                    title={tip.title}
                  >
                    {tip.body}
                  </TipCard>
                ))}

                {Array.isArray(section.actions) && section.actions.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {section.actions.map((action, actionIndex) => (
                      <Link
                        key={`${section.title}-action-${actionIndex}`}
                        href={action.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </Section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
