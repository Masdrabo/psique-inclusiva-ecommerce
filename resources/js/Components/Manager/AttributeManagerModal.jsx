import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

function TextInput(props) {
    return (
        <input
            {...props}
            className={[
                "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm",
                "focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900",
                props.className ?? "",
            ].join(" ")}
        />
    );
}

function SmallButton({
    children,
    onClick,
    type = "button",
    tone = "default",
    disabled = false,
    className = "",
}) {
    const styles = {
        default: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
        primary: "border border-gray-900 bg-gray-900 text-white hover:bg-gray-800",
        danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        soft: "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={[
                "rounded-md px-3 py-2 text-sm font-medium transition",
                "disabled:cursor-not-allowed disabled:opacity-50",
                styles[tone] ?? styles.default,
                className,
            ].join(" ")}
        >
            {children}
        </button>
    );
}

function normalizeAttribute(attribute) {
    return {
        id: attribute?.id ?? null,
        code: attribute?.code ?? "",
        is_active: !!attribute?.is_active,
        translations: Array.isArray(attribute?.translations) ? attribute.translations : [],
        values: Array.isArray(attribute?.values) ? attribute.values : [],
        values_count: Number(attribute?.values_count ?? attribute?.values?.length ?? 0),
    };
}

function normalizeValue(value) {
    return {
        id: value?.id ?? null,
        attribute_id: value?.attribute_id ?? null,
        code: value?.code ?? "",
        translations: Array.isArray(value?.translations) ? value.translations : [],
    };
}

function getTranslationName(translations, code) {
    const tr = (translations ?? []).find(
        (row) => row?.language_code === code || row?.language?.code === code
    );

    return tr?.name ?? "";
}

function getAttributeLabel(attribute, locale) {
    const translations = attribute?.translations ?? [];

    return (
        getTranslationName(translations, locale) ||
        getTranslationName(translations, "pt") ||
        getTranslationName(translations, "en") ||
        attribute?.code ||
        "—"
    );
}

function getValueLabel(value, locale) {
    const translations = value?.translations ?? [];

    return (
        getTranslationName(translations, locale) ||
        getTranslationName(translations, "pt") ||
        getTranslationName(translations, "en") ||
        value?.code ||
        "—"
    );
}

function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta?.content) return meta.content;

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (!match) return "";

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

async function sendJson(url, method, body = null) {
    const csrfToken = getCsrfToken();

    const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRF-TOKEN": csrfToken,
        },
        body: body ? JSON.stringify(body) : null,
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const validationErrors = data?.errors ?? {};
        const firstValidationMessage =
            validationErrors?.code?.[0] ||
            validationErrors?.["translations.pt.name"]?.[0] ||
            validationErrors?.["translations.en.name"]?.[0] ||
            validationErrors?.["translations"]?.[0];

        const message =
            data?.message ||
            firstValidationMessage ||
            "Ocorreu um erro ao guardar.";

        const err = new Error(message);
        err.response = data;
        throw err;
    }

    return data;
}

export default function AttributeManagerModal({
    open,
    onClose,
    locale,
    initialAttributes = [],
    languageIds = { pt: null, en: null },
    onRefresh = null,
}) {
    const { t } = useI18n();

    const [attributes, setAttributes] = useState(() =>
        (initialAttributes ?? []).map(normalizeAttribute)
    );

    const [selectedAttributeId, setSelectedAttributeId] = useState(
        initialAttributes?.[0]?.id ?? null
    );

    const [attributeForm, setAttributeForm] = useState({
        code: "",
        name_pt: "",
        name_en: "",
        is_active: true,
    });

    const [valueForm, setValueForm] = useState({
        code: "",
        name_pt: "",
        name_en: "",
    });

    const [editingAttributeId, setEditingAttributeId] = useState(null);
    const [editingValueId, setEditingValueId] = useState(null);
    const [savingAttribute, setSavingAttribute] = useState(false);
    const [savingValue, setSavingValue] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!open) return;

        const nextAttributes = (initialAttributes ?? []).map(normalizeAttribute);

        setAttributes(nextAttributes);
        setSelectedAttributeId((current) => {
            if (current && nextAttributes.some((row) => row.id === current)) {
                return current;
            }
            return nextAttributes?.[0]?.id ?? null;
        });

        setAttributeForm({
            code: "",
            name_pt: "",
            name_en: "",
            is_active: true,
        });

        setValueForm({
            code: "",
            name_pt: "",
            name_en: "",
        });

        setEditingAttributeId(null);
        setEditingValueId(null);
        setErrorMessage("");
    }, [open, initialAttributes]);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        document.addEventListener("keydown", onKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    const sortedAttributes = useMemo(() => {
        return [...attributes].sort((a, b) =>
            getAttributeLabel(a, locale).localeCompare(getAttributeLabel(b, locale))
        );
    }, [attributes, locale]);

    const selectedAttribute = useMemo(() => {
        return attributes.find((row) => row.id === selectedAttributeId) ?? null;
    }, [attributes, selectedAttributeId]);

    const selectedValues = useMemo(() => {
        if (!selectedAttribute) return [];

        return [...(selectedAttribute.values ?? [])]
            .map(normalizeValue)
            .sort((a, b) =>
                getValueLabel(a, locale).localeCompare(getValueLabel(b, locale))
            );
    }, [selectedAttribute, locale]);

    const resetAttributeForm = () => {
        setEditingAttributeId(null);
        setAttributeForm({
            code: "",
            name_pt: "",
            name_en: "",
            is_active: true,
        });
        setErrorMessage("");
    };

    const resetValueForm = () => {
        setEditingValueId(null);
        setValueForm({
            code: "",
            name_pt: "",
            name_en: "",
        });
        setErrorMessage("");
    };

    const replaceAttributeInState = (updatedAttribute) => {
        const normalized = normalizeAttribute(updatedAttribute);

        setAttributes((current) => {
            const exists = current.some((row) => row.id === normalized.id);

            if (exists) {
                return current.map((row) => (row.id === normalized.id ? normalized : row));
            }

            return [...current, normalized];
        });

        if (normalized.id) {
            setSelectedAttributeId(normalized.id);
        }
    };

    const removeAttributeFromState = (attributeId) => {
        setAttributes((current) => {
            const remaining = current.filter((row) => row.id !== attributeId);

            setSelectedAttributeId((selected) => {
                if (selected !== attributeId) return selected;
                return remaining?.[0]?.id ?? null;
            });

            return remaining;
        });
    };

    const replaceValueInState = (updatedValue) => {
        const normalizedValue = normalizeValue(updatedValue);

        setAttributes((current) =>
            current.map((attribute) => {
                if (attribute.id !== selectedAttributeId) return attribute;

                const values = Array.isArray(attribute.values) ? attribute.values : [];
                const exists = values.some((row) => row.id === normalizedValue.id);

                const nextValues = exists
                    ? values.map((row) =>
                          row.id === normalizedValue.id ? normalizedValue : row
                      )
                    : [...values, normalizedValue];

                return {
                    ...attribute,
                    values: nextValues,
                    values_count: nextValues.length,
                };
            })
        );
    };

    const removeValueFromState = (valueId) => {
        setAttributes((current) =>
            current.map((attribute) => {
                if (attribute.id !== selectedAttributeId) return attribute;

                const nextValues = (attribute.values ?? []).filter(
                    (row) => row.id !== valueId
                );

                return {
                    ...attribute,
                    values: nextValues,
                    values_count: nextValues.length,
                };
            })
        );
    };

    const handleEditAttribute = (attribute) => {
        setEditingAttributeId(attribute.id);
        setAttributeForm({
            code: attribute?.code ?? "",
            name_pt: getTranslationName(attribute?.translations, "pt"),
            name_en: getTranslationName(attribute?.translations, "en"),
            is_active: !!attribute?.is_active,
        });
        setErrorMessage("");
    };

    const handleDeleteAttribute = async (attribute) => {
        const label = getAttributeLabel(attribute, locale);

        if (
            !window.confirm(
                t("ui.manager.confirm_delete_attribute", `Eliminar atributo "${label}"?`)
            )
        ) {
            return;
        }

        try {
            setErrorMessage("");

            await sendJson(
                route("manager.attributes.destroy", {
                    locale,
                    attribute: attribute.id,
                }),
                "DELETE"
            );

            removeAttributeFromState(attribute.id);
            resetAttributeForm();
            resetValueForm();
            onRefresh?.();
        } catch (error) {
            setErrorMessage(error.message);
        }
    };

    const handleSubmitAttribute = async (e) => {
        e.preventDefault();

        try {
            setSavingAttribute(true);
            setErrorMessage("");

            const payload = {
                code: attributeForm.code.trim(),
                is_active: !!attributeForm.is_active,
                translations: {
                    pt: { name: attributeForm.name_pt.trim() },
                    en: { name: attributeForm.name_en.trim() },
                },
            };

            if (editingAttributeId) {
                const data = await sendJson(
                    route("manager.attributes.update", {
                        locale,
                        attribute: editingAttributeId,
                    }),
                    "PUT",
                    payload
                );

                if (data?.attribute) {
                    replaceAttributeInState(data.attribute);
                }

                resetAttributeForm();
                onRefresh?.();
            } else {
                const data = await sendJson(
                    route("manager.attributes.store", { locale }),
                    "POST",
                    payload
                );

                if (data?.attribute) {
                    replaceAttributeInState(data.attribute);
                }

                resetAttributeForm();
                onRefresh?.();
            }
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setSavingAttribute(false);
        }
    };

    const handleEditValue = (value) => {
        setEditingValueId(value.id);
        setValueForm({
            code: value?.code ?? "",
            name_pt: getTranslationName(value?.translations, "pt"),
            name_en: getTranslationName(value?.translations, "en"),
        });
        setErrorMessage("");
    };

    const handleDeleteValue = async (value) => {
        const label = getValueLabel(value, locale);

        if (
            !window.confirm(
                t(
                    "ui.manager.confirm_delete_attribute_value",
                    `Eliminar valor "${label}"?`
                )
            )
        ) {
            return;
        }

        try {
            setErrorMessage("");

            await sendJson(
                route("manager.attributes.values.destroy", {
                    locale,
                    attribute: selectedAttributeId,
                    value: value.id,
                }),
                "DELETE"
            );

            removeValueFromState(value.id);
            resetValueForm();
            onRefresh?.();
        } catch (error) {
            setErrorMessage(error.message);
        }
    };

    const handleSubmitValue = async (e) => {
        e.preventDefault();

        if (!selectedAttributeId) return;

        try {
            setSavingValue(true);
            setErrorMessage("");

            const payload = {
                code: valueForm.code.trim(),
                translations: {
                    pt: { name: valueForm.name_pt.trim() },
                    en: { name: valueForm.name_en.trim() },
                },
            };

            if (editingValueId) {
                const data = await sendJson(
                    route("manager.attributes.values.update", {
                        locale,
                        attribute: selectedAttributeId,
                        value: editingValueId,
                    }),
                    "PUT",
                    payload
                );

                if (data?.value) {
                    replaceValueInState(data.value);
                }

                resetValueForm();
                onRefresh?.();
            } else {
                const data = await sendJson(
                    route("manager.attributes.values.store", {
                        locale,
                        attribute: selectedAttributeId,
                    }),
                    "POST",
                    payload
                );

                if (data?.value) {
                    replaceValueInState(data.value);
                }

                resetValueForm();
                onRefresh?.();
            }
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setSavingValue(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000]">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
                <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[90vh] sm:rounded-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                                {t("ui.manager.manage_attributes", "Gerir atributos")}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                {t(
                                    "ui.manager.manage_attributes_help",
                                    "Cria e gere atributos e valores para produtos com variantes."
                                )}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    {errorMessage ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
                            {errorMessage}
                        </div>
                    ) : null}

                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
                                <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-base font-semibold text-gray-900">
                                                {t("ui.manager.attributes", "Atributos")}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-500">
                                                {t(
                                                    "ui.manager.attributes_list_help",
                                                    "Seleciona ou cria atributos."
                                                )}
                                            </div>
                                        </div>

                                        <SmallButton tone="soft" onClick={resetAttributeForm}>
                                            {t("ui.common.new", "Novo")}
                                        </SmallButton>
                                    </div>

                                    <form onSubmit={handleSubmitAttribute} className="space-y-3">
                                        <TextInput
                                            value={attributeForm.code}
                                            onChange={(e) =>
                                                setAttributeForm((current) => ({
                                                    ...current,
                                                    code: e.target.value,
                                                }))
                                            }
                                            placeholder={t("ui.common.code", "Código")}
                                        />

                                        <TextInput
                                            value={attributeForm.name_pt}
                                            onChange={(e) =>
                                                setAttributeForm((current) => ({
                                                    ...current,
                                                    name_pt: e.target.value,
                                                }))
                                            }
                                            placeholder="Nome (PT)"
                                        />

                                        <TextInput
                                            value={attributeForm.name_en}
                                            onChange={(e) =>
                                                setAttributeForm((current) => ({
                                                    ...current,
                                                    name_en: e.target.value,
                                                }))
                                            }
                                            placeholder="Name (EN)"
                                        />

                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={!!attributeForm.is_active}
                                                onChange={(e) =>
                                                    setAttributeForm((current) => ({
                                                        ...current,
                                                        is_active: e.target.checked,
                                                    }))
                                                }
                                                className="rounded border-gray-300"
                                            />
                                            <span>{t("ui.common.active", "Ativo")}</span>
                                        </label>

                                        <div className="flex flex-wrap gap-2">
                                            <SmallButton
                                                type="submit"
                                                tone="primary"
                                                disabled={savingAttribute}
                                            >
                                                {savingAttribute
                                                    ? t("ui.common.saving", "A guardar...")
                                                    : editingAttributeId
                                                      ? t("ui.common.save_changes", "Guardar alterações")
                                                      : t("ui.manager.create_attribute", "Criar novo")}
                                            </SmallButton>

                                            {editingAttributeId ? (
                                                <SmallButton onClick={resetAttributeForm}>
                                                    {t("ui.common.cancel", "Cancelar")}
                                                </SmallButton>
                                            ) : null}
                                        </div>
                                    </form>
                                </div>

                                <div className="px-4 py-4 sm:px-6">
                                    <div className="space-y-2">
                                        {sortedAttributes.length === 0 ? (
                                            <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                                                {t(
                                                    "ui.manager.no_attributes_yet",
                                                    "Ainda não existem atributos."
                                                )}
                                            </div>
                                        ) : (
                                            sortedAttributes.map((attribute) => {
                                                const selected = selectedAttributeId === attribute.id;

                                                return (
                                                    <div
                                                        key={attribute.id}
                                                        className={[
                                                            "rounded-lg border p-3 transition",
                                                            selected
                                                                ? "border-gray-900 bg-gray-50"
                                                                : "border-gray-200 bg-white hover:bg-gray-50",
                                                        ].join(" ")}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAttributeId(attribute.id);
                                                                resetValueForm();
                                                                setErrorMessage("");
                                                            }}
                                                            className="w-full text-left"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="font-medium text-gray-900">
                                                                        {getAttributeLabel(attribute, locale)}
                                                                    </div>
                                                                    <div className="mt-1 text-xs text-gray-500">
                                                                        {attribute.code}
                                                                    </div>
                                                                </div>

                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                                                    {attribute.values_count}
                                                                </span>
                                                            </div>
                                                        </button>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <SmallButton onClick={() => handleEditAttribute(attribute)}>
                                                                {t("ui.common.edit", "Editar")}
                                                            </SmallButton>

                                                            <SmallButton
                                                                tone="danger"
                                                                onClick={() => handleDeleteAttribute(attribute)}
                                                            >
                                                                {t("ui.common.delete", "Eliminar")}
                                                            </SmallButton>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-base font-semibold text-gray-900">
                                                {t("ui.manager.attribute_values", "Valores")}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-500">
                                                {selectedAttribute
                                                    ? `${t("ui.manager.selected_attribute", "Atributo selecionado")}: ${getAttributeLabel(selectedAttribute, locale)}`
                                                    : t(
                                                          "ui.manager.select_attribute_first",
                                                          "Seleciona primeiro um atributo."
                                                      )}
                                            </div>
                                        </div>

                                        {selectedAttribute ? (
                                            <SmallButton tone="soft" onClick={resetValueForm}>
                                                {t("ui.manager.create_attribute_value", "Criar novo valor")}
                                            </SmallButton>
                                        ) : null}
                                    </div>

                                    {selectedAttribute ? (
                                        <form onSubmit={handleSubmitValue} className="space-y-3">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <TextInput
                                                    value={valueForm.code}
                                                    onChange={(e) =>
                                                        setValueForm((current) => ({
                                                            ...current,
                                                            code: e.target.value,
                                                        }))
                                                    }
                                                    placeholder={t("ui.common.code", "Código")}
                                                />

                                                <TextInput
                                                    value={valueForm.name_pt}
                                                    onChange={(e) =>
                                                        setValueForm((current) => ({
                                                            ...current,
                                                            name_pt: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Nome (PT)"
                                                />

                                                <TextInput
                                                    value={valueForm.name_en}
                                                    onChange={(e) =>
                                                        setValueForm((current) => ({
                                                            ...current,
                                                            name_en: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Name (EN)"
                                                />
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <SmallButton
                                                    type="submit"
                                                    tone="primary"
                                                    disabled={savingValue}
                                                >
                                                    {savingValue
                                                        ? t("ui.common.saving", "A guardar...")
                                                        : editingValueId
                                                          ? t("ui.common.save_changes", "Guardar alterações")
                                                          : t("ui.manager.create_attribute_value", "Criar novo valor")}
                                                </SmallButton>

                                                {editingValueId ? (
                                                    <SmallButton onClick={resetValueForm}>
                                                        {t("ui.common.cancel", "Cancelar")}
                                                    </SmallButton>
                                                ) : null}
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                                            {t(
                                                "ui.manager.select_attribute_to_manage_values",
                                                "Seleciona um atributo à esquerda para gerir os seus valores."
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 py-4 sm:px-6">
                                    {!selectedAttribute ? null : selectedValues.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                                            {t(
                                                "ui.manager.no_attribute_values_yet",
                                                "Este atributo ainda não tem valores."
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedValues.map((value) => (
                                                <div
                                                    key={value.id}
                                                    className="rounded-lg border border-gray-200 bg-white p-3"
                                                >
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {value.code}
                                                        </div>

                                                        <div className="text-sm text-gray-700">
                                                            {getTranslationName(value.translations, "pt") || "—"}
                                                        </div>

                                                        <div className="text-sm text-gray-700">
                                                            {getTranslationName(value.translations, "en") || "—"}
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 sm:justify-end">
                                                            <SmallButton onClick={() => handleEditValue(value)}>
                                                                {t("ui.common.edit", "Editar")}
                                                            </SmallButton>

                                                            <SmallButton
                                                                tone="danger"
                                                                onClick={() => handleDeleteValue(value)}
                                                            >
                                                                {t("ui.common.delete", "Eliminar")}
                                                            </SmallButton>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
