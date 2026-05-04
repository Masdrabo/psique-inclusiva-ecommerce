import { Link, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function FieldError({ error }) {
    if (!error) return null;
    return <div className="mt-1 text-sm text-red-600">{error}</div>;
}

function TabButton({ active, onClick, children, tone = "default" }) {
    const toneClass =
        tone === "warning"
            ? active
                ? "bg-yellow-500 text-white"
                : "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
            : active
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200";

    return (
        <button
            type="button"
            onClick={onClick}
            className={
                "rounded-md px-3 py-2 text-sm font-medium transition " + toneClass
            }
        >
            {children}
        </button>
    );
}

function Pill({ tone = "gray", children }) {
    const map = {
        gray: "bg-gray-100 text-gray-700",
        blue: "bg-blue-100 text-blue-700",
        yellow: "bg-yellow-100 text-yellow-800",
        green: "bg-green-100 text-green-700",
    };

    return (
        <span
            className={
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                (map[tone] ?? map.gray)
            }
        >
            {children}
        </span>
    );
}

function Alert({ tone = "yellow", title, children }) {
    const map = {
        yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
        gray: "border-gray-200 bg-gray-50 text-gray-900",
        blue: "border-blue-200 bg-blue-50 text-blue-900",
        green: "border-green-200 bg-green-50 text-green-900",
        red: "border-red-200 bg-red-50 text-red-900",
    };

    return (
        <div className={"rounded-md border p-3 " + (map[tone] ?? map.yellow)}>
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {children ? <div className="mt-1 text-sm">{children}</div> : null}
        </div>
    );
}

function SectionTitle({ title, subtitle = null, action = null }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-sm font-semibold text-gray-900">{title}</div>
                {subtitle ? (
                    <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

function ChoiceCard({
    active,
    title,
    description,
    onClick,
    disabled = false,
}) {
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={
                "w-full rounded-lg border p-4 text-left transition " +
                (disabled
                    ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-80"
                    : active
                      ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50")
            }
        >
            <div className="text-sm font-semibold">{title}</div>
            <div
                className={
                    "mt-1 text-sm " +
                    (disabled
                        ? "text-gray-400"
                        : active
                          ? "text-gray-100"
                          : "text-gray-500")
                }
            >
                {description}
            </div>
        </button>
    );
}

function slugifyLocal(value) {
    if (!value) return "";
    return value
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getTrError(errors, tab, field) {
    if (!errors) return null;

    const flatKey = `translations.${tab}.${field}`;
    if (errors[flatKey]) return errors[flatKey];

    const nested = errors?.translations?.[tab]?.[field];
    if (nested) return nested;

    return null;
}

function getBusinessDetailError(errors, field) {
    if (!errors) return null;

    const flatKey = `business_detail.${field}`;
    if (errors[flatKey]) return errors[flatKey];

    const nested = errors?.business_detail?.[field];
    if (nested) return nested;

    return null;
}

function getVariantError(errors, index, field) {
    if (!errors) return null;

    const flatKey = `variants.${index}.${field}`;
    if (errors[flatKey]) return errors[flatKey];

    const nested = errors?.variants?.[index]?.[field];
    if (nested) return nested;

    return null;
}

function toDateTimeLocalValue(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (n) => String(n).padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromMinorToDecimalString(amount, decimalPlaces = 2) {
    if (amount == null || amount === "") return "";

    const negative = Number(amount) < 0;
    const raw = String(Math.abs(Number(amount))).padStart(decimalPlaces + 1, "0");
    const intPart = raw.slice(0, -decimalPlaces) || "0";
    const decPart = raw.slice(-decimalPlaces);

    return `${negative ? "-" : ""}${
        decimalPlaces > 0 ? `${intPart}.${decPart}` : intPart
    }`;
}

export default function ProductForm({
    mode,
    product = null,
    categories = [],
    attributes = [],
    currency = null,
    onSubmit,
}) {
    const { locale } = usePage().props;
    const { t } = useI18n();

    const [tab, setTab] = useState("pt");
    const [showAdvancedRules, setShowAdvancedRules] = useState(false);

    const ptTr =
        product?.translations?.find((x) => x.language?.code === "pt") ?? null;
    const enTr =
        product?.translations?.find((x) => x.language?.code === "en") ?? null;

    const initialSlug = product?.slug ?? "";
    const initialBusinessType = product?.business_type ?? "physical";
    const businessDetail =
        product?.business_detail ?? product?.businessDetail ?? null;

    const productHasExistingVariants =
        mode === "edit" &&
        Array.isArray(product?.variants) &&
        product.variants.length > 0;

    const getAttributeLabel = (attribute) => {
        return (
            attribute?.translations?.find((x) => x.language?.code === locale)?.name ??
            attribute?.translations?.find((x) => x.language?.code === "pt")?.name ??
            attribute?.translations?.find((x) => x.language?.code === "en")?.name ??
            attribute?.code ??
            `#${attribute?.id ?? ""}`
        );
    };

    const getAttributeValueLabel = (value) => {
        return (
            value?.translations?.find((x) => x.language?.code === locale)?.name ??
            value?.translations?.find((x) => x.language?.code === "pt")?.name ??
            value?.translations?.find((x) => x.language?.code === "en")?.name ??
            value?.code ??
            `#${value?.id ?? ""}`
        );
    };

    const attributeMap = useMemo(() => {
        const map = new Map();

        attributes.forEach((attribute) => {
            map.set(attribute.id, {
                ...attribute,
                _valuesById: new Map(
                    (attribute.values ?? []).map((value) => [Number(value.id), value])
                ),
            });
        });

        return map;
    }, [attributes]);

    const usedAttributeIdsFromProduct = useMemo(() => {
        if (!Array.isArray(product?.variants)) return [];

        const ids = new Set();

        product.variants.forEach((variant) => {
            (variant.values ?? []).forEach((row) => {
                if (row?.attribute_id != null) {
                    ids.add(Number(row.attribute_id));
                }
            });
        });

        return Array.from(ids);
    }, [product]);

    const [selectedVariantAttributeIds, setSelectedVariantAttributeIds] = useState(
        usedAttributeIdsFromProduct
    );

    const eurPrice = useMemo(() => {
        const price =
            product?.prices?.find(
                (p) => p.currency?.code === "EUR" && p.variant_id == null
            ) ?? null;

        if (!price) {
            return { price: "", compare_at_price: "" };
        }

        const dp = currency?.decimal_places ?? 2;

        return {
            price: fromMinorToDecimalString(price.amount, dp),
            compare_at_price: fromMinorToDecimalString(price.compare_at_amount, dp),
        };
    }, [product, currency]);

    const initialVariants = useMemo(() => {
        if (!Array.isArray(product?.variants)) {
            return [];
        }

        const dp = currency?.decimal_places ?? 2;

        return product.variants.map((variant) => {
            const eurVariantPrice =
                variant?.prices?.find((p) => p.currency?.code === "EUR") ?? null;

            const stockQty = Array.isArray(variant?.inventories)
                ? variant.inventories.reduce(
                      (sum, inv) =>
                          sum +
                          Math.max(
                              0,
                              Number(inv?.qty_on_hand ?? 0) -
                                  Number(inv?.qty_reserved ?? 0)
                          ),
                      0
                  )
                : 0;

            return {
                id: variant?.id ?? null,
                sku: variant?.sku ?? "",
                barcode: variant?.barcode ?? "",
                is_active:
                    typeof variant?.is_active === "boolean" ? variant.is_active : true,
                attribute_value_ids: Array.isArray(variant?.values)
                    ? variant.values
                          .map((row) => row?.attribute_value_id)
                          .filter((id) => id != null)
                          .map((id) => Number(id))
                    : [],
                price: eurVariantPrice
                    ? fromMinorToDecimalString(eurVariantPrice.amount, dp)
                    : "",
                compare_at_price: eurVariantPrice
                    ? fromMinorToDecimalString(eurVariantPrice.compare_at_amount, dp)
                    : "",
                stock_qty: stockQty,
            };
        });
    }, [product, currency]);

    const form = useForm({
        sku: product?.sku ?? "",
        slug: initialSlug,
        type: product?.type ?? "simple",
        business_type: initialBusinessType,
        is_active: product ? !!product.is_active : true,

        barcode: product?.barcode ?? "",
        weight_grams: product?.weight_grams ?? "",
        tax_rate:
            product?.tax_rate != null && product?.tax_rate !== ""
                ? String(product.tax_rate)
                : "23.00",
        price_includes_tax:
            typeof product?.price_includes_tax === "boolean"
                ? product.price_includes_tax
                : true,
        stock_qty: product?.stockQty ?? product?.available_stock ?? 0,

        requires_shipping:
            typeof product?.requires_shipping === "boolean"
                ? product.requires_shipping
                : initialBusinessType === "physical",
        manages_inventory:
            typeof product?.manages_inventory === "boolean"
                ? product.manages_inventory
                : initialBusinessType === "physical",
        allow_quantity:
            typeof product?.allow_quantity === "boolean"
                ? product.allow_quantity
                : initialBusinessType !== "membership_fee",
        requires_customer_notes: !!product?.requires_customer_notes,
        max_per_order: product?.max_per_order ?? "",
        available_from: toDateTimeLocalValue(product?.available_from),
        available_until: toDateTimeLocalValue(product?.available_until),

        categories: product?.categories?.map((c) => c.id) ?? [],
        price: eurPrice.price ?? "",
        compare_at_price: eurPrice.compare_at_price ?? "",
        images: [],

        variants: initialVariants,

        business_detail: {
            membership_period_unit: businessDetail?.membership_period_unit ?? "",
            membership_period_value: businessDetail?.membership_period_value ?? "",
            membership_renews_manually:
                typeof businessDetail?.membership_renews_manually === "boolean"
                    ? businessDetail.membership_renews_manually
                    : true,

            delivery_mode: businessDetail?.delivery_mode ?? "",
            service_kind: businessDetail?.service_kind ?? "",
            access_instructions: businessDetail?.access_instructions ?? "",

            capacity: businessDetail?.capacity ?? "",
            starts_at: toDateTimeLocalValue(businessDetail?.starts_at),
            ends_at: toDateTimeLocalValue(businessDetail?.ends_at),
            location: businessDetail?.location ?? "",
            meeting_url: businessDetail?.meeting_url ?? "",
        },

        translations: {
            pt: {
                name: ptTr?.name ?? "",
                description: ptTr?.description ?? "",
                meta_title: ptTr?.meta_title ?? "",
                meta_description: ptTr?.meta_description ?? "",
            },
            en: {
                name: enTr?.name ?? "",
                description: enTr?.description ?? "",
                meta_title: enTr?.meta_title ?? "",
                meta_description: enTr?.meta_description ?? "",
            },
        },
    });

    const ptName = form.data?.translations?.pt?.name ?? "";
    const autoSlugFromPT = useMemo(() => slugifyLocal(ptName), [ptName]);

    useEffect(() => {
        if (mode !== "create") return;
        if ((form.data.slug ?? "") !== autoSlugFromPT) {
            form.setData("slug", autoSlugFromPT);
        }
    }, [mode, autoSlugFromPT]); // eslint-disable-line react-hooks/exhaustive-deps

    const slugChanged =
        mode === "edit" &&
        (form.data.slug ?? "").trim() !== (initialSlug ?? "").trim();

    const selectedFiles = Array.isArray(form.data.images) ? form.data.images : [];

    const isPhysical = form.data.business_type === "physical";
    const isMembershipFee = form.data.business_type === "membership_fee";
    const isDigitalService = form.data.business_type === "digital_service";
    const isVariable = form.data.type === "variable";

    const setBusinessDetailField = (field, value) => {
        form.setData("business_detail", {
            ...form.data.business_detail,
            [field]: value,
        });
    };

    const setVariantField = (index, field, value) => {
        const next = [...(form.data.variants ?? [])];
        next[index] = {
            ...next[index],
            [field]: value,
        };
        form.setData("variants", next);
    };

    const getVariantValueForAttribute = (variant, attributeId) => {
        const valuesById = attributeMap.get(attributeId)?._valuesById;
        if (!valuesById) return "";

        const found = (variant.attribute_value_ids ?? []).find((valueId) =>
            valuesById.has(Number(valueId))
        );

        return found ? String(found) : "";
    };

    const setVariantAttributeValue = (index, attributeId, valueId) => {
        const next = [...(form.data.variants ?? [])];
        const variant = { ...next[index] };

        const valuesForAttribute = new Set(
            (attributeMap.get(attributeId)?.values ?? []).map((value) => Number(value.id))
        );

        const cleaned = (variant.attribute_value_ids ?? []).filter(
            (existingId) => !valuesForAttribute.has(Number(existingId))
        );

        variant.attribute_value_ids = valueId
            ? [...cleaned, Number(valueId)]
            : cleaned;

        next[index] = variant;
        form.setData("variants", next);
    };

    const addVariant = () => {
        form.setData("variants", [
            ...(form.data.variants ?? []),
            {
                id: null,
                sku: "",
                barcode: "",
                is_active: true,
                attribute_value_ids: [],
                price: "",
                compare_at_price: "",
                stock_qty: 0,
            },
        ]);
    };

    const removeVariant = (index) => {
        const next = [...(form.data.variants ?? [])];
        next.splice(index, 1);
        form.setData("variants", next);
    };

    const toggleVariantAttribute = (attributeId) => {
        const alreadySelected = selectedVariantAttributeIds.includes(attributeId);

        if (alreadySelected) {
            const nextSelected = selectedVariantAttributeIds.filter(
                (id) => id !== attributeId
            );
            setSelectedVariantAttributeIds(nextSelected);

            const valuesForAttribute = new Set(
                (attributeMap.get(attributeId)?.values ?? []).map((value) =>
                    Number(value.id)
                )
            );

            const nextVariants = (form.data.variants ?? []).map((variant) => ({
                ...variant,
                attribute_value_ids: (variant.attribute_value_ids ?? []).filter(
                    (valueId) => !valuesForAttribute.has(Number(valueId))
                ),
            }));

            form.setData("variants", nextVariants);
            return;
        }

        setSelectedVariantAttributeIds([
            ...selectedVariantAttributeIds,
            attributeId,
        ]);
    };

    const getVariantCombinationLabel = (variant) => {
        const labels = selectedVariantAttributeIds
            .map((attributeId) => {
                const valueId = getVariantValueForAttribute(variant, attributeId);
                if (!valueId) return null;

                const attribute = attributeMap.get(attributeId);
                const value = attribute?._valuesById?.get(Number(valueId));

                if (!attribute || !value) return null;

                return `${getAttributeLabel(attribute)}: ${getAttributeValueLabel(
                    value
                )}`;
            })
            .filter(Boolean);

        return labels.length > 0 ? labels.join(" · ") : "—";
    };

    const handleBusinessTypeChange = (value) => {
        form.setData("business_type", value);

        if (value === "physical") {
            form.setData("requires_shipping", true);
            form.setData("manages_inventory", true);
            form.setData("allow_quantity", true);
            form.setData("max_per_order", "");
        }

        if (value === "membership_fee") {
            form.setData("requires_shipping", false);
            form.setData("manages_inventory", false);
            form.setData("allow_quantity", false);
            form.setData("weight_grams", "");
            form.setData("stock_qty", 0);
            form.setData("max_per_order", 1);

            form.setData("business_detail", {
                ...form.data.business_detail,
                delivery_mode: "",
                service_kind: "",
                access_instructions: "",
            });
        }

        if (value === "digital_service") {
            form.setData("requires_shipping", false);
            form.setData("manages_inventory", false);
            form.setData("allow_quantity", true);
            form.setData("weight_grams", "");
            form.setData("stock_qty", 0);

            form.setData("business_detail", {
                ...form.data.business_detail,
                membership_period_unit: "",
                membership_period_value: "",
            });
        }
    };

    const submit = (e) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            sku: (data.sku ?? "").trim(),
            slug: (data.slug ?? "").trim(),
            barcode: isPhysical ? (data.barcode ?? "").trim() || null : null,
            weight_grams:
                isPhysical && data.weight_grams !== "" && data.weight_grams != null
                    ? Number(data.weight_grams)
                    : null,
            tax_rate:
                data.tax_rate === "" || data.tax_rate == null
                    ? null
                    : Number(String(data.tax_rate).replace(",", ".")),
            price_includes_tax: !!data.price_includes_tax,
            stock_qty:
                data.manages_inventory &&
                data.stock_qty !== "" &&
                data.stock_qty != null
                    ? Number(data.stock_qty)
                    : 0,
            max_per_order:
                data.max_per_order === "" || data.max_per_order == null
                    ? null
                    : Number(data.max_per_order),
            categories: Array.isArray(data.categories) ? data.categories : [],
            price: !isVariable ? String(data.price ?? "").trim() : null,
            compare_at_price: !isVariable
                ? String(data.compare_at_price ?? "").trim() || null
                : null,
            images: Array.isArray(data.images) ? data.images : [],
            variants: isVariable
                ? Array.isArray(data.variants)
                    ? data.variants.map((variant) => ({
                          id: variant?.id ?? null,
                          sku: String(variant?.sku ?? "").trim(),
                          barcode: String(variant?.barcode ?? "").trim() || null,
                          is_active: !!variant?.is_active,
                          attribute_value_ids: Array.isArray(
                              variant?.attribute_value_ids
                          )
                              ? variant.attribute_value_ids
                                    .filter((id) => id !== "" && id != null)
                                    .map((id) => Number(id))
                              : [],
                          price: String(variant?.price ?? "").trim(),
                          compare_at_price:
                              String(variant?.compare_at_price ?? "").trim() || null,
                          stock_qty:
                              variant?.stock_qty === "" || variant?.stock_qty == null
                                  ? 0
                                  : Number(variant.stock_qty),
                      }))
                    : []
                : [],
            business_detail: {
                membership_period_unit:
                    data.business_detail?.membership_period_unit || null,
                membership_period_value:
                    data.business_detail?.membership_period_value === "" ||
                    data.business_detail?.membership_period_value == null
                        ? null
                        : Number(data.business_detail.membership_period_value),
                membership_renews_manually:
                    !!data.business_detail?.membership_renews_manually,

                delivery_mode: data.business_detail?.delivery_mode || null,
                service_kind:
                    (data.business_detail?.service_kind ?? "").trim() || null,
                access_instructions:
                    (data.business_detail?.access_instructions ?? "").trim() || null,

                capacity:
                    data.business_detail?.capacity === "" ||
                    data.business_detail?.capacity == null
                        ? null
                        : Number(data.business_detail.capacity),
                starts_at: data.business_detail?.starts_at || null,
                ends_at: data.business_detail?.ends_at || null,
                location: (data.business_detail?.location ?? "").trim() || null,
                meeting_url:
                    (data.business_detail?.meeting_url ?? "").trim() || null,
            },
        }));

        onSubmit(form);
    };

    const tData = form.data.translations[tab];

    const setTrField = (field, value) => {
        form.setData("translations", {
            ...form.data.translations,
            [tab]: { ...form.data.translations[tab], [field]: value },
        });
    };

    const toggleCategory = (id) => {
        const set = new Set(form.data.categories ?? []);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        form.setData("categories", Array.from(set));
    };

    const regenerateSlugFromPT = () => {
        form.setData("slug", autoSlugFromPT);
    };

    const resetSlug = () => {
        form.setData("slug", initialSlug);
    };

    const ptHasErrors = [
        "name",
        "description",
        "meta_title",
        "meta_description",
    ].some((field) => !!getTrError(form.errors, "pt", field));

    const enHasErrors = [
        "name",
        "description",
        "meta_title",
        "meta_description",
    ].some((field) => !!getTrError(form.errors, "en", field));

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.manager.main_information", "Informação principal")}
                    subtitle={t(
                        "ui.manager.main_information_help",
                        "Define o conteúdo principal do produto e o URL."
                    )}
                />

                <div className="flex items-center gap-2">
                    <TabButton
                        active={tab === "pt"}
                        onClick={() => setTab("pt")}
                        tone={ptHasErrors ? "warning" : "default"}
                    >
                        {ptHasErrors ? "PT • !" : "PT"}
                    </TabButton>
                    <TabButton
                        active={tab === "en"}
                        onClick={() => setTab("en")}
                        tone={enHasErrors ? "warning" : "default"}
                    >
                        {enHasErrors ? "EN • !" : "EN"}
                    </TabButton>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.common.name", "Name")} ({tab.toUpperCase()})
                        </label>
                        <input
                            value={tData.name}
                            onChange={(e) => setTrField("name", e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError error={getTrError(form.errors, tab, "name")} />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.common.description", "Description")} ({tab.toUpperCase()})
                        </label>
                        <textarea
                            rows="4"
                            value={tData.description}
                            onChange={(e) => setTrField("description", e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError
                            error={getTrError(form.errors, tab, "description")}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div className="sm:col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.common.slug", "Slug")}
                        </label>

                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {mode === "create" ? (
                                <Pill tone="blue">
                                    {t("ui.manager.slug_auto", "Auto")}
                                </Pill>
                            ) : null}
                            {mode === "edit" && slugChanged ? (
                                <Pill tone="yellow">
                                    {t("ui.manager.slug_changed", "Changed")}
                                </Pill>
                            ) : null}
                        </div>

                        {mode === "create" ? (
                            <>
                                <input
                                    value={form.data.slug}
                                    readOnly
                                    className="mt-2 w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    {t(
                                        "ui.manager.slug_create_readonly_help_v2",
                                        "Gerado automaticamente a partir do nome em PT."
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <input
                                    value={form.data.slug}
                                    onChange={(e) => form.setData("slug", e.target.value)}
                                    className="mt-2 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    {t(
                                        "ui.manager.slug_edit_tip_v2",
                                        "Mantém o slug simples, em minúsculas e com hífens."
                                    )}
                                </div>
                            </>
                        )}

                        <FieldError error={form.errors.slug} />
                    </div>

                    {mode === "edit" ? (
                        <div className="sm:pt-7 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={regenerateSlugFromPT}
                                className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {t(
                                    "ui.manager.slug_regenerate",
                                    "Regenerate from Name (PT)"
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={resetSlug}
                                disabled={!slugChanged}
                                className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                {t("ui.manager.slug_reset", "Reset to original")}
                            </button>

                            <div className="text-xs text-gray-500">
                                {t("ui.manager.slug_original", "Original")}:{" "}
                                <span className="font-mono">{initialSlug || "—"}</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                {mode === "edit" ? (
                    <Alert
                        tone={slugChanged ? "yellow" : "gray"}
                        title={t(
                            "ui.manager.slug_warning_title_v2",
                            "Tem cuidado ao alterar o slug"
                        )}
                    >
                        {t(
                            "ui.manager.slug_warning_body_v2",
                            "Alterar o slug muda o URL do produto e pode quebrar links antigos. Se o mudares, idealmente cria um redirecionamento 301."
                        )}
                    </Alert>
                ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.manager.product_structure", "Estrutura do produto")}
                    subtitle={t(
                        "ui.manager.product_structure_help",
                        "Escolhe como o produto é organizado e qual a sua natureza."
                    )}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.product_structure_label", "Estrutura")}
                        </label>

                        <div className="grid grid-cols-1 gap-3">
                            <ChoiceCard
                                active={form.data.type === "simple"}
                                disabled={productHasExistingVariants}
                                onClick={() => {
                                    if (productHasExistingVariants) return;

                                    form.setData("type", "simple");
                                    form.setData("variants", []);
                                }}
                                title={t(
                                    "ui.manager.type_simple_title",
                                    "Produto simples"
                                )}
                                description={
                                    productHasExistingVariants
                                        ? t(
                                              "ui.manager.type_simple_locked_after_variants",
                                              "Este produto já tem variantes e já não pode voltar a simples."
                                          )
                                        : t(
                                              "ui.manager.type_simple_help",
                                              "Uma única versão, normalmente com um preço e um SKU."
                                          )
                                }
                            />

                            <ChoiceCard
                                active={form.data.type === "variable"}
                                onClick={() => form.setData("type", "variable")}
                                title={t(
                                    "ui.manager.type_variable_title",
                                    "Produto com variantes"
                                )}
                                description={t(
                                    "ui.manager.type_variable_help",
                                    "Usa várias opções como tamanho, cor ou capacidade."
                                )}
                            />
                        </div>

                        <FieldError error={form.errors.type} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.business_type_label", "Natureza do produto")}
                        </label>

                        <div className="grid grid-cols-1 gap-3">
                            <ChoiceCard
                                active={form.data.business_type === "physical"}
                                onClick={() => handleBusinessTypeChange("physical")}
                                title={t(
                                    "ui.manager.business_type_physical",
                                    "Produto físico"
                                )}
                                description={t(
                                    "ui.manager.business_type_physical_help",
                                    "Usa stock e normalmente requer envio."
                                )}
                            />

                            <ChoiceCard
                                active={form.data.business_type === "digital_service"}
                                onClick={() => handleBusinessTypeChange("digital_service")}
                                title={t(
                                    "ui.manager.business_type_digital",
                                    "Serviço digital"
                                )}
                                description={t(
                                    "ui.manager.business_type_digital_help",
                                    "Não usa envio físico e pode incluir acesso digital."
                                )}
                            />

                            <ChoiceCard
                                active={form.data.business_type === "membership_fee"}
                                onClick={() => handleBusinessTypeChange("membership_fee")}
                                title={t("ui.manager.business_type_membership", "Quota")}
                                description={t(
                                    "ui.manager.business_type_membership_help",
                                    "Ideal para quotas, mensalidades ou adesões."
                                )}
                            />
                        </div>

                        <FieldError error={form.errors.business_type} />
                    </div>
                </div>

                {productHasExistingVariants ? (
                    <Alert
                        tone="yellow"
                        title={t(
                            "ui.manager.variable_type_locked_title",
                            "Tipo bloqueado"
                        )}
                    >
                        {t(
                            "ui.manager.variable_type_locked_body",
                            "Este produto já foi configurado com variantes. A partir deste ponto mantém-se como produto com variantes."
                        )}
                    </Alert>
                ) : null}

                {isVariable ? (
                    <Alert
                        tone="yellow"
                        title={t(
                            "ui.manager.variable_notice_title",
                            "Produto com variantes"
                        )}
                    >
                        {t(
                            "ui.manager.variable_notice_body",
                            "Este produto está marcado como variável. Garante que a gestão de variantes, preços e stock por variante será tratada na etapa seguinte do teu backoffice."
                        )}
                    </Alert>
                ) : null}

                {isPhysical ? (
                    <Alert
                        tone="gray"
                        title={t("ui.manager.physical_product_title", "Produto físico")}
                    >
                        {t(
                            "ui.manager.physical_product_help",
                            "Este produto usa stock e requer envio."
                        )}
                    </Alert>
                ) : null}

                {isMembershipFee ? (
                    <Alert
                        tone="blue"
                        title={t("ui.manager.membership_title", "Quota")}
                    >
                        {t(
                            "ui.manager.membership_help",
                            "A quota não usa stock nem envio e fica limitada a 1 unidade por encomenda."
                        )}
                    </Alert>
                ) : null}

                {isDigitalService ? (
                    <Alert
                        tone="blue"
                        title={t("ui.manager.digital_service_title", "Serviço digital")}
                    >
                        {t(
                            "ui.manager.digital_service_help",
                            "O serviço digital não usa stock nem envio."
                        )}
                    </Alert>
                ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.manager.sales_and_status", "Preço e estado")}
                    subtitle={t(
                        "ui.manager.sales_and_status_help",
                        "Define preço, SKU e visibilidade do produto."
                    )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">SKU</label>
                        <input
                            value={form.data.sku}
                            onChange={(e) => form.setData("sku", e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError error={form.errors.sku} />
                    </div>

                    {!isVariable ? (
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.common.price", "Price")}{" "}
                                {currency?.code ? `(${currency.code})` : "(EUR)"}
                            </label>
                            <input
                                inputMode="decimal"
                                value={form.data.price}
                                onChange={(e) => form.setData("price", e.target.value)}
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                placeholder="19.99"
                            />
                            <FieldError error={form.errors.price} />
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                            {t(
                                "ui.manager.variable_parent_price_not_used",
                                "O preço do produto pai não é usado em produtos com variantes."
                            )}
                        </div>
                    )}

                    {!isVariable ? (
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.manager.original_price", "Preço original")}
                            </label>
                            <input
                                inputMode="decimal"
                                value={form.data.compare_at_price}
                                onChange={(e) =>
                                    form.setData("compare_at_price", e.target.value)
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                placeholder="29.99"
                            />
                            <div className="mt-1 text-xs text-gray-500">
                                {t(
                                    "ui.manager.original_price_help",
                                    "Opcional. Útil para mostrar desconto ou preço riscado."
                                )}
                            </div>
                            <FieldError error={form.errors.compare_at_price} />
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                            {t(
                                "ui.manager.variable_parent_compare_at_price_not_used",
                                "O preço anterior do produto pai não é usado em produtos com variantes."
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.tax_rate", "IVA (%)")}
                        </label>
                        <input
                            inputMode="decimal"
                            value={form.data.tax_rate}
                            onChange={(e) => form.setData("tax_rate", e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            placeholder="23.00"
                        />
                        <div className="mt-1 text-xs text-gray-500">
                            {t(
                                "ui.manager.tax_rate_help",
                                "Exemplo: 23 para taxa normal, 6 para reduzida."
                            )}
                        </div>
                        <FieldError error={form.errors.tax_rate} />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                        <input
                            id="is_active"
                            type="checkbox"
                            checked={!!form.data.is_active}
                            onChange={(e) => form.setData("is_active", e.target.checked)}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <label
                            htmlFor="is_active"
                            className="text-sm font-medium text-gray-700"
                        >
                            {t("ui.common.active", "Active")}
                        </label>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                        <input
                            id="price_includes_tax"
                            type="checkbox"
                            checked={!!form.data.price_includes_tax}
                            onChange={(e) =>
                                form.setData("price_includes_tax", e.target.checked)
                            }
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <label
                            htmlFor="price_includes_tax"
                            className="text-sm font-medium text-gray-700"
                        >
                            {t("ui.manager.price_includes_tax", "Preço já inclui IVA")}
                        </label>
                    </div>
                </div>
            </div>

            {isVariable ? (
                <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <SectionTitle
                        title={t("ui.manager.variants", "Variantes")}
                        subtitle={t(
                            "ui.manager.variable_notice_body",
                            "Este produto está marcado como variável. Garante que a gestão de variantes, preços e stock por variante será tratada na etapa seguinte do teu backoffice."
                        )}
                        action={
                            <button
                                type="button"
                                onClick={addVariant}
                                className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                + {t("ui.manager.variants", "Variantes")}
                            </button>
                        }
                    />

                    <div className="rounded-md border border-dashed border-gray-300 p-4 space-y-3">
                        <div className="text-sm font-semibold text-gray-900">
                            {t(
                                "ui.manager.variant_attributes",
                                "Atributos usados nas variantes"
                            )}
                        </div>

                        {attributes.length === 0 ? (
                            <div className="text-sm text-gray-500">
                                {t(
                                    "ui.manager.variant_attributes_empty",
                                    "Ainda não existem atributos ativos disponíveis."
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {attributes.map((attribute) => {
                                    const checked =
                                        selectedVariantAttributeIds.includes(attribute.id);

                                    return (
                                        <label
                                            key={attribute.id}
                                            className="flex items-start gap-2 rounded-md border p-2 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    toggleVariantAttribute(attribute.id)
                                                }
                                                className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-gray-800">
                                                    {getAttributeLabel(attribute)}
                                                </span>
                                                <span className="block truncate text-xs text-gray-500">
                                                    {attribute.code}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <FieldError error={form.errors.variants} />

                    {(form.data.variants ?? []).length === 0 ? (
                        <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                            {t(
                                "ui.manager.variable_requires_variants",
                                "Um produto com variantes tem de incluir pelo menos uma variante."
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(form.data.variants ?? []).map((variant, index) => (
                                <div
                                    key={variant.id ?? `new-${index}`}
                                    className="rounded-lg border border-gray-200 p-4 space-y-4"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">
                                                {t("ui.manager.variants", "Variantes")} #
                                                {index + 1}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {getVariantCombinationLabel(variant)}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeVariant(index)}
                                            className="rounded-md border px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                                        >
                                            {t("ui.common.delete", "Eliminar")}
                                        </button>
                                    </div>

                                    {selectedVariantAttributeIds.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {selectedVariantAttributeIds.map((attributeId) => {
                                                const attribute = attributeMap.get(attributeId);
                                                if (!attribute) return null;

                                                return (
                                                    <div key={attributeId}>
                                                        <label className="text-sm font-medium text-gray-700">
                                                            {getAttributeLabel(attribute)}
                                                        </label>

                                                        <select
                                                            value={getVariantValueForAttribute(
                                                                variant,
                                                                attributeId
                                                            )}
                                                            onChange={(e) =>
                                                                setVariantAttributeValue(
                                                                    index,
                                                                    attributeId,
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                        >
                                                            <option value="">
                                                                {t(
                                                                    "ui.common.select",
                                                                    "Selecionar"
                                                                )}
                                                            </option>

                                                            {(attribute.values ?? []).map(
                                                                (value) => (
                                                                    <option
                                                                        key={value.id}
                                                                        value={value.id}
                                                                    >
                                                                        {getAttributeValueLabel(
                                                                            value
                                                                        )}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                                            {t(
                                                "ui.manager.variant_select_attributes_first",
                                                "Seleciona primeiro os atributos usados nas variantes."
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">
                                                {t(
                                                    "ui.manager.variant_sku",
                                                    "SKU da variante"
                                                )}
                                            </label>
                                            <input
                                                value={variant.sku ?? ""}
                                                onChange={(e) =>
                                                    setVariantField(
                                                        index,
                                                        "sku",
                                                        e.target.value
                                                    )
                                                }
                                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                            />
                                            <FieldError
                                                error={getVariantError(
                                                    form.errors,
                                                    index,
                                                    "sku"
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700">
                                                {t("ui.common.barcode", "Barcode")}
                                            </label>
                                            <input
                                                value={variant.barcode ?? ""}
                                                onChange={(e) =>
                                                    setVariantField(
                                                        index,
                                                        "barcode",
                                                        e.target.value
                                                    )
                                                }
                                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                            />
                                            <FieldError
                                                error={getVariantError(
                                                    form.errors,
                                                    index,
                                                    "barcode"
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700">
                                                {t("ui.common.price", "Price")}{" "}
                                                {currency?.code
                                                    ? `(${currency.code})`
                                                    : "(EUR)"}
                                            </label>
                                            <input
                                                inputMode="decimal"
                                                value={variant.price ?? ""}
                                                onChange={(e) =>
                                                    setVariantField(
                                                        index,
                                                        "price",
                                                        e.target.value
                                                    )
                                                }
                                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                placeholder="19.99"
                                            />
                                            <FieldError
                                                error={getVariantError(
                                                    form.errors,
                                                    index,
                                                    "price"
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700">
                                                {t(
                                                    "ui.manager.original_price",
                                                    "Preço original"
                                                )}
                                            </label>
                                            <input
                                                inputMode="decimal"
                                                value={variant.compare_at_price ?? ""}
                                                onChange={(e) =>
                                                    setVariantField(
                                                        index,
                                                        "compare_at_price",
                                                        e.target.value
                                                    )
                                                }
                                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                placeholder="29.99"
                                            />
                                            <FieldError
                                                error={getVariantError(
                                                    form.errors,
                                                    index,
                                                    "compare_at_price"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2 pt-6">
                                            <input
                                                id={`variant-is-active-${index}`}
                                                type="checkbox"
                                                checked={!!variant.is_active}
                                                onChange={(e) =>
                                                    setVariantField(
                                                        index,
                                                        "is_active",
                                                        e.target.checked
                                                    )
                                                }
                                                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                            />
                                            <label
                                                htmlFor={`variant-is-active-${index}`}
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                {t("ui.common.active", "Active")}
                                            </label>
                                        </div>

                                        {isPhysical ? (
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">
                                                    {t("ui.common.stock", "Stock")}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={variant.stock_qty ?? 0}
                                                    onChange={(e) =>
                                                        setVariantField(
                                                            index,
                                                            "stock_qty",
                                                            e.target.value
                                                        )
                                                    }
                                                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                                />
                                                <FieldError
                                                    error={getVariantError(
                                                        form.errors,
                                                        index,
                                                        "stock_qty"
                                                    )}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}

            {isPhysical ? (
                <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <SectionTitle
                        title={t("ui.manager.physical_data", "Dados físicos")}
                        subtitle={t(
                            "ui.manager.physical_data_help",
                            "Informação usada para stock, envio e identificação do produto."
                        )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.common.barcode", "Barcode")}
                            </label>
                            <input
                                value={form.data.barcode ?? ""}
                                onChange={(e) =>
                                    form.setData("barcode", e.target.value)
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            />
                            <FieldError error={form.errors.barcode} />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.common.weight_grams", "Weight (g)")}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={form.data.weight_grams ?? ""}
                                onChange={(e) =>
                                    form.setData("weight_grams", e.target.value)
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            />
                            <FieldError error={form.errors.weight_grams} />
                        </div>

                        {!isVariable ? (
                            <div>
                                <label className="text-sm font-medium text-gray-700">
                                    {t("ui.common.stock", "Stock")}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.data.stock_qty ?? 0}
                                    onChange={(e) =>
                                        form.setData("stock_qty", e.target.value)
                                    }
                                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                />
                                <FieldError error={form.errors.stock_qty} />
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                                {t(
                                    "ui.manager.variable_parent_stock_not_used",
                                    "O stock do produto pai não é usado em produtos com variantes."
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {isMembershipFee ? (
                <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <SectionTitle
                        title={t(
                            "ui.manager.membership_configuration",
                            "Configuração da quota"
                        )}
                        subtitle={t(
                            "ui.manager.membership_configuration_help",
                            "Define a periodicidade e a renovação da quota."
                        )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t(
                                    "ui.manager.membership_period_unit",
                                    "Unidade do período"
                                )}
                            </label>
                            <select
                                value={form.data.business_detail.membership_period_unit}
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "membership_period_unit",
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            >
                                <option value="">
                                    {t("ui.common.select", "Selecionar")}
                                </option>
                                <option value="month">
                                    {t("ui.common.month", "Mês")}
                                </option>
                                <option value="year">
                                    {t("ui.common.year", "Ano")}
                                </option>
                            </select>
                            <FieldError
                                error={getBusinessDetailError(
                                    form.errors,
                                    "membership_period_unit"
                                )}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t(
                                    "ui.manager.membership_period_value",
                                    "Valor do período"
                                )}
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={form.data.business_detail.membership_period_value}
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "membership_period_value",
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                placeholder="1"
                            />
                            <FieldError
                                error={getBusinessDetailError(
                                    form.errors,
                                    "membership_period_value"
                                )}
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-6">
                            <input
                                id="membership_renews_manually"
                                type="checkbox"
                                checked={
                                    !!form.data.business_detail
                                        .membership_renews_manually
                                }
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "membership_renews_manually",
                                        e.target.checked
                                    )
                                }
                                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <label
                                htmlFor="membership_renews_manually"
                                className="text-sm font-medium text-gray-700"
                            >
                                {t(
                                    "ui.manager.membership_renews_manually",
                                    "Renovação manual"
                                )}
                            </label>
                        </div>
                    </div>
                </div>
            ) : null}

            {isDigitalService ? (
                <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <SectionTitle
                        title={t("ui.manager.digital_delivery", "Entrega digital")}
                        subtitle={t(
                            "ui.manager.digital_delivery_help",
                            "Configura a forma de acesso ou entrega do serviço digital."
                        )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.manager.delivery_mode", "Modo de entrega")}
                            </label>
                            <select
                                value={form.data.business_detail.delivery_mode}
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "delivery_mode",
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            >
                                <option value="">
                                    {t("ui.common.select", "Selecionar")}
                                </option>
                                <option value="email">
                                    {t("ui.common.email", "Email")}
                                </option>
                                <option value="url">URL</option>
                                <option value="manual">
                                    {t("ui.common.manual", "Manual")}
                                </option>
                                <option value="none">
                                    {t(
                                        "ui.manager.no_automatic_delivery",
                                        "Sem entrega automática"
                                    )}
                                </option>
                            </select>
                            <FieldError
                                error={getBusinessDetailError(
                                    form.errors,
                                    "delivery_mode"
                                )}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                {t("ui.manager.service_kind_label", "Tipo de serviço")}
                            </label>
                            <input
                                value={form.data.business_detail.service_kind}
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "service_kind",
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                placeholder={t(
                                    "ui.manager.service_kind_placeholder",
                                    "ex.: consultoria, acesso, download"
                                )}
                            />
                            <FieldError
                                error={getBusinessDetailError(
                                    form.errors,
                                    "service_kind"
                                )}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700">
                                {t(
                                    "ui.manager.access_instructions",
                                    "Instruções de acesso"
                                )}
                            </label>
                            <textarea
                                rows="4"
                                value={form.data.business_detail.access_instructions}
                                onChange={(e) =>
                                    setBusinessDetailField(
                                        "access_instructions",
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                            />
                            <FieldError
                                error={getBusinessDetailError(
                                    form.errors,
                                    "access_instructions"
                                )}
                            />
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.manager.sale_rules", "Regras de venda")}
                    subtitle={t(
                        "ui.manager.sale_rules_help_v2",
                        "Controla limites de compra, notas do cliente e janelas de disponibilidade."
                    )}
                    action={
                        <button
                            type="button"
                            onClick={() => setShowAdvancedRules((v) => !v)}
                            className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            {showAdvancedRules
                                ? t(
                                      "ui.manager.hide_advanced_options",
                                      "Ocultar opções avançadas"
                                  )
                                : t(
                                      "ui.manager.show_advanced_options",
                                      "Mostrar opções avançadas"
                                  )}
                        </button>
                    }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.max_per_order", "Máximo por encomenda")}
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={form.data.max_per_order ?? ""}
                            onChange={(e) =>
                                form.setData("max_per_order", e.target.value)
                            }
                            disabled={isMembershipFee}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 disabled:bg-gray-50"
                            placeholder={
                                isMembershipFee
                                    ? "1"
                                    : t("ui.manager.no_limit", "Sem limite")
                            }
                        />
                        <FieldError error={form.errors.max_per_order} />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                        <input
                            id="requires_customer_notes"
                            type="checkbox"
                            checked={!!form.data.requires_customer_notes}
                            onChange={(e) =>
                                form.setData(
                                    "requires_customer_notes",
                                    e.target.checked
                                )
                            }
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <label
                            htmlFor="requires_customer_notes"
                            className="text-sm font-medium text-gray-700"
                        >
                            {t(
                                "ui.manager.requires_customer_notes",
                                "Pedir notas do cliente"
                            )}
                        </label>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.available_from", "Disponível desde")}
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.available_from ?? ""}
                            onChange={(e) =>
                                form.setData("available_from", e.target.value)
                            }
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError error={form.errors.available_from} />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.manager.available_until", "Disponível até")}
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.available_until ?? ""}
                            onChange={(e) =>
                                form.setData("available_until", e.target.value)
                            }
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError error={form.errors.available_until} />
                    </div>
                </div>

                {showAdvancedRules ? (
                    <div className="rounded-md border border-dashed border-gray-300 p-4 space-y-4">
                        <div className="text-sm font-semibold text-gray-900">
                            {t("ui.manager.advanced_rules", "Opções avançadas")}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="requires_shipping"
                                    type="checkbox"
                                    checked={!!form.data.requires_shipping}
                                    onChange={(e) =>
                                        form.setData(
                                            "requires_shipping",
                                            e.target.checked
                                        )
                                    }
                                    disabled={isPhysical}
                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-50"
                                />
                                <label
                                    htmlFor="requires_shipping"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    {t("ui.manager.requires_shipping", "Requer envio")}
                                </label>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="manages_inventory"
                                    type="checkbox"
                                    checked={!!form.data.manages_inventory}
                                    onChange={(e) =>
                                        form.setData(
                                            "manages_inventory",
                                            e.target.checked
                                        )
                                    }
                                    disabled={isPhysical}
                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-50"
                                />
                                <label
                                    htmlFor="manages_inventory"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    {t("ui.manager.manages_inventory", "Gere stock")}
                                </label>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="allow_quantity"
                                    type="checkbox"
                                    checked={!!form.data.allow_quantity}
                                    onChange={(e) =>
                                        form.setData(
                                            "allow_quantity",
                                            e.target.checked
                                        )
                                    }
                                    disabled={isMembershipFee}
                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-50"
                                />
                                <label
                                    htmlFor="allow_quantity"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    {t(
                                        "ui.manager.allow_quantity_v2",
                                        "Permitir várias unidades"
                                    )}
                                </label>
                            </div>
                        </div>

                        <FieldError error={form.errors.requires_shipping} />
                        <FieldError error={form.errors.manages_inventory} />
                        <FieldError error={form.errors.allow_quantity} />
                        <FieldError error={form.errors.requires_customer_notes} />
                    </div>
                ) : null}
            </div>

            {mode === "create" ? (
                <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <SectionTitle
                        title={t(
                            "ui.manager.product_images_label",
                            "Imagens do produto"
                        )}
                        subtitle={t(
                            "ui.manager.product_images_help_v2",
                            "Podes enviar até 10 imagens. A primeira será a imagem principal."
                        )}
                    />

                    <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) =>
                            form.setData("images", Array.from(e.target.files ?? []))
                        }
                        className="block w-full text-sm text-gray-700"
                    />

                    {selectedFiles.length > 0 ? (
                        <div className="rounded-md bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-2">
                                {t("ui.common.selected_files", "Selected files")}
                            </div>

                            <ul className="space-y-2 text-sm text-gray-700">
                                {selectedFiles.map((file, index) => (
                                    <li
                                        key={`${file.name}-${index}`}
                                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">
                                                {file.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {index === 0
                                                    ? t(
                                                          "ui.manager.main_image",
                                                          "Imagem principal"
                                                      )
                                                    : t(
                                                          "ui.manager.additional_image",
                                                          "Imagem adicional"
                                                      )}
                                            </div>
                                        </div>
                                        <Pill tone={index === 0 ? "green" : "gray"}>
                                            #{index + 1}
                                        </Pill>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <FieldError error={form.errors.images} />
                    <FieldError error={form.errors["images.0"]} />
                </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.common.categories", "Categories")}
                    subtitle={t(
                        "ui.manager.categories_help",
                        "Escolhe as categorias em que este produto deve aparecer."
                    )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {categories.map((c) => {
                        const checked = (form.data.categories ?? []).includes(c.id);
                        const categoryName =
                            c?.translations?.find((x) => x.language?.code === locale)
                                ?.name ??
                            c?.translations?.find((x) => x.language?.code === "pt")
                                ?.name ??
                            c?.translations?.find((x) => x.language?.code === "en")
                                ?.name ??
                            c?.name ??
                            c?.slug;

                        return (
                            <label
                                key={c.id}
                                className="flex items-start gap-2 rounded-md border p-2 hover:bg-gray-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCategory(c.id)}
                                    className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-800">
                                        {categoryName}
                                    </span>
                                    {c.slug ? (
                                        <span className="block truncate text-xs text-gray-500">
                                            {c.slug}
                                        </span>
                                    ) : null}
                                </span>
                            </label>
                        );
                    })}
                </div>

                <FieldError error={form.errors.categories} />
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <SectionTitle
                    title={t("ui.manager.seo", "SEO")}
                    subtitle={t(
                        "ui.manager.seo_help_v2",
                        "Opcional, mas útil para motores de pesquisa e partilhas."
                    )}
                />

                <div className="flex items-center gap-2">
                    <TabButton
                        active={tab === "pt"}
                        onClick={() => setTab("pt")}
                        tone={ptHasErrors ? "warning" : "default"}
                    >
                        {ptHasErrors ? "PT • !" : "PT"}
                    </TabButton>
                    <TabButton
                        active={tab === "en"}
                        onClick={() => setTab("en")}
                        tone={enHasErrors ? "warning" : "default"}
                    >
                        {enHasErrors ? "EN • !" : "EN"}
                    </TabButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.common.meta_title", "Meta title")} ({tab.toUpperCase()})
                        </label>
                        <input
                            value={tData.meta_title}
                            onChange={(e) => setTrField("meta_title", e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError
                            error={getTrError(form.errors, tab, "meta_title")}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {t("ui.common.meta_description", "Meta description")} (
                            {tab.toUpperCase()})
                        </label>
                        <input
                            value={tData.meta_description}
                            onChange={(e) =>
                                setTrField("meta_description", e.target.value)
                            }
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                        />
                        <FieldError
                            error={getTrError(form.errors, tab, "meta_description")}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Link
                    href={route("manager.products.index", { locale })}
                    className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
                >
                    {t("ui.common.cancel", "Cancel")}
                </Link>

                <button
                    type="submit"
                    disabled={form.processing}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                    {form.processing
                        ? t("ui.common.saving", "Saving…")
                        : mode === "edit"
                          ? t("ui.common.save_changes", "Save changes")
                          : t("ui.common.save", "Save")}
                </button>
            </div>
        </form>
    );
}
