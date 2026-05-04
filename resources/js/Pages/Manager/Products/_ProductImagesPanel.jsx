import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

function FieldError({ error }) {
  if (!error) return null;
  return <div className="mt-1 text-sm text-red-600">{error}</div>;
}

function imgUrl(path) {
  if (!path) return null;
  return `/storage/${path}`;
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-2.5 py-1.5 text-xs font-semibold transition " +
        (active
          ? "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200")
      }
    >
      {children}
    </button>
  );
}

function SortableCard({
  img,
  index,
  imagesCount,
  tab,
  altValue,
  onSetTab,
  onAltChange,
  onMove,
  onSetMain,
  onRemove,
  onSaveAlt,
  saving,
  t,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border overflow-hidden bg-white"
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-between bg-gray-50 px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing select-none rounded-md border bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            title={t("ui.manager.drag_to_reorder", "Drag to reorder")}
          >
            ⇅ {t("ui.manager.drag", "Drag")}
          </div>

          <div className="text-xs text-gray-500">
            #{img.position ?? index + 1}
            {img.is_main ? (
              <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {t("ui.manager.main_image", "Main")}
              </span>
            ) : null}
          </div>
        </div>

        {/* ↑ ↓ fallback */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(img.id, "up")}
            disabled={index === 0}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            title={t("ui.common.up", "Up")}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(img.id, "down")}
            disabled={index === imagesCount - 1}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            title={t("ui.common.down", "Down")}
          >
            ↓
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="aspect-video bg-gray-50 flex items-center justify-center">
        {imgUrl(img.path) ? (
          <img
            src={imgUrl(img.path)}
            alt={altValue}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="text-sm text-gray-500">—</div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Tabs PT/EN */}
        <div className="flex items-center gap-2">
          <TabButton active={tab === "pt"} onClick={() => onSetTab(img.id, "pt")}>
            PT
          </TabButton>
          <TabButton active={tab === "en"} onClick={() => onSetTab(img.id, "en")}>
            EN
          </TabButton>
        </div>

        {/* Alt input */}
        <div>
          <label className="text-xs font-semibold text-gray-700">
            {t("ui.manager.image_alt", "Alt text")} ({tab.toUpperCase()})
          </label>
          <input
            value={altValue}
            onChange={(e) => onAltChange(img.id, tab, e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-sm"
            placeholder={t(
              "ui.manager.image_alt_placeholder",
              "Short description for accessibility/SEO"
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!img.is_main ? (
              <button
                type="button"
                onClick={() => onSetMain(img.id)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                {t("ui.manager.set_as_main", "Set as main")}
              </button>
            ) : (
              <div className="text-xs text-gray-600">
                {t("ui.manager.main_image_note", "This is the main image.")}
              </div>
            )}

            <button
              type="button"
              onClick={() => onRemove(img.id)}
              className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              {t("ui.common.delete", "Delete")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSaveAlt(img.id)}
            disabled={!!saving}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? t("ui.common.saving", "Saving…") : t("ui.common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductImagesPanel({ product }) {
  const { locale, errors } = usePage().props;
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // tab por imagem
  const [tabs, setTabs] = useState({}); // { [imageId]: "pt" | "en" }

  // alts por imagem e idioma
  const [alts, setAlts] = useState({}); // { [imageId]: { pt: {alt}, en:{alt} } }
  const [saving, setSaving] = useState({}); // { [imageId]: boolean }

  const images = useMemo(() => {
    return (product?.images ?? []).slice().sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }, [product]);

  // dnd sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // inicializar state de alts a partir do backend
  useEffect(() => {
    const nextTabs = {};
    const nextAlts = {};

    for (const img of images) {
      nextTabs[img.id] = "pt";

      const tr = img.translations ?? [];
      const pt = tr.find((x) => x.language?.code === "pt") ?? null;
      const en = tr.find((x) => x.language?.code === "en") ?? null;

      nextAlts[img.id] = {
        pt: { alt: pt?.alt ?? "" },
        en: { alt: en?.alt ?? "" },
      };
    }

    setTabs((prev) => ({ ...nextTabs, ...prev }));
    setAlts((prev) => ({ ...nextAlts, ...prev }));
  }, [images.length]);

  const upload = (files) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("images[]", f));

    setUploading(true);

    router.post(
      route("manager.products.images.store", { locale, product: product.id }),
      formData,
      {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => {
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
        },
      }
    );
  };

  const setMain = (imageId) => {
    router.patch(
      route("manager.products.images.main", {
        locale,
        product: product.id,
        image: imageId,
      }),
      {},
      { preserveScroll: true }
    );
  };

  const remove = (imageId) => {
    if (!confirm(t("ui.common.confirm_delete", "Confirm delete?"))) return;

    router.delete(
      route("manager.products.images.destroy", {
        locale,
        product: product.id,
        image: imageId,
      }),
      { preserveScroll: true }
    );
  };

  const move = (imageId, dir) => {
    const idx = images.findIndex((x) => x.id === imageId);
    if (idx < 0) return;

    const nextIdx = dir === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= images.length) return;

    const reordered = images.slice();
    const [item] = reordered.splice(idx, 1);
    reordered.splice(nextIdx, 0, item);

    router.patch(
      route("manager.products.images.reorder", { locale, product: product.id }),
      { order: reordered.map((x) => x.id) },
      { preserveScroll: true }
    );
  };

  const setTab = (imageId, tab) => {
    setTabs((prev) => ({ ...prev, [imageId]: tab }));
  };

  const setAltValue = (imageId, lang, value) => {
    setAlts((prev) => ({
      ...prev,
      [imageId]: {
        ...(prev[imageId] ?? { pt: { alt: "" }, en: { alt: "" } }),
        [lang]: { alt: value },
      },
    }));
  };

  const saveAlt = (imageId) => {
    setSaving((prev) => ({ ...prev, [imageId]: true }));

    const payload = {
      translations: {
        pt: { alt: alts?.[imageId]?.pt?.alt ?? "" },
        en: { alt: alts?.[imageId]?.en?.alt ?? "" },
      },
    };

    router.patch(
      route("manager.products.images.update", {
        locale,
        product: product.id,
        image: imageId,
      }),
      payload,
      {
        preserveScroll: true,
        onFinish: () => setSaving((prev) => ({ ...prev, [imageId]: false })),
      }
    );
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(images, oldIndex, newIndex);

    router.patch(
      route("manager.products.images.reorder", { locale, product: product.id }),
      { order: reordered.map((x) => x.id) },
      { preserveScroll: true }
    );
  };

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {t("ui.manager.product_images", "Product images")}
          </div>
          <div className="text-sm text-gray-600">
            {t(
              "ui.manager.product_images_help",
              "Upload images, set a main image and reorder."
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files)}
            className="hidden"
            id="product-images-input"
          />
          <label
            htmlFor="product-images-input"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 cursor-pointer"
            aria-disabled={uploading}
          >
            {uploading
              ? t("ui.common.uploading", "Uploading…")
              : t("ui.common.upload", "Upload")}
          </label>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-600">
          {t(
            "ui.manager.product_images_empty",
            "No images yet. Upload the first image to set it as main."
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={images.map((x) => x.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {images.map((img, index) => {
                const tab = tabs[img.id] ?? "pt";
                const altValue = alts?.[img.id]?.[tab]?.alt ?? "";

                return (
                  <SortableCard
                    key={img.id}
                    img={img}
                    index={index}
                    imagesCount={images.length}
                    tab={tab}
                    altValue={altValue}
                    onSetTab={setTab}
                    onAltChange={setAltValue}
                    onMove={move}
                    onSetMain={setMain}
                    onRemove={remove}
                    onSaveAlt={saveAlt}
                    saving={!!saving[img.id]}
                    t={t}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* erros gerais de upload */}
      <FieldError error={errors?.images} />
      <FieldError error={errors?.["images.0"]} />
    </div>
  );
}
