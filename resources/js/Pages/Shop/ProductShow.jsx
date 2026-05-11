import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function formatMoney(amount, currency) {
    if (amount === null || amount === undefined || !currency) return null;

    const dp = Number.isFinite(currency.decimal_places)
        ? currency.decimal_places
        : 2;

    const value = (Number(amount) / Math.pow(10, dp)).toFixed(dp);

    return `${value} ${currency.symbol ?? currency.code ?? ""}`.trim();
}

function formatDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString();
}

function Pill({ children, tone = "gray" }) {
    const tones = {
        gray: "bg-gray-100 text-gray-700",
        blue: "bg-blue-100 text-blue-700",
        green: "bg-green-100 text-green-700",
        yellow: "bg-yellow-100 text-yellow-800",
        red: "bg-red-100 text-red-700",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] ?? tones.gray
                }`}
        >
            {children}
        </span>
    );
}

function InfoBox({ children, tone = "gray" }) {
    const tones = {
        gray: "border-gray-200 bg-gray-50 text-gray-900",
        blue: "border-blue-200 bg-blue-50 text-blue-900",
        yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
        red: "border-red-200 bg-red-50 text-red-900",
    };

    return (
        <div className={`rounded-md border p-3 text-sm ${tones[tone] ?? tones.gray}`}>
            {children}
        </div>
    );
}

function StarRatingInput({ value, onChange }) {
    return (
        <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    className={`text-2xl transition ${star <= value ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"
                        }`}
                    aria-label={`Rate ${star}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

function ReviewCard({ review, t }) {
    return (
        <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="font-semibold text-gray-900">{review.user?.name ?? "User"}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                        <span>
                            {"★".repeat(review.rating)}
                            {"☆".repeat(5 - review.rating)}
                        </span>
                        <span>·</span>
                        <span>{formatDate(review.created_at)}</span>
                    </div>
                </div>

                {review.is_verified_purchase ? (
                    <Pill tone="green">
                        {t("ui.reviews.verified_purchase_badge", "Verified purchase")}
                    </Pill>
                ) : null}
            </div>

            {review.title ? (
                <div className="mt-3 text-base font-semibold text-gray-900">{review.title}</div>
            ) : null}

            {review.body ? (
                <div className="mt-2 whitespace-pre-line text-sm text-gray-700">{review.body}</div>
            ) : null}
        </div>
    );
}

function LinkifiedText({ text }) {
    if (!text) return null;

    const parts = String(text).split(/(https?:\/\/[^\s]+)/g);

    return (
        <>
            {parts.map((part, index) => {
                const isUrl = /^https?:\/\//i.test(part);

                if (!isUrl) {
                    return <span key={index}>{part}</span>;
                }

                return (
                    <a
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                    >
                        {part}
                    </a>
                );
            })}
        </>
    );
}

export default function ProductShow() {
    const {
        auth,
        locale,
        product,
        errors,
        is_in_wishlist,
        reviews,
        reviews_summary,
        can_review,
        my_review,
    } = usePage().props;

    const user = auth?.user ?? null;
    const { t } = useI18n();

    const images = Array.isArray(product?.images) ? product.images : [];
    const reviewsList = Array.isArray(reviews) ? reviews : [];
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const variantAttributes = Array.isArray(product?.variant_attributes)
        ? product.variant_attributes
        : [];

    const initialMainId = useMemo(() => {
        const id = product?.main_image_id;
        if (id) return id;
        return images[0]?.id ?? null;
    }, [product?.main_image_id, images]);

    const [activeImageId, setActiveImageId] = useState(initialMainId);
    const [qty, setQty] = useState(product?.allow_quantity === false ? 1 : 1);
    const [rating, setRating] = useState(my_review?.rating ?? 5);
    const [title, setTitle] = useState(my_review?.title ?? "");
    const [body, setBody] = useState(my_review?.body ?? "");

    const isVariable = product?.type === "variable";
    const isPhysical = product?.business_type === "physical";
    const isMembership = product?.business_type === "membership_fee";
    const isDigital = product?.business_type === "digital_service";
    const managesInventory = !!product?.manages_inventory;
    const allowQuantity = !!product?.allow_quantity;
    const maxPerOrder = product?.max_per_order;

    const activeImage = useMemo(() => {
        return images.find((x) => x.id === activeImageId) ?? images[0] ?? null;
    }, [images, activeImageId]);

    const defaultSelectedAttributes = useMemo(() => {
        const selectedVariantId = product?.selected_variant_id ?? null;
        const selectedVariant =
            variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null;

        if (!selectedVariant) return {};

        const result = {};

        (selectedVariant.values ?? []).forEach((row) => {
            if (row?.attribute_id && row?.attribute_value_id) {
                result[String(row.attribute_id)] = String(row.attribute_value_id);
            }
        });

        return result;
    }, [product?.selected_variant_id, variants]);

    const [selectedAttributes, setSelectedAttributes] = useState(defaultSelectedAttributes);

    useEffect(() => {
        setSelectedAttributes(defaultSelectedAttributes);
    }, [defaultSelectedAttributes]);

    const selectedVariant = useMemo(() => {
        if (!isVariable) return null;
        if (!variants.length) return null;

        return (
            variants.find((variant) => {
                const values = Array.isArray(variant.values) ? variant.values : [];

                if (values.length !== variantAttributes.length) {
                    return false;
                }

                return values.every((row) => {
                    const attributeId = String(row.attribute_id);
                    const valueId = String(row.attribute_value_id);

                    return selectedAttributes[attributeId] === valueId;
                });
            }) ?? null
        );
    }, [isVariable, variants, variantAttributes, selectedAttributes]);

    const currentPrice = useMemo(() => {
        if (isVariable) {
            return selectedVariant?.price ?? product?.price ?? null;
        }

        return product?.price ?? null;
    }, [isVariable, selectedVariant, product?.price]);

    const currentAvailableStock = useMemo(() => {
        if (isVariable) {
            return selectedVariant?.available_stock ?? null;
        }

        return product?.available_stock ?? null;
    }, [isVariable, selectedVariant, product?.available_stock]);

    const isSelectionComplete = useMemo(() => {
        if (!isVariable) return true;
        if (!variantAttributes.length) return false;

        return variantAttributes.every((attribute) => {
            return !!selectedAttributes[String(attribute.id)];
        });
    }, [isVariable, variantAttributes, selectedAttributes]);

    const isOutOfStock = useMemo(() => {
        if (!managesInventory) return false;

        const stock = Number(currentAvailableStock ?? 0);
        return stock <= 0;
    }, [managesInventory, currentAvailableStock]);

    const maxQty = useMemo(() => {
        if (!allowQuantity) return 1;

        const candidates = [];

        if (Number.isInteger(maxPerOrder) && maxPerOrder > 0) {
            candidates.push(maxPerOrder);
        }

        if (managesInventory && Number.isInteger(currentAvailableStock) && currentAvailableStock > 0) {
            candidates.push(currentAvailableStock);
        }

        if (candidates.length === 0) return null;

        return Math.min(...candidates);
    }, [allowQuantity, maxPerOrder, managesInventory, currentAvailableStock]);

    const normalizedQty = useMemo(() => {
        if (!allowQuantity) return 1;

        let value = Number(qty || 1);

        if (!Number.isFinite(value) || value < 1) value = 1;
        value = Math.floor(value);

        if (maxQty && value > maxQty) value = maxQty;

        return value;
    }, [qty, allowQuantity, maxQty]);

    const canAddToCart = useMemo(() => {
        if (!currentPrice) return false;
        if (isVariable && !selectedVariant) return false;
        if (isVariable && !isSelectionComplete) return false;
        if (isOutOfStock) return false;

        return true;
    }, [currentPrice, isVariable, selectedVariant, isSelectionComplete, isOutOfStock]);

    const optionIsAvailable = (attributeId, valueId) => {
        const attrId = String(attributeId);
        const valId = String(valueId);

        return variants.some((variant) => {
            if (!(variant?.is_active ?? false)) return false;

            if (managesInventory && Number(variant?.available_stock ?? 0) <= 0) {
                return false;
            }

            const values = Array.isArray(variant.values) ? variant.values : [];

            const hasCurrentValue = values.some(
                (row) =>
                    String(row.attribute_id) === attrId &&
                    String(row.attribute_value_id) === valId
            );

            if (!hasCurrentValue) return false;

            return variantAttributes.every((attribute) => {
                const currentAttributeId = String(attribute.id);

                if (currentAttributeId === attrId) return true;

                const selectedValueId = selectedAttributes[currentAttributeId];
                if (!selectedValueId) return true;

                return values.some(
                    (row) =>
                        String(row.attribute_id) === currentAttributeId &&
                        String(row.attribute_value_id) === String(selectedValueId)
                );
            });
        });
    };

    const handleAttributeChange = (attributeId, valueId) => {
        setSelectedAttributes((prev) => ({
            ...prev,
            [String(attributeId)]: valueId ? String(valueId) : "",
        }));
    };

    const addToCart = () => {
        if (!user) {
            router.visit(route("login", { locale }));
            return;
        }

        const payload = {
            qty: allowQuantity ? normalizedQty : 1,
        };

        if (isVariable) {
            if (!selectedVariant?.id) return;
            payload.variant_id = selectedVariant.id;
        } else {
            payload.product_id = product.id;
        }

        router.post(route("cart.items.store", { locale }), payload, {
            preserveScroll: true,
            onSuccess: () => {
                router.reload({ only: ["cart", "errors"] });
            },
        });
    };

    const toggleWishlist = () => {
        if (!user) {
            router.visit(route("login", { locale }));
            return;
        }

        router.post(
            route("wishlist.toggle", { locale, product: product.id }),
            {},
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
    };

    const submitReview = (e) => {
        e.preventDefault();

        router.post(
            route("shop.reviews.store", { locale, product: product.id }),
            {
                rating,
                title,
                body,
            },
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
    };

    const deleteReview = () => {
        router.delete(route("shop.reviews.destroy", { locale, product: product.id }), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const titleMeta = product?.meta_title || product?.name || "Product";
    const description =
        product?.meta_description ||
        product?.description ||
        "Produto disponível na Psique Inclusiva.";
    const ogImage = activeImage?.url || images[0]?.url || "/og-default.jpg";

    const pageHeader = (
        <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
                {product?.name}
            </h2>

            <div className="mt-1 text-sm text-gray-600">SKU: {product?.sku}</div>
        </div>
    );

    const pageHeaderActions = (
        <Link
            href={route("shop.index", { locale })}
            className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
            ← {t("ui.shop.back_to_shop", "Back to shop")}
        </Link>
    );

    return (
        <AuthenticatedLayout header={pageHeader} headerActions={pageHeaderActions}>
            <Head title={titleMeta}>
                <meta name="description" content={description} />
                <meta property="og:title" content={titleMeta} />
                <meta property="og:description" content={description} />
                <meta property="og:image" content={ogImage} />
                <meta property="og:type" content="product" />
                <meta name="twitter:title" content={titleMeta} />
                <meta name="twitter:description" content={description} />
                <meta name="twitter:image" content={ogImage} />
            </Head>

            <div className="py-6">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
                            <div className="space-y-3">
                                <div className="overflow-hidden rounded-xl border bg-gray-50">
                                    <div className="flex aspect-video items-center justify-center">
                                        {activeImage?.url ? (
                                            <img
                                                src={activeImage.url}
                                                alt={activeImage.alt ?? ""}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                                draggable={false}
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-500">—</div>
                                        )}
                                    </div>
                                </div>

                                {images.length > 1 ? (
                                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                                        {images.map((img) => {
                                            const active = img.id === activeImageId;

                                            return (
                                                <button
                                                    key={img.id}
                                                    type="button"
                                                    onClick={() => setActiveImageId(img.id)}
                                                    className={
                                                        "flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-gray-50 " +
                                                        (active ? "ring-2 ring-gray-900" : "hover:shadow-sm")
                                                    }
                                                    title={img.alt ?? ""}
                                                >
                                                    {img.url ? (
                                                        <img
                                                            src={img.url}
                                                            alt={img.alt ?? ""}
                                                            className="h-full w-full object-cover"
                                                            loading="lazy"
                                                            draggable={false}
                                                        />
                                                    ) : (
                                                        <div className="text-xs text-gray-500">—</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="text-sm text-gray-500">
                                        SKU: {selectedVariant?.sku ?? product?.sku}
                                    </div>

                                    <div className="text-2xl font-semibold text-gray-900">
                                        {product?.name}
                                    </div>

                                    {currentPrice ? (
                                        <div className="flex items-end gap-3">
                                            <div className="text-xl font-semibold text-gray-900">
                                                {formatMoney(currentPrice.amount, currentPrice.currency)}
                                            </div>

                                            {currentPrice.compare_at_amount ? (
                                                <div className="text-sm text-gray-500 line-through">
                                                    {formatMoney(
                                                        currentPrice.compare_at_amount,
                                                        currentPrice.currency
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-600">
                                            {t("ui.shop.price_unavailable", "Price unavailable")}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {isPhysical ? <Pill>{t("ui.shop.physical_product", "Produto físico")}</Pill> : null}
                                    {isMembership ? <Pill tone="blue">{t("ui.shop.membership", "Quota")}</Pill> : null}
                                    {isDigital ? <Pill tone="blue">{t("ui.shop.digital_service", "Serviço digital")}</Pill> : null}

                                    {product?.requires_shipping ? (
                                        <Pill tone="green">{t("ui.shop.requires_shipping", "Requer envio")}</Pill>
                                    ) : (
                                        <Pill tone="blue">{t("ui.shop.no_physical_shipping", "Sem envio físico")}</Pill>
                                    )}

                                    {managesInventory ? (
                                        <Pill tone={isOutOfStock ? "yellow" : "green"}>
                                            {isOutOfStock
                                                ? t("ui.shop.out_of_stock", "Sem stock")
                                                : `${t("ui.common.stock", "Stock")}: ${currentAvailableStock ?? 0}`}
                                        </Pill>
                                    ) : (
                                        <Pill tone="blue">{t("ui.shop.no_stock_control", "Sem controlo de stock")}</Pill>
                                    )}
                                </div>

                                {Array.isArray(product?.categories) && product.categories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {product.categories.map((c) => (
                                            <span
                                                key={c.id}
                                                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                                            >
                                                {c.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                {errors?.item ? <InfoBox tone="yellow">{errors.item}</InfoBox> : null}
                                {errors?.review ? <InfoBox tone="yellow">{errors.review}</InfoBox> : null}

                                {isVariable ? (
                                    <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {t("ui.shop.choose_options", "Escolha as opções")}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            {variantAttributes.map((attribute) => (
                                                <div key={attribute.id}>
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        {attribute.name}
                                                    </label>

                                                    <select
                                                        value={selectedAttributes[String(attribute.id)] ?? ""}
                                                        onChange={(e) =>
                                                            handleAttributeChange(attribute.id, e.target.value)
                                                        }
                                                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                    >
                                                        <option value="">
                                                            {t("ui.common.select", "Selecionar")}
                                                        </option>

                                                        {(attribute.values ?? []).map((value) => {
                                                            const available = optionIsAvailable(attribute.id, value.id);

                                                            return (
                                                                <option
                                                                    key={value.id}
                                                                    value={value.id}
                                                                    disabled={!available}
                                                                >
                                                                    {value.name}
                                                                    {!available ? ` — ${t("ui.common.unavailable", "indisponível")}` : ""}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>

                                        {!isSelectionComplete ? (
                                            <InfoBox tone="blue">
                                                {t(
                                                    "ui.shop.select_variant_options",
                                                    "Selecione todas as opções para ver a variante disponível."
                                                )}
                                            </InfoBox>
                                        ) : null}

                                        {isSelectionComplete && !selectedVariant ? (
                                            <InfoBox tone="yellow">
                                                {t(
                                                    "ui.shop.variant_combination_unavailable",
                                                    "Essa combinação não está disponível."
                                                )}
                                            </InfoBox>
                                        ) : null}
                                    </div>
                                ) : null}

                                {isMembership ? (
                                    <InfoBox tone="blue">
                                        {t(
                                            "ui.shop.membership_limit_one",
                                            "Esta quota fica limitada a 1 unidade por encomenda."
                                        )}
                                        {product?.business_detail?.membership_period_value &&
                                            product?.business_detail?.membership_period_unit ? (
                                            <>
                                                {" "}
                                                {t("ui.shop.period_label", "Período")}:{" "}
                                                {product.business_detail.membership_period_value}{" "}
                                                {product.business_detail.membership_period_unit === "year"
                                                    ? t("ui.common.year", "ano")
                                                    : t("ui.common.month", "mês")}
                                                .
                                            </>
                                        ) : null}
                                    </InfoBox>
                                ) : null}

                                {isDigital ? (
                                    <InfoBox tone="blue">
                                        {t(
                                            "ui.shop.digital_no_shipping",
                                            "Este serviço é digital e não requer envio físico."
                                        )}
                                        {product?.business_detail?.delivery_mode ? (
                                            <>
                                                {" "}
                                                {t("ui.shop.delivery_mode", "Entrega")}: {product.business_detail.delivery_mode}.
                                            </>
                                        ) : null}
                                    </InfoBox>
                                ) : null}

                                {isPhysical && managesInventory && !isOutOfStock ? (
                                    <InfoBox>
                                        {t("ui.shop.available_in_stock", "Disponível em stock")}:{" "}
                                        <strong>{currentAvailableStock ?? 0}</strong>.
                                    </InfoBox>
                                ) : null}

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={toggleWishlist}
                                        className={[
                                            "inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold transition",
                                            is_in_wishlist
                                                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                                : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                                        ].join(" ")}
                                    >
                                        <span className="mr-2">♥</span>
                                        {is_in_wishlist
                                            ? t("ui.wishlist.toggle_remove", "Remove from wishlist")
                                            : t("ui.wishlist.toggle_add", "Save")}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {allowQuantity ? (
                                        <div className="max-w-[140px]">
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.common.quantity", "Quantidade")}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max={maxQty ?? undefined}
                                                value={normalizedQty}
                                                onChange={(e) => setQty(e.target.value)}
                                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                            />
                                            {maxQty ? (
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {t("ui.shop.max_available", "Máximo disponível")}: {maxQty}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="max-w-[180px]">
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t("ui.common.quantity", "Quantidade")}
                                            </label>
                                            <input
                                                type="number"
                                                value="1"
                                                disabled
                                                className="mt-1 w-full rounded-md border-gray-300 bg-gray-50 text-gray-500 shadow-sm"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <button
                                            type="button"
                                            onClick={addToCart}
                                            disabled={!canAddToCart}
                                            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isOutOfStock
                                                ? t("ui.shop.out_of_stock", "Sem stock")
                                                : t("ui.shop.add_to_cart", "Add to cart")}
                                        </button>

                                        {!user ? (
                                            <div className="mt-2 text-sm text-gray-600">
                                                {t(
                                                    "ui.shop.guest_cart_note",
                                                    "As a guest, adding to cart will redirect you to login."
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {product?.description ? (
                                    <div className="prose max-w-none">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {t("ui.shop.description", "Description")}
                                        </div>
                                        <div className="whitespace-pre-line text-sm text-gray-700">
                                            <LinkifiedText text={product.description} />
                                        </div>
                                    </div>
                                ) : null}

                                {isDigital && product?.business_detail?.access_instructions ? (
                                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {t("ui.shop.access_instructions", "Instruções de acesso")}
                                        </div>
                                        <div className="mt-1 whitespace-pre-line text-sm text-gray-700">
                                            {product.business_detail.access_instructions}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 sm:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        {t("ui.reviews.title", "Reviews")}
                                    </div>
                                    <div className="mt-2 text-sm text-gray-600">
                                        {reviews_summary?.count ?? 0}{" "}
                                        {t("ui.reviews.total_reviews", "reviews")} ·{" "}
                                        {reviews_summary?.average_rating ?? "-"} / 5
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                {user ? (
                                    can_review ? (
                                        <form onSubmit={submitReview} className="rounded-xl border bg-gray-50 p-4">
                                            <div className="text-lg font-semibold text-gray-900">
                                                {my_review
                                                    ? t("ui.reviews.edit_review", "Edit your review")
                                                    : t("ui.reviews.leave_review", "Leave a review")}
                                            </div>

                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t("ui.reviews.rating", "Rating")}
                                                </label>
                                                <div className="mt-2">
                                                    <StarRatingInput value={rating} onChange={setRating} />
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t("ui.reviews.title_field", "Title")}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                    maxLength={160}
                                                />
                                            </div>

                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t("ui.reviews.body", "Comment")}
                                                </label>
                                                <textarea
                                                    value={body}
                                                    onChange={(e) => setBody(e.target.value)}
                                                    rows={5}
                                                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                />
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                                >
                                                    {t("ui.reviews.save", "Save review")}
                                                </button>

                                                {my_review ? (
                                                    <button
                                                        type="button"
                                                        onClick={deleteReview}
                                                        className="inline-flex items-center rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                                                    >
                                                        {t("ui.reviews.delete", "Delete review")}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </form>
                                    ) : (
                                        <InfoBox tone="blue">
                                            {t(
                                                "ui.reviews.verified_purchase_required",
                                                "Only customers with a delivered order for this product can leave a review."
                                            )}
                                        </InfoBox>
                                    )
                                ) : (
                                    <InfoBox tone="gray">
                                        {t("ui.reviews.login_required", "Log in to leave a review.")}
                                    </InfoBox>
                                )}
                            </div>

                            <div className="mt-6 space-y-4">
                                {reviewsList.length > 0 ? (
                                    reviewsList.map((review) => (
                                        <ReviewCard key={review.id} review={review} t={t} />
                                    ))
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
                                        {t("ui.reviews.empty", "There are no reviews for this product yet.")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
