import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
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

function FilterButton({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
        >
            {children}
        </button>
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
                className={`text-xs ${active ? "text-gray-900" : "text-gray-400"}`}
                aria-hidden="true"
            >
                {active ? (currentDirection === "asc" ? "▲" : "▼") : "↕"}
            </span>
        </button>
    );
}

function getTranslatedName(product, locale) {
    const tr =
        (product?.translations ?? []).find((x) => x.language?.code === locale) ??
        (product?.translations ?? [])[0] ??
        null;

    return tr?.name ?? product?.name ?? product?.slug ?? "—";
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

function StockBadge({ availableQty, lowStockThreshold, t }) {
    if (availableQty <= 0) {
        return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                {t("ui.inventory.no_stock", "No stock")}
            </span>
        );
    }

    if (availableQty <= lowStockThreshold) {
        return (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                {availableQty} · {t("ui.inventory.low_stock", "Low stock")}
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {availableQty}
        </span>
    );
}

function InventoryStatusBadge({ product, t }) {
    if (product.is_out_of_stock) {
        return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                {t("ui.inventory.out_of_stock", "Out of stock")}
            </span>
        );
    }

    if (product.is_low_stock) {
        return (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                {t("ui.inventory.low_stock", "Low stock")}
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {t("ui.inventory.healthy_stock", "Healthy")}
        </span>
    );
}

function ProductTypeBadge({ product, t }) {
    if (product?.type === "variable") {
        return (
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                {t("ui.manager.variable_product_short", "Variável")}
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {t("ui.manager.simple_product_short", "Simples")}
        </span>
    );
}

function VariantSummaryList({ variants = [], t }) {
    if (!Array.isArray(variants) || variants.length === 0) {
        return (
            <div className="text-xs text-gray-500">
                {t("ui.inventory.no_variant_summary", "Sem resumo de variantes.")}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {variants.map((variant) => (
                <div
                    key={variant.id}
                    className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                    <div className="text-xs font-medium text-gray-900">
                        {variant.label || variant.sku || `#${variant.id}`}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {variant.sku ? (
                            <span className="font-mono text-gray-500">{variant.sku}</span>
                        ) : null}

                        <span
                            className={[
                                "inline-flex rounded-full px-2 py-0.5 font-medium",
                                Number(variant.available_stock ?? 0) > 0
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700",
                            ].join(" ")}
                        >
                            {Number(variant.available_stock ?? 0)}{" "}
                            ·{" "}
                            {Number(variant.available_stock ?? 0) > 0
                                ? t("ui.inventory.in_stock_short", "em stock")
                                : t("ui.inventory.no_stock", "No stock")}
                        </span>

                        <span
                            className={[
                                "inline-flex rounded-full px-2 py-0.5 font-medium",
                                variant.is_active
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600",
                            ].join(" ")}
                        >
                            {variant.is_active
                                ? t("ui.common.active", "Active")
                                : t("ui.common.inactive", "Inactive")}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function InventoriesIndex() {
    const {
        locale,
        products,
        cards = {},
        filters = {},
        sort = {},
    } = usePage().props;

    const { t } = useI18n();

    const [q, setQ] = useState(filters.q ?? "");
    const [stockValues, setStockValues] = useState(() =>
        Object.fromEntries(
            (products?.data ?? []).map((p) => [
                p.id,
                String(p.inventories?.[0]?.qty_on_hand ?? p.available_stock ?? 0),
            ])
        )
    );

    const currentQuickFilter = filters.quick_filter ?? "all";
    const currentSort = sort.by ?? "stock";
    const currentDirection = sort.direction ?? "asc";
    const perPage = Number(filters.per_page ?? 15);
    const lowStockThreshold = cards.low_stock_threshold ?? 5;

    useEffect(() => {
        setQ(filters.q ?? "");
    }, [filters.q]);

    useEffect(() => {
        setStockValues(
            Object.fromEntries(
                (products?.data ?? []).map((p) => [
                    p.id,
                    String(p.inventories?.[0]?.qty_on_hand ?? p.available_stock ?? 0),
                ])
            )
        );
    }, [products?.data]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if ((filters.q ?? "") === q) return;

            router.get(
                route("manager.inventories.index", { locale }),
                {
                    q,
                    quick_filter: currentQuickFilter,
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
    }, [
        q,
        filters.q,
        locale,
        currentQuickFilter,
        currentSort,
        currentDirection,
        perPage,
    ]);

    const handleQuickFilter = (value) => {
        router.get(
            route("manager.inventories.index", { locale }),
            {
                q,
                quick_filter: value,
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
    };

    const handleSort = (field) => {
        const nextDirection =
            currentSort === field
                ? currentDirection === "asc"
                    ? "desc"
                    : "asc"
                : field === "stock"
                  ? "asc"
                  : field === "latest"
                    ? "desc"
                    : "asc";

        router.get(
            route("manager.inventories.index", { locale }),
            {
                q,
                quick_filter: currentQuickFilter,
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
            route("manager.inventories.index", { locale }),
            {
                q,
                quick_filter: currentQuickFilter,
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
            route("manager.inventories.index", { locale }),
            {
                quick_filter: "all",
                sort: "stock",
                direction: "asc",
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

    const submitStock = (productId) => {
        const raw = stockValues[productId] ?? "0";
        const qty = Number.parseInt(raw, 10);

        if (Number.isNaN(qty) || qty < 0) {
            alert(t("ui.inventory.invalid_qty", "Invalid stock quantity."));
            return;
        }

        router.put(
            route("manager.inventories.update", { locale, product: productId }),
            { qty_on_hand: qty },
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
    };

    const activeSortLabel = useMemo(() => {
        switch (currentSort) {
            case "name":
                return t("ui.common.name", "Name");
            case "sku":
                return "SKU";
            case "warehouse":
                return t("ui.inventory.warehouse", "Warehouse");
            case "status":
                return t("ui.inventory.status", "Inventory status");
            case "latest":
                return t("ui.common.latest", "Latest");
            case "stock":
            default:
                return t("ui.common.stock", "Stock");
        }
    }, [currentSort, t]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.common.inventory1", "Inventory")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(
                                "ui.manager.inventory_desc",
                                "Manage product stock, availability and inventory levels"
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href={route("manager.products.index", { locale })}
                            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                            {t("ui.common.products", "Products")}
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
            <Head title="Manager · Inventory" />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard
                            title={t("ui.inventory.total_products", "Total products")}
                            value={cards.total_products ?? 0}
                            icon="📦"
                        />
                        <StatCard
                            title={t("ui.inventory.in_stock", "Products in stock")}
                            value={cards.in_stock_products ?? 0}
                            icon="✅"
                        />
                        <StatCard
                            title={t("ui.inventory.out_of_stock", "Out of stock")}
                            value={cards.out_of_stock_products ?? 0}
                            icon="⛔"
                        />
                        <StatCard
                            title={t("ui.inventory.low_stock", "Low stock")}
                            value={cards.low_stock_products ?? 0}
                            icon="⚠️"
                        />
                        <StatCard
                            title={t("ui.inventory.total_units", "Available units")}
                            value={cards.total_units ?? 0}
                            icon="📊"
                        />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 p-4 sm:p-6">
                            <div className="mb-4 flex flex-col gap-4">
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
                                            {t(
                                                "ui.inventory.low_stock_threshold",
                                                "Low stock threshold"
                                            )}
                                            : {lowStockThreshold}
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
                                            placeholder={`${t("ui.common.search", "Search")} SKU, slug ou ${t("ui.common.name", "Name").toLowerCase()}`}
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

                                <div className="flex flex-wrap gap-2">
                                    <FilterButton
                                        active={currentQuickFilter === "all"}
                                        onClick={() => handleQuickFilter("all")}
                                    >
                                        {t("ui.common.all", "All")}
                                    </FilterButton>

                                    <FilterButton
                                        active={currentQuickFilter === "critical"}
                                        onClick={() => handleQuickFilter("critical")}
                                    >
                                        {t("ui.inventory.critical_products", "Critical products")}
                                    </FilterButton>

                                    <FilterButton
                                        active={currentQuickFilter === "out"}
                                        onClick={() => handleQuickFilter("out")}
                                    >
                                        {t("ui.inventory.out_of_stock", "Out of stock")}
                                    </FilterButton>

                                    <FilterButton
                                        active={currentQuickFilter === "low"}
                                        onClick={() => handleQuickFilter("low")}
                                    >
                                        {t("ui.inventory.low_stock", "Low stock")}
                                    </FilterButton>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-gray-600">
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 pl-6 pr-4">
                                            <SortButton
                                                label="SKU"
                                                field="sku"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

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
                                            {t("ui.common.active", "Active")}
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
                                            <SortButton
                                                label={t("ui.inventory.status", "Inventory status")}
                                                field="status"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
                                        </th>

                                        <th className="px-4 py-3">
                                            <SortButton
                                                label={t("ui.inventory.warehouse_summary", "Armazém / Resumo")}
                                                field="warehouse"
                                                currentSort={currentSort}
                                                currentDirection={currentDirection}
                                                onSort={handleSort}
                                            />
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
                                        const inv = p.inventories?.[0] ?? null;
                                        const warehouseName = inv?.warehouse_name ?? "—";
                                        const qtyOnHand = inv?.qty_on_hand ?? p.available_stock ?? 0;
                                        const availableQty = Number(
                                            p.available_stock ?? inv?.available_qty ?? 0
                                        );
                                        const name = getTranslatedName(p, locale);
                                        const isVariable = p?.type === "variable";

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

                                                            <div className="mt-2">
                                                                <ProductTypeBadge product={p} t={t} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <ActiveBadge active={p.is_active} t={t} />
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <StockBadge
                                                        availableQty={availableQty}
                                                        lowStockThreshold={lowStockThreshold}
                                                        t={t}
                                                    />
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    <InventoryStatusBadge product={p} t={t} />
                                                </td>

                                                <td className="px-4 py-4 align-top">
                                                    {!isVariable ? (
                                                        <span className="text-sm text-gray-700">
                                                            {warehouseName}
                                                        </span>
                                                    ) : (
                                                        <div className="min-w-[240px]">
                                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                {t("ui.inventory.variant_summary", "Resumo das variantes")}
                                                            </div>

                                                            <VariantSummaryList
                                                                variants={p.variants_summary ?? []}
                                                                t={t}
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="whitespace-nowrap py-4 pl-4 pr-6 text-right align-top">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                        {!isVariable ? (
                                                            <>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={stockValues[p.id] ?? String(qtyOnHand)}
                                                                    onChange={(e) =>
                                                                        setStockValues((prev) => ({
                                                                            ...prev,
                                                                            [p.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="w-28 rounded-md border-gray-300 text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => submitStock(p.id)}
                                                                    className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                                                >
                                                                    {t("ui.common.save", "Save")}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="text-xs text-gray-500 sm:mr-2">
                                                                {t(
                                                                    "ui.inventory.variable_stock_managed_in_product",
                                                                    "Stock por variantes. Edita no produto."
                                                                )}
                                                            </div>
                                                        )}

                                                        <Link
                                                            href={managerProductHref}
                                                            className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {t("ui.common.edit", "Edit")}
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {(products.data ?? []).length === 0 ? (
                                        <tr>
                                            <td className="py-10 text-center text-gray-500" colSpan={7}>
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
        </AuthenticatedLayout>
    );
}
