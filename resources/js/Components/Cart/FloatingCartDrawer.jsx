import { Link, router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

function formatMoney(amount, currency) {
    if (amount === null || amount === undefined) return "-";

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return "-";

    const decimals = Number(currency?.decimal_places ?? 2);
    const symbol = currency?.symbol ?? "€";
    const divisor = Math.pow(10, decimals);
    const value = (numericAmount / divisor).toFixed(decimals);

    return `${value} ${symbol}`;
}

function CartIcon() {
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
                d="M3 3h2l1.2 6m0 0h11.8l1.5-5H6.2m0 0L7.1 13.2a2 2 0 0 0 2 1.8h8.4M10 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm8 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
            />
        </svg>
    );
}

function buildVariantLabel(item) {
    if (item?.variant_label && String(item.variant_label).trim() !== "") {
        return String(item.variant_label).trim();
    }

    const selectedOptions = Array.isArray(item?.selected_options)
        ? item.selected_options
        : [];

    if (!selectedOptions.length) {
        return null;
    }

    return selectedOptions
        .map((row) => {
            const name = row?.attribute_name ?? row?.name ?? "";
            const value = row?.attribute_value_name ?? row?.value ?? "";

            if (!name && !value) return null;
            if (!name) return value;
            if (!value) return name;

            return `${name}: ${value}`;
        })
        .filter(Boolean)
        .join(" · ");
}

function resolveItemSku(item) {
    return item?.variant_sku ?? item?.sku ?? null;
}

export default function FloatingCartDrawer({ locale }) {
    const { t } = useI18n();
    const page = usePage();
    const cart = page.props?.cart;

    const [open, setOpen] = useState(false);
    const [badgeAnimated, setBadgeAnimated] = useState(false);
    const wrapRef = useRef(null);
    const previousCountRef = useRef(null);

    const items = Array.isArray(cart?.items) ? cart.items : [];
    const parsedCount = Number(cart?.count);
    const count = Number.isFinite(parsedCount) ? parsedCount : 0;

    const total = Number.isFinite(Number(cart?.amounts?.total))
        ? Number(cart.amounts.total)
        : Number(cart?.amounts?.subtotal ?? 0);

    const currency = cart?.currency ?? { symbol: "€", decimal_places: 2 };

    const hasItems = useMemo(() => items.length > 0, [items]);

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
        const previousCount = previousCountRef.current;

        if (previousCount !== null && previousCount !== count) {
            setBadgeAnimated(true);

            const timer = window.setTimeout(() => {
                setBadgeAnimated(false);
            }, 450);

            previousCountRef.current = count;

            return () => window.clearTimeout(timer);
        }

        previousCountRef.current = count;
    }, [count]);

    useEffect(() => {
        if (!hasItems && open) {
            setOpen(false);
        }
    }, [hasItems, open]);

    const removeItem = (id) => {
        router.delete(route("cart.items.destroy", { locale, item: id }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                router.reload({ only: ["cart", "flash", "errors"] });
            },
        });
    };

    const productHref = (item) => {
        if (!item?.slug) return null;

        return route("shop.products.show", {
            locale,
            product: item.slug,
        });
    };

    return (
        <div
            ref={wrapRef}
            className="fixed right-4 top-20 z-[999] sm:right-6 sm:top-22"
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={t("ui.nav.cart", "Carrinho")}
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg ring-1 ring-black/5 transition hover:bg-gray-50"
            >
                <CartIcon />

                {count > 0 && (
                    <span
                        className={[
                            "absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white transition-transform duration-300",
                            badgeAnimated ? "scale-125" : "scale-100",
                        ].join(" ")}
                    >
                        {count > 99 ? "99+" : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-3 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">
                                {t("ui.nav.cart", "Carrinho")}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {count}{" "}
                                {count === 1
                                    ? t("ui.cart.item", "item")
                                    : t("ui.cart.items", "items")}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            aria-label={t("ui.common.close", "Fechar")}
                        >
                            ✕
                        </button>
                    </div>

                    {!hasItems ? (
                        <div className="px-4 py-6 text-sm text-gray-600">
                            {t("ui.cart.empty", "O carrinho está vazio.")}
                        </div>
                    ) : (
                        <>
                            <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4">
                                {items.map((item) => {
                                    const href = productHref(item);
                                    const variantLabel = buildVariantLabel(item);
                                    const itemSku = resolveItemSku(item);

                                    return (
                                        <div
                                            key={item.id}
                                            className="flex gap-3 rounded-xl border border-gray-100 p-3"
                                        >
                                            {href ? (
                                                <Link
                                                    href={href}
                                                    onClick={() => setOpen(false)}
                                                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100"
                                                >
                                                    {item.image?.url ? (
                                                        <img
                                                            src={item.image.url}
                                                            alt={item.image.alt || item.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                                            IMG
                                                        </div>
                                                    )}
                                                </Link>
                                            ) : (
                                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                                    {item.image?.url ? (
                                                        <img
                                                            src={item.image.url}
                                                            alt={item.image.alt || item.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                                            IMG
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                {href ? (
                                                    <Link
                                                        href={href}
                                                        onClick={() => setOpen(false)}
                                                        className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-gray-700 hover:underline"
                                                    >
                                                        {item.name}
                                                    </Link>
                                                ) : (
                                                    <div className="line-clamp-2 text-sm font-medium text-gray-900">
                                                        {item.name}
                                                    </div>
                                                )}

                                                {variantLabel ? (
                                                    <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                                                        {variantLabel}
                                                    </div>
                                                ) : null}

                                                {itemSku ? (
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {t("ui.shop.sku_label", "SKU")}: {itemSku}
                                                    </div>
                                                ) : null}

                                                <div className="mt-1 text-xs text-gray-500">
                                                    {t("ui.cart.qty", "Qtd")}: {item.qty}
                                                </div>

                                                <div className="mt-1 text-sm font-semibold text-gray-900">
                                                    {formatMoney(item.line_total, currency)}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                className="self-start rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                                title={t("ui.cart.remove", "Remover")}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">
                                        {t("ui.thankyou.total", "Total")}
                                    </span>
                                    <span className="font-bold text-gray-900">
                                        {formatMoney(total, currency)}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <Link
                                        href={route("cart.index", { locale })}
                                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                        onClick={() => setOpen(false)}
                                    >
                                        {t("ui.nav.cart", "Carrinho")}
                                    </Link>

                                    <Link
                                        href={route("checkout.index", { locale })}
                                        className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                        onClick={() => setOpen(false)}
                                    >
                                        {t("ui.cart.go_to_checkout", "Checkout")}
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
