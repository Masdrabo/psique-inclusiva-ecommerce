import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
import AttributeManagerModal from "@/Components/Manager/AttributeManagerModal";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function StatCard({ title, value, icon }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm text-gray-500">{title}</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                        {value}
                    </div>
                </div>
                <div className="text-2xl">{icon}</div>
            </div>
        </div>
    );
}

function getTranslatedName(item, locale) {
    const tr =
        (item?.translations ?? []).find((x) => x.language?.code === locale) ??
        (item?.translations ?? [])[0] ??
        null;

    return tr?.name ?? item?.slug ?? "—";
}

function getCategoryNames(product, locale) {
    return (product?.categories ?? []).map((category) => {
        const tr =
            (category?.translations ?? []).find((x) => x.language?.code === locale) ??
            (category?.translations ?? [])[0] ??
            null;

        return tr?.name ?? category?.slug ?? "—";
    });
}

function getMainImageUrl(product) {
    const images = Array.isArray(product?.images) ? product.images : [];
    if (!images.length) return null;

    const sorted = [...images].sort((a, b) => {
        const aMain = a?.is_main ? 1 : 0;
        const bMain = b?.is_main ? 1 : 0;

        if (aMain !== bMain) return bMain - aMain;

        const posA = a?.position ?? 0;
        const posB = b?.position ?? 0;

        if (posA !== posB) return posA - posB;

        return (a?.id ?? 0) - (b?.id ?? 0);
    });

    const main = sorted[0];

    if (main?.url) return main.url;
    if (main?.path) return `/storage/${main.path}`;

    return null;
}

function formatMoneyFromCents(amount) {
    if (amount == null) return "—";

    return new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: "EUR",
    }).format(Number(amount) / 100);
}

function formatEUR(product) {
    const min = product?.min_price_amount ?? null;
    const max = product?.max_price_amount ?? null;

    if (min == null && max == null) {
        return "—";
    }

    if (min != null && max != null && Number(min) !== Number(max)) {
        return `${formatMoneyFromCents(min)} – ${formatMoneyFromCents(max)}`;
    }

    return formatMoneyFromCents(min ?? max);
}

function StockBadge({ stock, lowStockThreshold, t }) {
    if (stock == null) {
        return (
            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                {t("ui.inventory.not_applicable", "N/A")}
            </span>
        );
    }

    if (stock <= 0) {
        return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                {t("ui.inventory.no_stock", "No stock")}
            </span>
        );
    }

    if (stock <= lowStockThreshold) {
        return (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                {stock} · {t("ui.inventory.low_stock", "Low stock")}
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {stock}
        </span>
    );
}

function ActiveBadge({ active, t }) {
    return active ? (
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {t("ui.common.active", "Active")}
        </span>
    ) : (
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            {t("ui.common.inactive", "Inactive")}
        </span>
    );
}

function ProductThumb({ product, locale }) {
    const imageUrl = getMainImageUrl(product);
    const name = getTranslatedName(product, locale);

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={name}
                className="h-12 w-12 rounded-lg border border-gray-200 bg-gray-50 object-cover"
                loading="lazy"
                draggable={false}
            />
        );
    }

    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-400">
            IMG
        </div>
    );
}

function SortButton({ label, field, currentSort, currentDirection, onSort }) {
    const active = currentSort === field;

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            className={`inline-flex items-center gap-1 font-medium transition hover:text-gray-900 ${
                active ? "text-gray-900" : "text-gray-600"
            }`}
        >
            <span>{label}</span>

            <span
                className={`text-xs ${
                    active ? "text-gray-900" : "text-gray-400"
                }`}
                aria-hidden="true"
            >
                {active ? (currentDirection === "asc" ? "▲" : "▼") : "↕"}
            </span>
        </button>
    );
}

export default function ProductsIndex() {
    const {
        locale,
        products,
        stockCards = {},
        filters = {},
        sort = {},
        attributeManager = {},
    } = usePage().props;

    const { t } = useI18n();

    const [q, setQ] = useState(filters.q ?? "");
    const [attributeManagerOpen, setAttributeManagerOpen] = useState(false);

    const currentSort = sort.by ?? "latest";
    const currentDirection = sort.direction ?? "desc";
    const perPage = Number(filters.per_page ?? 15);
    const lowStockThreshold = stockCards.low_stock_threshold ?? 5;

    useEffect(() => {
        setQ(filters.q ?? "");
    }, [filters.q]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if ((filters.q ?? "") === q) return;

            router.get(
                route("manager.products.index", { locale }),
                {
                    q,
                    sort: currentSort,
                    direction: currentDirection,
                    per_page: perPage,
                    page: 1,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                }
            );
        }, 350);

        return () => clearTimeout(timeout);
    }, [q, filters.q, locale, currentSort, currentDirection, perPage]);

    const handleSort = (field) => {
        const nextDirection =
            currentSort === field
                ? currentDirection === "asc"
                    ? "desc"
                    : "asc"
                : field === "latest"
                  ? "desc"
                  : "asc";

        router.get(
            route("manager.products.index", { locale }),
            {
                q,
                sort: field,
                direction: nextDirection,
                per_page: perPage,
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const handlePerPageChange = (value) => {
        router.get(
            route("manager.products.index", { locale }),
            {
                q,
                sort: currentSort,
                direction: currentDirection,
                per_page: Number(value),
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const handleClearFilters = () => {
        setQ("");

        router.get(
            route("manager.products.index", { locale }),
            {
                sort: "latest",
                direction: "desc",
                per_page: 15,
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const handleDelete = (product) => {
        const label = getTranslatedName(product, locale);

        if (!confirm(`${t("ui.common.delete", "Delete")} "${label}"?`)) {
            return;
        }

        router.delete(
            route("manager.products.destroy", {
                locale,
                product: product.id,
            }),
            {
                preserveScroll: true,
            }
        );
    };

    const refreshAttributeManager = () => {
        router.reload({
            only: ["attributeManager"],
            preserveScroll: true,
            preserveState: true,
        });
    };

    const activeSortLabel = useMemo(() => {
        switch (currentSort) {
            case "name":
                return t("ui.common.name", "Name");
            case "category":
                return t("ui.common.categories", "Categories");
            case "price":
                return t("ui.common.price", "Price");
            case "stock":
                return t("ui.common.stock", "Stock");
            case "latest":
            default:
                return t("ui.common.latest", "Latest");
        }
    }, [currentSort, t]);

    const exportProductsHref = useMemo(() => {
        const params = new URLSearchParams();

        if (q) params.set("q", q);
        if (currentSort) params.set("sort", currentSort);
        if (currentDirection) params.set("direction", currentDirection);

        const qs = params.toString();

        return route("manager.products.export", { locale }) + (qs ? `?${qs}` : "");
    }, [locale, q, currentSort, currentDirection]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.common.products1", "Products")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(
                                "ui.manager.products_desc",
                                "Manage products, pricing and translations"
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={exportProductsHref}
                            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                            title={t(
                                "ui.manager.export_products_csv_title",
                                "Export products CSV with stock, price and tax"
                            )}
                        >
                            {t("ui.manager.export_products_csv", "Export Products CSV")}
                        </a>

                        <button
                            type="button"
                            onClick={() => setAttributeManagerOpen(true)}
                            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                            {t("ui.manager.manage_attributes", "Gerir atributos")}
                        </button>

                        <Link
                            href={route("manager.products.create", { locale })}
                            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            + {t("ui.common.new", "New")} {t("ui.common.product", "Product")}
                        </Link>

                        <Link
                            href={route("manager.inventories.index", { locale })}
                            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                            {t("ui.common.inventory", "Inventory")}
                        </Link>

                        <Link
                            href={route("manager.dashboard", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.common.back", "Back")}
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title="Manager · Products" />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard
                            title={t("ui.inventory.total_products", "Total products")}
                            value={stockCards.total_products ?? 0}
                            icon="📦"
                        />
                        <StatCard
                            title={t("ui.inventory.in_stock", "Products in stock")}
                            value={stockCards.in_stock_products ?? 0}
                            icon="✅"
                        />
                        <StatCard
                            title={t("ui.inventory.out_of_stock", "Out of stock")}
                            value={stockCards.out_of_stock_products ?? 0}
                            icon="⛔"
                        />
                        <StatCard
                            title={t("ui.inventory.low_stock", "Low stock")}
                            value={stockCards.low_stock_products ?? 0}
                            icon="⚠️"
                        />
                        <StatCard
                            title={t("ui.inventory.total_units", "Available units")}
                            value={stockCards.total_units ?? 0}
                            icon="📊"
                        />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 p-4 sm:p-6">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                    <span>
                                        {products.total ?? 0}{" "}
                                        {(products.total ?? 0) === 1
                                            ? t("ui.common.product", "Product")
                                            : t("ui.common.products", "Products")}
                                    </span>

                                    <span className="hidden text-gray-300 sm:inline">•</span>

                                    <span>
                                        {t("ui.common.sort_by", "Sort by")}: {activeSortLabel}
                                    </span>

                                    <span className="hidden text-gray-300 sm:inline">•</span>

                                    <span>
                                        {t("ui.common.direction", "Direction")}:{" "}
                                        {currentDirection === "asc"
                                            ? t("ui.common.ascending", "Ascending")
                                            : t("ui.common.descending", "Descending")}
                                    </span>
                                </div>

                                <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                                    <input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 lg:w-96"
                                        placeholder={`${t("ui.common.search", "Search")} SKU, slug, ${t("ui.common.name", "Name").toLowerCase()} ou ${t("ui.common.categories", "Categories").toLowerCase()}`}
                                    />

                                    <select
                                        value={perPage}
                                        onChange={(e) => handlePerPageChange(e.target.value)}
                                        className="rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                    >
                                        {[10, 15, 25, 50, 100].map((n) => (
                                            <option key={n} value={n}>
                                                {n} / {t("ui.common.page", "page")}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        onClick={handleClearFilters}
                                        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                                    >
                                        {t("ui.common.clear_filters", "Clear filters")}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-gray-600">
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 pl-6 pr-4">SKU</th>

                                        <th className="px-4 py-3">
                                            <SortButton
                                                label={t("ui.common.product", "Product")}
                                                field="name"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

                                        <th className="px-4 py-3">
                                            <SortButton
                                                label={t("ui.common.categories", "Categories")}
                                                field="category"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

                                        <th className="px-4 py-3">
                                            <SortButton
                                                label={t("ui.common.price", "Price")}
                                                field="price"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

                                        <th className="px-4 py-3">
                                            <SortButton
                                                label={t("ui.common.stock", "Stock")}
                                                field="stock"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

                                        <th className="px-4 py-3">
                                            {t("ui.common.active", "Active")}
                                        </th>

                                        <th className="py-3 pl-4 pr-6 text-right">
                                            <SortButton
                                                label={t("ui.common.latest", "Latest")}
                                                field="latest"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="text-gray-800">
                                    {(products.data ?? []).map((p) => {
                                        const stock =
                                            p.available_stock == null
                                                ? null
                                                : Number(p.available_stock);

                                        const name = getTranslatedName(p, locale);
                                        const categoryNames = getCategoryNames(p, locale);

                                        const managerProductHref = route(
                                            "manager.products.edit",
                                            {
                                                locale,
                                                product: p.id,
                                            }
                                        );

                                        return (
                                            <tr
                                                key={p.id}
                                                className="border-b border-gray-100 transition hover:bg-gray-50/70"
                                            >
                                                <td className="whitespace-nowrap py-4 pl-6 pr-4 align-top">
                                                    <div className="font-mono text-sm text-gray-900">
                                                        {p.sku ?? "—"}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <Link
                                                            href={managerProductHref}
                                                            className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                                                        >
                                                            <ProductThumb product={p} locale={locale} />
                                                        </Link>

                                                        <div className="min-w-0">
                                                            <Link
                                                                href={managerProductHref}
                                                                className="inline-block rounded-sm font-medium text-gray-900 underline-offset-2 transition hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                            >
                                                                {name}
                                                            </Link>

                                                            <div className="mt-1 break-all text-xs text-gray-500">
                                                                {p.slug ?? "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    {categoryNames.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {categoryNames.map((categoryName, index) => (
                                                                <span
                                                                    key={`${p.id}-cat-${index}`}
                                                                    className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                                                                >
                                                                    {categoryName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 align-top font-medium text-gray-900">
                                                    {formatEUR(p)}
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <StockBadge
                                                        stock={stock}
                                                        lowStockThreshold={lowStockThreshold}
                                                        t={t}
                                                    />
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <ActiveBadge active={p.is_active} t={t} />
                                                </td>

                                                <td className="whitespace-nowrap py-4 pl-4 pr-6 text-right align-top">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={route("manager.products.edit", {
                                                                locale,
                                                                product: p.id,
                                                            })}
                                                            className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {t("ui.common.edit", "Edit")}
                                                        </Link>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(p)}
                                                            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                                                        >
                                                            {t("ui.common.delete", "Delete")}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {(products.data ?? []).length === 0 ? (
                                        <tr>
                                            <td
                                                className="py-10 text-center text-gray-500"
                                                colSpan={7}
                                            >
                                                {t("ui.common.no_results", "No results")}
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col gap-4 border-t border-gray-100 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm text-gray-600">
                                {(products.total ?? 0) > 0 ? (
                                    <>
                                        {t("ui.common.showing", "Showing")} {products.from ?? 0}–
                                        {products.to ?? 0} {t("ui.common.of", "of")}{" "}
                                        {products.total ?? 0}
                                    </>
                                ) : (
                                    t("ui.common.no_results", "No results")
                                )}
                            </div>

                            <PaginationLinks links={products?.links ?? []} variant="inline" />
                        </div>
                    </div>
                </div>
            </div>

            <AttributeManagerModal
                open={attributeManagerOpen}
                onClose={() => setAttributeManagerOpen(false)}
                locale={locale}
                initialAttributes={attributeManager?.attributes ?? []}
                languageIds={attributeManager?.languages ?? { pt: null, en: null }}
                onRefresh={refreshAttributeManager}
            />
        </AuthenticatedLayout>
    );
}
