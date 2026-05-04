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
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
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
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
  };

  return (
    <div className={"rounded-md border p-3 " + (map[tone] ?? map.yellow)}>
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

function InlineHelp({ children }) {
  return <div className="mt-1 text-xs text-gray-500">{children}</div>;
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

export default function CategoryForm({
  mode,
  category = null,
  categories = [],
  languages = [],
  onSubmit,
}) {
  const { locale } = usePage().props;
  const { t } = useI18n();
  const [tab, setTab] = useState("pt");

  const ptTr =
    category?.translations?.find((x) => x.language?.code === "pt") ?? null;
  const enTr =
    category?.translations?.find((x) => x.language?.code === "en") ?? null;

  const initialSlug = category?.slug ?? "";
  const existingImageUrl = category?.image_url ?? category?.image ?? null;

  const form = useForm({
    slug: initialSlug,
    parent_id: category?.parent_id ?? null,
    is_active: category ? !!category.is_active : true,
    image: null,
    remove_image: false,
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
  }, [mode, autoSlugFromPT]);

  const slugChanged =
    mode === "edit" &&
    (form.data.slug ?? "").trim() !== (initialSlug ?? "").trim();

  const parentOptions = useMemo(() => {
    const selfId = category?.id ?? null;
    return categories.filter((c) => (selfId ? c.id !== selfId : true));
  }, [categories, category?.id]);

  const imagePreviewUrl = useMemo(() => {
    if (form.data.image instanceof File) {
      return URL.createObjectURL(form.data.image);
    }

    if (!form.data.remove_image && existingImageUrl) {
      return existingImageUrl;
    }

    return null;
  }, [form.data.image, form.data.remove_image, existingImageUrl]);

  useEffect(() => {
    return () => {
      if (form.data.image instanceof File && imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [form.data.image, imagePreviewUrl]);

  const submit = (e) => {
    e.preventDefault();

    form.transform((data) => ({
      ...data,
      slug: (data.slug ?? "").trim(),
      parent_id: data.parent_id ? Number(data.parent_id) : null,
      remove_image: !!data.remove_image,
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

  const regenerateSlugFromPT = () => {
    form.setData("slug", autoSlugFromPT);
  };

  const resetSlug = () => {
    form.setData("slug", initialSlug);
  };

  const onImageChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    form.setData("image", file);
    if (file) {
      form.setData("remove_image", false);
    }
  };

  const removeSelectedImage = () => {
    form.setData("image", null);
    form.setData("remove_image", true);
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
    <form onSubmit={submit} encType="multipart/form-data" className="space-y-5">
      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <SectionTitle
          title={t("ui.manager.main_information", "Informação principal")}
          subtitle={t(
            "ui.manager.category_main_information_help",
            "Define o conteúdo principal da categoria e a sua organização."
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
            <FieldError error={getTrError(form.errors, tab, "description")} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <SectionTitle
          title={t("ui.manager.category_configuration", "Configuração da categoria")}
          subtitle={t(
            "ui.manager.category_configuration_help_v2",
            "Define hierarquia e estado da categoria."
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              {t("ui.common.parent", "Parent")}
            </label>
            <select
              value={form.data.parent_id ?? ""}
              onChange={(e) => form.setData("parent_id", e.target.value || null)}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
            >
              <option value="">{t("ui.common.none", "None")}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug}
                </option>
              ))}
            </select>
            <InlineHelp>
              {t(
                "ui.manager.category_parent_help_v2",
                "Opcional. Ao escolher uma categoria pai, esta categoria será criada automaticamente no fim desse grupo."
              )}
            </InlineHelp>
            <FieldError error={form.errors.parent_id} />
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
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <SectionTitle
          title={t("ui.manager.category_image", "Imagem da categoria")}
          subtitle={t(
            "ui.manager.category_image_help",
            "Escolhe a imagem principal usada para representar a categoria."
          )}
        />

        {imagePreviewUrl ? (
          <div className="overflow-hidden rounded-xl border bg-gray-50">
            <div className="flex aspect-[16/6] items-center justify-center">
              <img
                src={imagePreviewUrl}
                alt={category?.slug ?? "Category preview"}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            {t("ui.manager.no_category_image", "Sem imagem selecionada.")}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onImageChange}
            className="block w-full text-sm text-gray-700"
          />

          {(imagePreviewUrl || existingImageUrl) ? (
            <button
              type="button"
              onClick={removeSelectedImage}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              {t("ui.manager.remove_image", "Remover imagem")}
            </button>
          ) : null}
        </div>

        <InlineHelp>
          {t(
            "ui.manager.category_image_formats_help",
            "Formatos: JPG, PNG, WEBP. Máximo: 4MB."
          )}
        </InlineHelp>

        <FieldError error={form.errors.image} />
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
          {mode === "create" ? (
            <Pill tone="blue">{t("ui.manager.slug_auto", "Auto")}</Pill>
          ) : null}
          {mode === "edit" && slugChanged ? (
            <Pill tone="yellow">{t("ui.manager.slug_changed", "Changed")}</Pill>
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
              "ui.manager.slug_warning_body_category_v2",
              "Alterar o slug muda o URL da categoria e pode quebrar links antigos. Se o mudares, idealmente cria um redirecionamento 301."
            )}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">
              {t("ui.common.slug", "Slug")}
            </label>

            {mode === "create" ? (
              <>
                <input
                  value={form.data.slug}
                  readOnly
                  className="mt-1 w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                />
                <InlineHelp>
                  {t(
                    "ui.manager.slug_create_readonly_help_v2",
                    "Gerado automaticamente a partir do nome em PT."
                  )}
                </InlineHelp>
              </>
            ) : (
              <>
                <input
                  value={form.data.slug}
                  onChange={(e) => form.setData("slug", e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900"
                />
                <InlineHelp>
                  {t(
                    "ui.manager.slug_edit_tip_v2",
                    "Mantém o slug simples, em minúsculas e com hífens."
                  )}
                </InlineHelp>
              </>
            )}

            <FieldError error={form.errors.slug} />
          </div>

          {mode === "edit" ? (
            <div className="sm:pt-6 flex flex-col gap-2">
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
            <FieldError error={getTrError(form.errors, tab, "meta_title")} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              {t("ui.common.meta_description", "Meta description")} (
              {tab.toUpperCase()})
            </label>
            <input
              value={tData.meta_description}
              onChange={(e) => setTrField("meta_description", e.target.value)}
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
          href={route("manager.categories.index", { locale })}
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
