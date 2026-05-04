import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import { useEffect } from "react";
import { router } from "@inertiajs/react";

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? "€";
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function formatAddress(address) {
    if (!address || typeof address !== "object") return "—";

    const parts = [
        address.name,
        address.line1,
        address.line2,
        [address.postal_code, address.city].filter(Boolean).join(" "),
        address.region,
        address.country_code,
    ].filter(Boolean);

    return parts.join("\n");
}

function badgeBase(extra = "") {
    return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${extra}`;
}

function orderStatusBadge(status, t) {
    const code = status?.code ?? "";
    const label = status?.name ?? status?.code ?? "—";

    if (code === "pending_payment") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {label}
            </span>
        );
    }

    if (code === "paid") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {label}
            </span>
        );
    }

    if (code === "processing") {
        return (
            <span className={badgeBase("bg-indigo-100 text-indigo-700")}>
                {label}
            </span>
        );
    }

    if (code === "shipped") {
        return (
            <span className={badgeBase("bg-blue-100 text-blue-700")}>
                {label}
            </span>
        );
    }

    if (code === "delivered") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {label}
            </span>
        );
    }

    if (code === "cancelled") {
        return (
            <span className={badgeBase("bg-red-100 text-red-700")}>
                {label}
            </span>
        );
    }

    return (
        <span className={badgeBase("bg-gray-100 text-gray-700")}>
            {label}
        </span>
    );
}

function paymentBadge(payment, t) {
    const status = payment?.status ?? "";

    if (status === "paid") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {t("ui.statuses.paid", "Paid")}
            </span>
        );
    }

    if (status === "pending") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {t("ui.thankyou.payment_pending", "Payment pending")}
            </span>
        );
    }

    if (status === "authorized") {
        return (
            <span className={badgeBase("bg-blue-100 text-blue-700")}>
                {t("ui.thankyou.payment_authorized", "Payment authorized")}
            </span>
        );
    }

    if (status === "partially_refunded") {
        return (
            <span className={badgeBase("bg-orange-100 text-orange-700")}>
                {t("ui.thankyou.payment_partially_refunded", "Partially refunded")}
            </span>
        );
    }

    if (status === "refunded") {
        return (
            <span className={badgeBase("bg-purple-100 text-purple-700")}>
                {t("ui.thankyou.payment_refunded", "Refunded")}
            </span>
        );
    }

    return (
        <span className={badgeBase("bg-gray-100 text-gray-700")}>
            {status || "—"}
        </span>
    );
}

function shipmentBadge(shipment, t) {
    const status = shipment?.status ?? "";

    if (status === "pending") {
        return (
            <span className={badgeBase("bg-amber-100 text-amber-700")}>
                {t("ui.thankyou.shipping_pending", "Shipping pending")}
            </span>
        );
    }

    if (status === "shipped") {
        return (
            <span className={badgeBase("bg-blue-100 text-blue-700")}>
                {t("ui.statuses.shipped", "Shipped")}
            </span>
        );
    }

    if (status === "delivered") {
        return (
            <span className={badgeBase("bg-green-100 text-green-700")}>
                {t("ui.statuses.delivered", "Delivered")}
            </span>
        );
    }

    if (status === "cancelled") {
        return (
            <span className={badgeBase("bg-red-100 text-red-700")}>
                {t("ui.statuses.cancelled", "Cancelled")}
            </span>
        );
    }

    return (
        <span className={badgeBase("bg-gray-100 text-gray-700")}>
            {status || "—"}
        </span>
    );
}

function CopyButton({ value, label, t }) {
    const copy = async () => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(String(value));
            window.dispatchEvent(
                new CustomEvent("toast", {
                    detail: {
                        type: "success",
                        message: t("ui.thankyou.copied", "Copiado!"),
                    },
                })
            );
        } catch {
            alert(t("ui.thankyou.copied", "Copiado!"));
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
            {label}
        </button>
    );
}

function MultibancoPaymentBox({ payment, currency, t }) {
    if (!payment || payment.method?.code !== "ifthenpay_mb") return null;

    return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-gray-800">
            <div className="text-base font-bold text-gray-900">
                {t("ui.thankyou.multibanco_title", "Pagamento por Multibanco")}
            </div>

            <p className="mt-2 text-gray-700">
                {t(
                    "ui.thankyou.multibanco_help",
                    "Usa os dados abaixo para efetuar o pagamento. A encomenda será atualizada automaticamente após confirmação."
                )}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.multibanco_entity", "Entidade")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                        {payment.entity || "—"}
                    </div>

                    <CopyButton
                        value={payment.entity}
                        label={t("ui.thankyou.copy_entity", "Copiar entidade")}
                        t={t}
                    />
                </div>

                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.multibanco_reference", "Referência")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                        {payment.reference || "—"}
                    </div>

                    <CopyButton
                        value={payment.reference}
                        label={t("ui.thankyou.copy_reference", "Copiar referência")}
                        t={t}
                    />
                </div>

                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.multibanco_amount", "Valor")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                        {formatMoney(payment.amount, currency)}
                    </div>
                </div>

                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.multibanco_expires_at", "Validade")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                        {payment.expires_at
                            ? new Date(payment.expires_at).toLocaleString()
                            : "—"}
                    </div>
                </div>
            </div>

            {payment.payload?.ifthenpay_create_response?.mock ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    MOCK MODE — estes dados são apenas para testes locais.
                </div>
            ) : null}
        </div>
    );
}

function MbwayPaymentBox({ payment, t }) {
    if (!payment || payment.method?.code !== "ifthenpay_mbway") return null;

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-gray-800">
            <div className="text-base font-bold text-gray-900">
                {t("ui.thankyou.mbway_title", "Pagamento por MB WAY")}
            </div>

            <p className="mt-2 text-gray-700">
                {t(
                    "ui.thankyou.mbway_help",
                    "Vais receber uma notificação no teu telemóvel para autorizar o pagamento."
                )}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.mbway_phone", "Telemóvel")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                        {payment.mbway?.phone || "—"}
                    </div>
                </div>

                <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("ui.thankyou.mbway_expires_at", "Validade")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                        {payment.mbway?.expires_at
                            ? new Date(payment.mbway.expires_at).toLocaleString()
                            : "—"}
                    </div>
                </div>
            </div>

            {payment.payload?.ifthenpay_create_response?.mock ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    MOCK MODE — estes dados são apenas para testes locais.
                </div>
            ) : null}
        </div>
    );
}

function InfoCard({ title, children }) {
    return (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="mt-3 text-sm text-gray-700">{children}</div>
        </div>
    );
}

function InfoBox({ children }) {
    return (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {children}
        </div>
    );
}

export default function ThankYou() {
    const { locale, order } = usePage().props;
    const { t } = useI18n();

    useEffect(() => {
        // só faz polling se ainda não estiver pago
        if (order?.payment?.status === "paid") return;

        const interval = setInterval(() => {
            router.reload({
                only: ["order"], // evita reload completo
                preserveScroll: true,
                preserveState: true,
            });
        }, 15000); // 15 segundos

        return () => clearInterval(interval);
    }, [order?.payment?.status]);

    const isPickup = !!order?.is_pickup;
    const hasShipment = !!order?.shipment && !isPickup;
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const itemCount = orderItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t("ui.thankyou.title", "Thank you")}
                </h2>
            }
        >
            <Head title={t("ui.thankyou.title", "Thank you")} />

            <div className="py-6">
                <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="space-y-6 p-6 sm:p-8">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                        {t("ui.thankyou.order_created", "Order created ✅")}
                                    </div>

                                    <p className="mt-2 max-w-2xl text-sm text-gray-600">
                                        {t(
                                            "ui.thankyou.order_created_help",
                                            "Recebemos a tua encomenda. Vais receber um email de confirmação e poderás acompanhar o estado no teu painel."
                                        )}
                                    </p>

                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {orderStatusBadge(order?.status, t)}
                                        {order?.payment ? paymentBadge(order.payment, t) : null}
                                        {hasShipment ? shipmentBadge(order.shipment, t) : null}
                                    </div>

                                    <div className="mt-4 space-y-1 text-sm text-gray-700">
                                        <div>
                                            {t("ui.thankyou.order_number", "Number")}:{" "}
                                            <span className="font-semibold">
                                                {order?.order_number ?? "—"}
                                            </span>
                                        </div>

                                        <div>
                                            {t("ui.thankyou.items_count", "Items")}:{" "}
                                            <span className="font-semibold">{itemCount}</span>
                                        </div>

                                        {order?.payment?.method?.name ? (
                                            <div>
                                                {t("ui.thankyou.payment", "Payment")}:{" "}
                                                <span className="font-semibold">
                                                    {order.payment.method.name}
                                                </span>
                                            </div>
                                        ) : null}

                                        {isPickup ? (
                                            <div>
                                                {t("ui.thankyou.shipping", "Shipping")}:{" "}
                                                <span className="font-semibold">
                                                    {t(
                                                        "ui.thankyou.no_shipping_required_short",
                                                        "Levantamento em loja, sem necessidade de envio físico."
                                                    )}
                                                </span>
                                            </div>
                                        ) : order?.shipment?.method?.name ? (
                                            <div>
                                                {t("ui.thankyou.shipping", "Shipping")}:{" "}
                                                <span className="font-semibold">
                                                    {order.shipment.method.name}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                                    <Link
                                        href={route("panel.orders.show", {
                                            locale,
                                            order: order.id,
                                        })}
                                        className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                    >
                                        {t("ui.thankyou.view_order", "View order")}
                                    </Link>

                                    <Link
                                        href={route("shop.index", { locale })}
                                        className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                    >
                                        {t("ui.thankyou.continue_shopping", "Continue shopping")}
                                    </Link>
                                </div>
                            </div>

                            <MultibancoPaymentBox
                                payment={order?.payment}
                                currency={order?.currency}
                                t={t}
                            />

                            <MbwayPaymentBox
                                payment={order?.payment}
                                t={t}
                            />

                            <div className="grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-3">
                                <InfoCard title={t("ui.thankyou.next_steps_title", "Next steps")}>
                                    <ul className="space-y-1">
                                        <li>
                                            {t(
                                                "ui.thankyou.next_steps_email",
                                                "Vais receber um email de confirmação."
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                "ui.thankyou.next_steps_panel",
                                                "Podes acompanhar a encomenda no teu painel."
                                            )}
                                        </li>
                                        <li>
                                            {isPickup
                                                ? t(
                                                    "ui.thankyou.no_shipping_required_short",
                                                    "Levantamento em loja, sem necessidade de envio físico."
                                                )
                                                : hasShipment
                                                    ? t(
                                                        "ui.thankyou.next_steps_shipping",
                                                        "Quando houver atualização de envio, será refletida no estado da encomenda."
                                                    )
                                                    : t(
                                                        "ui.thankyou.no_shipping_required_short",
                                                        "Levantamento em loja, sem necessidade de envio físico."
                                                    )}
                                        </li>
                                    </ul>
                                </InfoCard>

                                <InfoCard title={t("ui.thankyou.payment_status_title", "Payment status")}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {order?.payment ? paymentBadge(order.payment, t) : "—"}
                                    </div>
                                    {order?.payment?.method?.name ? (
                                        <div className="mt-2">
                                            {t("ui.thankyou.method", "Method")}:{" "}
                                            <span className="font-medium">
                                                {order.payment.method.name}
                                            </span>
                                        </div>
                                    ) : null}
                                </InfoCard>

                                <InfoCard title={t("ui.thankyou.shipping_status_title", "Shipping status")}>
                                    {hasShipment ? (
                                        <>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {shipmentBadge(order.shipment, t)}
                                            </div>

                                            {order?.shipment?.method?.name ? (
                                                <div className="mt-2">
                                                    {t("ui.thankyou.method", "Method")}:{" "}
                                                    <span className="font-medium">
                                                        {order.shipment.method.name}
                                                    </span>
                                                </div>
                                            ) : null}

                                            {order?.shipment?.tracking_number ? (
                                                <div className="mt-1">
                                                    {t("ui.thankyou.tracking_number", "Tracking")}:{" "}
                                                    <span className="font-medium">
                                                        {order.shipment.tracking_number}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </>
                                    ) : (
                                        <div>
                                            {t(
                                                "ui.thankyou.no_shipping_required_short",
                                                "Levantamento em loja, sem necessidade de envio físico."
                                            )}
                                        </div>
                                    )}
                                </InfoCard>
                            </div>

                            <InfoBox>
                                {t(
                                    "ui.checkout.tax_calculated_after_discount",
                                    "O IVA é calculado após aplicação dos descontos."
                                )}
                            </InfoBox>

                            <div className="space-y-3 border-t pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-lg font-semibold text-gray-900">
                                        {t("ui.thankyou.items", "Items")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {itemCount} {t("ui.checkout.items_count_label", "artigo(s)")}
                                    </div>
                                </div>

                                {orderItems.map((item) => {
                                    const productHref = item.slug
                                        ? route("shop.products.show", {
                                            locale,
                                            product: item.slug,
                                        })
                                        : null;

                                    const imageBlock = (
                                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                            {item.image?.url ? (
                                                <img
                                                    src={item.image.url}
                                                    alt={item.image.alt || item.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                                    IMG
                                                </div>
                                            )}
                                        </div>
                                    );

                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-start justify-between gap-4 rounded-xl border p-4"
                                        >
                                            <div className="flex min-w-0 flex-1 gap-4">
                                                {productHref ? (
                                                    <Link href={productHref} className="shrink-0">
                                                        {imageBlock}
                                                    </Link>
                                                ) : (
                                                    imageBlock
                                                )}

                                                <div className="min-w-0 text-sm">
                                                    {productHref ? (
                                                        <Link
                                                            href={productHref}
                                                            className="font-medium text-gray-900 hover:text-gray-700 hover:underline"
                                                        >
                                                            {item.name}
                                                        </Link>
                                                    ) : (
                                                        <div className="font-medium text-gray-900">
                                                            {item.name}
                                                        </div>
                                                    )}

                                                    <div className="text-gray-600">
                                                        SKU: {item.sku} · {t("ui.thankyou.qty", "Qty")}:{" "}
                                                        {item.qty}
                                                    </div>

                                                    <div className="text-gray-500">
                                                        {formatMoney(item.unit_amount, order.currency)} ×{" "}
                                                        {item.qty}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-sm font-semibold text-gray-900">
                                                {formatMoney(item.total_amount, order.currency)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-2 border-t pt-6 text-sm">
                                <div className="flex justify-between">
                                    <span>{t("ui.thankyou.subtotal", "Subtotal")}</span>
                                    <span>{formatMoney(order?.amounts?.subtotal, order.currency)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span>{t("ui.thankyou.shipping", "Shipping")}</span>
                                    <span>{formatMoney(order?.amounts?.shipping, order.currency)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span>{t("ui.thankyou.tax", "Tax")}</span>
                                    <span>{formatMoney(order?.amounts?.tax, order.currency)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span>{t("ui.thankyou.discount", "Discount")}</span>
                                    <span>- {formatMoney(order?.amounts?.discount, order.currency)}</span>
                                </div>

                                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                                    <span>{t("ui.thankyou.total", "Total")}</span>
                                    <span>{formatMoney(order?.amounts?.total, order.currency)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-2">
                                <div className="text-sm">
                                    <div className="font-semibold text-gray-900">
                                        {t("ui.thankyou.shipping_address", "Shipping")}
                                    </div>
                                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-700">
                                        {hasShipment
                                            ? formatAddress(order?.shipping_address)
                                            : t(
                                                "ui.thankyou.no_shipping_required_short",
                                                "Levantamento em loja, sem necessidade de envio físico."
                                            )}
                                    </pre>
                                </div>

                                <div className="text-sm">
                                    <div className="font-semibold text-gray-900">
                                        {t("ui.thankyou.billing_address", "Billing")}
                                    </div>
                                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-700">
                                        {formatAddress(order?.billing_address)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
