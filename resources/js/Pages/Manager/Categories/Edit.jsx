import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useState } from "react";
import CategoryForm from "./_CategoryForm";
import { useI18n } from "@/lib/i18n";

export default function CategoriesEdit() {
  const { locale, category, categories = [], languages = [] } = usePage().props;
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);

  const onDelete = () => {
    const label = category?.slug ?? "";

    if (!confirm(`${t("ui.common.delete", "Delete")} "${label}"?`)) return;

    setDeleting(true);

    router.delete(
      route("manager.categories.destroy", { locale, category: category.id }),
      {
        preserveScroll: true,
        preserveState: true,
        onFinish: () => setDeleting(false),
        onSuccess: () => {
          router.visit(route("manager.categories.index", { locale }), {
            preserveScroll: true,
          });
        },
      }
    );
  };

  return (
    <AuthenticatedLayout
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
              {t("ui.common.edit", "Edit")} · {category?.slug}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={route("manager.categories.index", { locale })}
              className="text-sm underline"
            >
              {t("ui.common.back", "Back")}
            </Link>
          </div>
        </div>
      }
    >
      <Head title="Manager · Edit Category" />

      <div className="py-6">
        <div className="mx-auto max-w-5xl sm:px-6 lg:px-8 space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className={[
                "rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50",
                deleting ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {deleting
                ? t("ui.common.deleting", "Deleting…")
                : t("ui.common.delete", "Delete")}
            </button>
          </div>

          <div className="bg-white shadow-sm sm:rounded-lg p-4 sm:p-6">
            <CategoryForm
              mode="edit"
              category={category}
              categories={categories}
              languages={languages}
              onSubmit={(form) => {
                form.transform((data) => ({
                  ...data,
                  _method: "put",
                }));

                form.post(
                  route("manager.categories.update", {
                    locale,
                    category: category.id,
                  }),
                  {
                    preserveScroll: true,
                    preserveState: true,
                    forceFormData: true,
                  }
                );
              }}
            />
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
