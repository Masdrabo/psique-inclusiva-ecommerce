import { useEffect, useMemo, useRef, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";

function formatMoney(amount, currency) {
    if (amount === null || amount === undefined) return null;

    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? "€";
    const value = (Number(amount || 0) / Math.pow(10, dp)).toFixed(dp);

    return `${value} ${symbol}`;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }) {
    if (!text) return null;

    const safeQuery = query.trim();
    if (safeQuery.length < 2) {
        return <>{text}</>;
    }

    const regex = new RegExp(`(${escapeRegExp(safeQuery)})`, "ig");
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = part.toLowerCase() === safeQuery.toLowerCase();

                if (isMatch) {
                    return (
                        <mark
                            key={index}
                            className="rounded bg-emerald-100 px-0.5 text-emerald-800"
                        >
                            {part}
                        </mark>
                    );
                }

                return <span key={index}>{part}</span>;
            })}
        </>
    );
}

export default function SearchBar({
    locale,
    t,
    compact = false,
    className = "",
}) {
    const page = usePage();
    const user = page.props?.auth?.user ?? null;

    const [query, setQuery] = useState("");
    const [results, setResults] = useState({
        products: [],
        categories: [],
    });
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);

    const timeoutRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults({ products: [], categories: [] });
            setOpen(false);
            setLoading(false);
            return;
        }

        window.clearTimeout(timeoutRef.current);

        timeoutRef.current = window.setTimeout(() => {
            setLoading(true);

            fetch(`/${locale}/search?q=${encodeURIComponent(query)}`)
                .then((res) => res.json())
                .then((data) => {
                    setResults({
                        products: Array.isArray(data?.products) ? data.products : [],
                        categories: Array.isArray(data?.categories) ? data.categories : [],
                    });
                    setOpen(true);
                })
                .catch(() => {
                    setResults({ products: [], categories: [] });
                    setOpen(false);
                })
                .finally(() => {
                    setLoading(false);
                });
        }, 250);

        return () => window.clearTimeout(timeoutRef.current);
    }, [query, locale]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const hasResults = useMemo(() => {
        return results.products.length > 0 || results.categories.length > 0;
    }, [results]);

    const showEmptyState =
        query.trim().length >= 2 && !loading && open && !hasResults;

    const handleAddToCart = (event, product) => {
        event.preventDefault();
        event.stopPropagation();

        if (!user) {
            router.visit(route("login", { locale }));
            return;
        }

        setAddingProductId(product.id);

        router.post(
            route("cart.items.store", { locale }),
            {
                product_id: product.id,
                qty: 1,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    router.reload({ only: ["cart", "flash", "errors"] });
                },
                onFinish: () => {
                    setAddingProductId(null);
                },
            }
        );
    };

    return (
        <div ref={wrapperRef} className={`relative w-full ${className}`}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim().length >= 2) {
                            setOpen(true);
                        }
                    }}
                    placeholder={t("ui.search.placeholder", "Search products...")}
                    className={[
                        "w-full rounded-xl border border-gray-300 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300",
                        compact
                            ? "px-4 py-2.5 pr-10 text-sm"
                            : "px-4 py-3 pr-11 text-sm",
                    ].join(" ")}
                />

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                    {loading ? (
                        <svg
                            className="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
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
                                d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {(open && hasResults) || showEmptyState ? (
                <div className="absolute left-0 right-0 top-full z-[999] mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    {results.products.length > 0 && (
                        <div className="p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t("ui.search.products", "Products")}
                            </div>

                            <div className="space-y-1">
                                {results.products.map((product) => {
                                    const productHref = route("shop.products.show", {
                                        locale,
                                        product: product.slug,
                                    });

                                    const canAddToCart = !!product.price;
                                    const isAdding = addingProductId === product.id;

                                    return (
                                        <div
                                            key={product.id}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                                        >
                                            <Link
                                                href={productHref}
                                                className="flex min-w-0 flex-1 items-center gap-3"
                                                onClick={() => setOpen(false)}
                                            >
                                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                                    {product.image?.url ? (
                                                        <img
                                                            src={product.image.url}
                                                            alt={product.image.alt || product.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                                            IMG
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium text-gray-900">
                                                        <HighlightedText text={product.name} query={query} />
                                                    </div>

                                                    {product.price ? (
                                                        <div className="mt-0.5 text-xs text-gray-500">
                                                            {formatMoney(
                                                                product.price.amount,
                                                                product.price.currency
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-0.5 text-xs text-gray-400">
                                                            {t("ui.shop.price_unavailable", "Price unavailable")}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={(event) => handleAddToCart(event, product)}
                                                disabled={!canAddToCart || isAdding}
                                                className={[
                                                    "shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition",
                                                    canAddToCart && !isAdding
                                                        ? "bg-gray-900 text-white hover:bg-gray-800"
                                                        : "cursor-not-allowed bg-gray-200 text-gray-500",
                                                ].join(" ")}
                                                aria-label={t("ui.shop.add_to_cart", "Add to cart")}
                                            >
                                                {isAdding
                                                    ? t("ui.shop.adding_to_cart", "Adding...")
                                                    : t("ui.shop.add_to_cart", "Add to cart")}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {results.categories.length > 0 && (
                        <div className="border-t border-gray-100 p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t("ui.search.categories", "Categories")}
                            </div>

                            <div className="space-y-1">
                                {results.categories.map((category) => (
                                    <Link
                                        key={category.id}
                                        href={route("shop.categories.show", {
                                            locale,
                                            category: category.slug,
                                        })}
                                        className="block rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
                                        onClick={() => setOpen(false)}
                                    >
                                        <HighlightedText text={category.name} query={query} />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {showEmptyState && (
                        <div className="p-4 text-sm text-gray-500">
                            {t("ui.search.no_results", "No results found.")}
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
