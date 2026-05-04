import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function getCategoryName(category, locale) {
    const tr =
        (category?.translations ?? []).find((x) => x.language?.code === locale) ??
        (category?.translations ?? [])[0] ??
        null;

    return tr?.name ?? category?.slug ?? "—";
}

function CategoryNode({ category, level = 0, locale, onDelete, t }) {
    const isParent = !category.parent_id;
    const children = Array.isArray(category.children) ? category.children : [];
    const hasChildren = children.length > 0;

    const categoryName = getCategoryName(category, locale);
    const parentName = category.parent ? getCategoryName(category.parent, locale) : null;

    const childrenCountLabel =
        children.length === 1
            ? `1 ${t("ui.common.child", "child")}`
            : `${children.length} ${t("ui.common.children", "children")}`;

    return (
        <div>
            <div
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ paddingLeft: `${level * 22}px` }}
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {!isParent && (
                            <span className="select-none text-sm text-gray-400">↳</span>
                        )}

                        <div className="break-words font-semibold text-gray-900">
                            {categoryName}
                        </div>

                        {isParent && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {t("ui.categories.parent_badge", "Parent")}
                            </span>
                        )}

                        {!isParent && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                {t("ui.categories.child_badge", "Child")}
                            </span>
                        )}

                        {hasChildren && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {childrenCountLabel}
                            </span>
                        )}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 break-all">
                        {category.slug}
                    </div>

                    {!isParent && parentName && (
                        <div className="mt-1 text-sm text-gray-500">
                            {t("ui.categories.child_of", "Subcategory of")}{" "}
                            <span className="font-medium">{parentName}</span>
                        </div>
                    )}

                    {!category.is_active && (
                        <div className="mt-1 text-sm text-red-700">
                            {t("ui.common.inactive", "Inactive")}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={route("manager.categories.edit", { locale, category: category.id })}
                        className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {t("ui.common.edit", "Edit")}
                    </Link>

                    <button
                        type="button"
                        onClick={() => onDelete(category)}
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                        {t("ui.common.delete", "Delete")}
                    </button>
                </div>
            </div>

            {hasChildren && (
                <div className="ml-2 border-l border-gray-200">
                    {children.map((child) => (
                        <CategoryNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            locale={locale}
                            onDelete={onDelete}
                            t={t}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CategoriesIndex() {
    const { locale, categories = [] } = usePage().props;
    const { t } = useI18n();
    const [q, setQ] = useState("");

    const filteredTree = useMemo(() => {
        const search = q.trim().toLowerCase();

        const byParent = new Map();

        categories.forEach((category) => {
            const key = category.parent_id ?? null;

            if (!byParent.has(key)) {
                byParent.set(key, []);
            }

            byParent.get(key).push({
                ...category,
                children: [],
            });
        });

        const sortCategories = (items) => {
            return [...items].sort((a, b) => {
                const posA = a.position ?? 0;
                const posB = b.position ?? 0;

                if (posA !== posB) return posA - posB;
                return a.id - b.id;
            });
        };

        const buildTree = (parentId = null) => {
            const items = sortCategories(byParent.get(parentId) ?? []);

            return items.map((item) => ({
                ...item,
                children: buildTree(item.id),
            }));
        };

        const tree = buildTree(null);

        if (!search) return tree;

        const filterTree = (nodes) => {
            return nodes
                .map((node) => {
                    const translatedName = getCategoryName(node, locale).toLowerCase();
                    const slug = String(node.slug ?? "").toLowerCase();
                    const selfMatches =
                        translatedName.includes(search) || slug.includes(search);

                    const filteredChildren = filterTree(node.children ?? []);

                    if (selfMatches || filteredChildren.length > 0) {
                        return {
                            ...node,
                            children: filteredChildren,
                        };
                    }

                    return null;
                })
                .filter(Boolean);
        };

        return filterTree(tree);
    }, [categories, q, locale]);

    const onDelete = (c) => {
        const label = getCategoryName(c, locale);

        if (!confirm(`${t("ui.common.delete", "Delete")} "${label}"?`)) return;

        router.delete(route("manager.categories.destroy", { locale, category: c.id }), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.common.categories1", "Categories")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(
                                "ui.manager.categories_desc",
                                "Manage categories, category relationships and translations"
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("manager.categories.create", { locale })}
                            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            + {t("ui.common.new", "New")} {t("ui.common.category", "Category")}
                        </Link>

                        <Link
                            href={route("manager.dashboard", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.manager.back_to_management", "Back to Management")}
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title={t("ui.manager.categories_page_title", "Manager · Categories")} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={t("ui.common.search", "Search…")}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:w-96"
                        />
                    </div>

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-4 sm:p-6">
                            {filteredTree.length === 0 ? (
                                <div className="text-gray-600">
                                    {t("ui.common.empty", "No results.")}
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredTree.map((category) => (
                                        <CategoryNode
                                            key={category.id}
                                            category={category}
                                            level={0}
                                            locale={locale}
                                            onDelete={onDelete}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
