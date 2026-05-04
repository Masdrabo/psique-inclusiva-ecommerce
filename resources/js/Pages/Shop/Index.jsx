import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, usePage } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import ProductCard from "@/Components/Shop/ProductCard";

function CategoryCard({ href, name, image, variant = "default" }) {
    if (variant === "overlay") {
        return (
            <Link
                href={href}
                aria-label={name}
                className="inline-flex min-h-[90px] w-full items-center justify-center rounded-[28px] border border-white/60 bg-[#f4efe9]/75 px-5 py-5 text-center text-[15px] font-semibold uppercase tracking-[0.1em] text-gray-800 shadow-md backdrop-blur-md transition-all duration-200 hover:bg-[#f4efe9]/95 hover:text-gray-900 hover:shadow-lg"
            >
                <span className="leading-snug">{name}</span>
            </Link>
        );
    }

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

            <div className="absolute inset-0 bg-black/10" />

            <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white/85 px-3 py-2 text-center text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-sm">
                {name}
            </div>
        </Link>
    );
}

function CarouselArrow({ direction = "next", onClick, disabled, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={[
                "inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-sm transition",
                disabled
                    ? "cursor-not-allowed border-gray-200 text-gray-300"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50",
            ].join(" ")}
        >
            {direction === "prev" ? (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 18l-6-6 6-6"
                    />
                </svg>
            ) : (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 6l6 6-6 6"
                    />
                </svg>
            )}
        </button>
    );
}

function ProductCarousel({
    title,
    subtitle,
    products,
    locale,
    user,
    wishlistProductIds,
    t,
    showBestSellerBadge = false,
    autoRotate = true,
}) {
    const items = Array.isArray(products) ? products : [];
    const [itemsPerView, setItemsPerView] = useState(3);
    const [index, setIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);

    useEffect(() => {
        const updateItemsPerView = () => {
            if (window.innerWidth < 640) {
                setItemsPerView(1);
                return;
            }

            if (window.innerWidth < 1024) {
                setItemsPerView(2);
                return;
            }

            setItemsPerView(3);
        };

        updateItemsPerView();
        window.addEventListener("resize", updateItemsPerView);

        return () => window.removeEventListener("resize", updateItemsPerView);
    }, []);

    useEffect(() => {
        const maxIndex = Math.max(0, items.length - itemsPerView);

        if (index > maxIndex) {
            setIndex(maxIndex);
        }
    }, [index, items.length, itemsPerView]);

    const maxIndex = Math.max(0, items.length - itemsPerView);
    const canGoPrev = index > 0;
    const canGoNext = index < maxIndex;

    useEffect(() => {
        if (!autoRotate || isHovered || items.length <= itemsPerView) return;

        const interval = window.setInterval(() => {
            setIndex((prev) => {
                if (prev >= maxIndex) return 0;
                return prev + 1;
            });
        }, 6000);

        return () => window.clearInterval(interval);
    }, [autoRotate, isHovered, items.length, itemsPerView, maxIndex]);

    const trackStyle = {
        width: `${(items.length / itemsPerView) * 100}%`,
        transform: `translateX(-${(index * 100) / items.length}%)`,
    };

    const goPrev = () => setIndex((prev) => Math.max(0, prev - 1));
    const goNext = () => setIndex((prev) => Math.min(maxIndex, prev + 1));

    const onTouchStart = (e) => {
        touchStartX.current = e.touches?.[0]?.clientX ?? null;
        touchEndX.current = null;
    };

    const onTouchMove = (e) => {
        touchEndX.current = e.touches?.[0]?.clientX ?? null;
    };

    const onTouchEnd = () => {
        if (
            touchStartX.current === null ||
            touchEndX.current === null ||
            items.length <= itemsPerView
        ) {
            return;
        }

        const delta = touchStartX.current - touchEndX.current;
        const threshold = 50;

        if (delta > threshold && canGoNext) {
            goNext();
        } else if (delta < -threshold && canGoPrev) {
            goPrev();
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <div
            className="overflow-hidden rounded-2xl bg-white shadow-sm"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="space-y-5 p-6 text-gray-900 sm:p-8">
                <div className="space-y-4">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
                            {title}
                        </div>
                        {subtitle ? (
                            <div className="mt-2 text-base text-gray-600 sm:text-lg">
                                {subtitle}
                            </div>
                        ) : null}
                    </div>

                    {items.length > itemsPerView ? (
                        <div className="flex items-center justify-center gap-2">
                            <CarouselArrow
                                direction="prev"
                                onClick={goPrev}
                                disabled={!canGoPrev}
                                label={t("ui.shop.carousel_prev", "Previous products")}
                            />
                            <CarouselArrow
                                direction="next"
                                onClick={goNext}
                                disabled={!canGoNext}
                                label={t("ui.shop.carousel_next", "Next products")}
                            />
                        </div>
                    ) : null}
                </div>

                {items.length > 0 ? (
                    <>
                        <div
                            className="overflow-hidden"
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                        >
                            <div
                                className="flex transition-transform duration-500 ease-out"
                                style={trackStyle}
                            >
                                {items.map((p) => {
                                    const isSaved = wishlistProductIds.includes(p.id);

                                    return (
                                        <div
                                            key={p.id}
                                            className="shrink-0 px-2"
                                            style={{ width: `${100 / items.length}%` }}
                                        >
                                            <ProductCard
                                                product={p}
                                                locale={locale}
                                                user={user}
                                                isSaved={isSaved}
                                                t={t}
                                                showWishlistButton={!!user}
                                                showAddToCartButton
                                                showBestSellerBadge={showBestSellerBadge}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {items.length > itemsPerView ? (
                            <div className="flex justify-center gap-2 pt-1">
                                {Array.from({ length: maxIndex + 1 }).map((_, dotIndex) => (
                                    <button
                                        key={dotIndex}
                                        type="button"
                                        onClick={() => setIndex(dotIndex)}
                                        aria-label={`${title} ${dotIndex + 1}`}
                                        className={[
                                            "h-2.5 w-2.5 rounded-full transition",
                                            dotIndex === index
                                                ? "bg-gray-900"
                                                : "bg-gray-300 hover:bg-gray-400",
                                        ].join(" ")}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-base text-gray-600">
                        {t("ui.shop.no_products", "No products yet.")}
                    </div>
                )}
            </div>
        </div>
    );
}

function chunkIntoRows(items, size = 3) {
    const rows = [];

    for (let i = 0; i < items.length; i += size) {
        rows.push(items.slice(i, i + size));
    }

    return rows;
}

export default function ShopIndex() {
    const {
        auth,
        locale,
        products,
        categories,
        wishlist_product_ids,
        bestSellingProducts = [],
    } = usePage().props;

    const user = auth?.user ?? null;
    const { t } = useI18n();

    const allCategories = Array.isArray(categories) ? categories : [];
    const items = Array.isArray(products) ? products : [];
    const bestSellers = Array.isArray(bestSellingProducts)
        ? bestSellingProducts
        : [];
    const wishlistProductIds = Array.isArray(wishlist_product_ids)
        ? wishlist_product_ids
        : [];

    const categoryRows = chunkIntoRows(allCategories, 3);

    const title = t("ui.nav.shop", "Shop");
    const description = t("ui.shop.categories_hint", "Browse by category.");
    const ogImage = "/og-default.jpg";
    const heroImage = "/images/shop-frame-bg.jpg";

    const institutionalLinks = [
        {
            label: t("ui.shop.institutional_contacts", "Contactos"),
            href: route("purpose.index", { locale }) + "#contactos",
        },
        {
            label: t("ui.shop.institutional_about", "Sobre nós"),
            href: route("purpose.index", { locale }) + "#sobre-nos",
        },
        {
            label: t("ui.shop.institutional_support", "Apoio"),
            href: route("faq", { locale }),
        },
        {
            label: t("ui.shop.institutional_emails", "E-mails"),
            href: route("purpose.index", { locale }) + "#emails",
        },
    ];

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t("ui.nav.shop", "Shop")}
                </h2>
            }
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
                        <div className="p-4 sm:p-6 lg:p-8">
                            {allCategories.length > 0 ? (
                                <>
                                    <div className="hidden min-[700px]:block">
                                        <div className="relative overflow-hidden rounded-[2rem] border border-[#d9d0c7] bg-[#f7f2ec] p-4 lg:p-6 xl:p-8">
                                            <div className="space-y-5">
                                                <div className="mx-auto w-full max-w-[980px] rounded-[2rem] border border-[#cfc3b8] bg-[#efe7de] p-4 lg:p-5 xl:p-6 shadow-[0_15px_40px_rgba(0,0,0,0.08)]">
                                                    <div className="relative overflow-hidden rounded-[1.5rem] border border-[#cabdad] bg-[#e9dfd3]">
                                                        <div className="relative w-full h-[520px] lg:h-[600px] xl:h-[650px]">
                                                            <div
                                                                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                                                                style={{
                                                                    backgroundImage: `url(${heroImage})`,
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-white/10" />

                                                            <div className="absolute inset-x-0 top-[2px] z-10 px-4 lg:px-8 xl:px-12">
                                                                <div className="text-center">
                                                                    <div className="text-[34px] md:text-[38px] lg:text-[42px] xl:text-[56px] font-light uppercase tracking-[0.16em] text-gray-600">
                                                                        MenteMovimento
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-3 md:px-4 lg:px-8 xl:px-12">
                                                                <div className="space-y-6 lg:space-y-8 xl:space-y-10">
                                                                    {categoryRows.map((row, rowIndex) => {
                                                                        const rowLayoutClass =
                                                                            row.length === 1
                                                                                ? "grid-cols-1 max-w-[160px] md:max-w-[170px] lg:max-w-[250px]"
                                                                                : row.length === 2
                                                                                ? "grid-cols-2 max-w-[340px] md:max-w-[360px] lg:max-w-[560px]"
                                                                                : "grid-cols-3 max-w-[520px] md:max-w-[570px] lg:max-w-[930px]";

                                                                        return (
                                                                            <div
                                                                                key={`row-${rowIndex}`}
                                                                                className={`mx-auto grid ${rowLayoutClass} gap-3 md:gap-4 lg:gap-6 xl:gap-8 justify-items-center`}
                                                                            >
                                                                                {row.map((category) => (
                                                                                    <div
                                                                                        key={category.id}
                                                                                        className="w-full max-w-[160px] md:max-w-[170px] lg:max-w-[250px]"
                                                                                    >
                                                                                        <CategoryCard
                                                                                            href={route(
                                                                                                "shop.categories.show",
                                                                                                {
                                                                                                    locale,
                                                                                                    category:
                                                                                                        category.slug,
                                                                                                }
                                                                                            )}
                                                                                            name={category.name}
                                                                                            image={category.image}
                                                                                            variant="overlay"
                                                                                        />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-200 pt-5">
                                                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm uppercase tracking-[0.2em] text-gray-600">
                                                        {institutionalLinks.map((item) => (
                                                            <Link
                                                                key={item.label}
                                                                href={item.href}
                                                                className="transition hover:text-gray-900"
                                                            >
                                                                {item.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="min-[700px]:hidden">
                                        <div className="mx-auto max-w-3xl text-center">
                                            <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                                MenteMovimento
                                            </div>
                                            <div className="mt-2 text-base text-gray-600 sm:text-lg">
                                                {t(
                                                    "ui.shop.categories_hint",
                                                    "Browse by category."
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-6 flex flex-wrap justify-center gap-4">
                                            {allCategories.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="w-full sm:w-[calc(50%-0.5rem)]"
                                                >
                                                    <CategoryCard
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

                                        <div className="mt-6 border-t border-gray-200 pt-4">
                                            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.18em] text-gray-600 sm:text-sm">
                                                {institutionalLinks.map((item) => (
                                                    <Link
                                                        key={item.label}
                                                        href={item.href}
                                                        className="transition hover:text-gray-900"
                                                    >
                                                        {item.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-base text-gray-600">
                                    {t("ui.shop.no_categories", "No categories yet.")}
                                </div>
                            )}
                        </div>
                    </div>

                    <ProductCarousel
                        title={t("ui.shop.latest_products", "Latest products")}
                        subtitle={t(
                            "ui.shop.browse_hint",
                            "Click a product to open the page."
                        )}
                        products={items}
                        locale={locale}
                        user={user}
                        wishlistProductIds={wishlistProductIds}
                        t={t}
                        autoRotate
                    />

                    {bestSellers.length > 0 ? (
                        <ProductCarousel
                            title={t("ui.shop.best_sellers", "Best sellers")}
                            subtitle={t(
                                "ui.shop.best_sellers_hint",
                                "Discover the products customers buy the most."
                            )}
                            products={bestSellers}
                            locale={locale}
                            user={user}
                            wishlistProductIds={wishlistProductIds}
                            t={t}
                            showBestSellerBadge
                            autoRotate
                        />
                    ) : null}

                    {!user ? (
                        <div className="rounded-2xl bg-amber-50 p-4 text-base text-gray-700">
                            {t(
                                "ui.shop.guest_cart_note",
                                "As a guest, adding to cart will redirect you to login."
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
