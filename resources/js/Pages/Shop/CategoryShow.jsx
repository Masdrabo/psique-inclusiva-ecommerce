import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import PaginationLinks from "@/Components/PaginationLinks";
import { Head, Link, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import ProductCard from "@/Components/Shop/ProductCard";

function buildCategoryChain(category) {
    if (!category) return [];

    const ancestors = Array.isArray(category.ancestors) ? category.ancestors : [];

    return [
        ...ancestors,
        {
            id: category.id,
            slug: category.slug,
            name: category.name,
            image: category.image,
        },
    ].filter((item) => item?.name);
}

function buildCategoryPathLabel(category) {
    return buildCategoryChain(category)
        .map((item) => item.name)
        .join(" - ");
}

function CategoryImageCard({ href, name, image }) {
    const hasImage = !!image;

    return (
        <Link
            href={href}
            aria-label={name}
            className="group relative block min-h-[120px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 sm:min-h-[150px]"
        >
            {hasImage ? (
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${image})` }}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
            )}
        </Link>
    );
}

export default function CategoryShow() {
    const {
        auth,
        locale,
        category,
        products,
        wishlist_product_ids = [],
    } = usePage().props;

    const user = auth?.user ?? null;
    const { t } = useI18n();

    const title =
        category?.meta_title || category?.name || t("ui.shop.category", "Category");
    const description =
        category?.meta_description ||
        category?.description ||
        t("ui.shop.categories_hint", "Browse by category.");

    const items = Array.isArray(products?.data) ? products.data : [];
    const links = Array.isArray(products?.links) ? products.links : [];
    const children = Array.isArray(category?.children) ? category.children : [];
    const wishlistProductIds = Array.isArray(wishlist_product_ids)
        ? wishlist_product_ids
        : [];
    const breadcrumbItems = buildCategoryChain(category);
    const currentCategoryPath = buildCategoryPathLabel(category);
    const hasHeroImage = !!category?.image;
    const ogImage = category?.image || "/og-default.jpg";

    const pageHeader = (
        <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
                {category?.name}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                <Link
                    href={route("shop.index", { locale })}
                    className="hover:text-gray-900"
                >
                    {t("ui.nav.shop", "Shop")}
                </Link>

                {breadcrumbItems.map((item, index) => {
                    const isLast = index === breadcrumbItems.length - 1;

                    return (
                        <div
                            key={item.id ?? `${item.slug}-${index}`}
                            className="inline-flex items-center gap-2"
                        >
                            <span>/</span>

                            {isLast ? (
                                <span className="font-semibold text-gray-900">
                                    {item.name}
                                </span>
                            ) : (
                                <Link
                                    href={route("shop.categories.show", {
                                        locale,
                                        category: item.slug,
                                    })}
                                    className="hover:text-gray-900"
                                >
                                    {item.name}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const pageHeaderActions = (
        <Link
            href={route("shop.index", { locale })}
            className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
            {t("ui.shop.back_to_shop", "Back to shop")}
        </Link>
    );

    return (
        <AuthenticatedLayout
            header={pageHeader}
            headerActions={pageHeaderActions}
        >
            <Head title={title}>
                <meta name="description" content={description} />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description} />
                <meta property="og:image" content={ogImage} />
                <meta property="og:type" content="website" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={description} />
                <meta name="twitter:image" content={ogImage} />
            </Head>

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        {hasHeroImage ? (
                            <div className="overflow-hidden">
                                <div
                                    className="min-h-[220px] bg-cover bg-center sm:min-h-[280px]"
                                    style={{ backgroundImage: `url(${category.image})` }}
                                />
                            </div>
                        ) : (
                            <div className="p-6 sm:p-8">
                                <div className="mx-auto max-w-4xl text-center">
                                    <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                        {currentCategoryPath || category?.name}
                                    </div>
                                    <div className="mt-2 text-base text-gray-600 sm:text-lg">
                                        {category?.description
                                            ? category.description
                                            : t("ui.shop.categories_hint", "Browse by category.")}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {children.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                            <div className="p-6 sm:p-8">
                                <div className="mt-6 flex flex-wrap justify-center gap-4">
                                    {children.map((c) => (
                                        <div
                                            key={c.id}
                                            className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]"
                                        >
                                            <CategoryImageCard
                                                href={route("shop.categories.show", {
                                                    locale,
                                                    category: c.slug,
                                                })}
                                                name={c.name}
                                                image={c.image}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="space-y-5 p-6 sm:p-8">
                            {items.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                        {items.map((p) => (
                                            <ProductCard
                                                key={p.id}
                                                product={p}
                                                locale={locale}
                                                user={user}
                                                isSaved={wishlistProductIds.includes(p.id)}
                                                t={t}
                                                showWishlistButton={!!user}
                                                showAddToCartButton
                                            />
                                        ))}
                                    </div>

                                    <PaginationLinks links={links} variant="centered" />
                                </>
                            ) : (
                                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-base text-gray-600">
                                    {t(
                                        "ui.shop.no_products_in_category",
                                        "No products in this category yet."
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {!hasHeroImage && category?.description ? (
                        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                            <div className="p-6 sm:p-8">
                                <div className="rounded-xl bg-gray-50 p-5">
                                    <div className="text-base font-bold text-gray-900">
                                        {t(
                                            "ui.shop.category_description",
                                            "Category description"
                                        )}
                                    </div>

                                    <div className="mt-2 whitespace-pre-line text-base leading-7 text-gray-700">
                                        {category.description}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
