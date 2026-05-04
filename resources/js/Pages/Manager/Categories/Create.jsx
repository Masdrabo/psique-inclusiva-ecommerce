import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import CategoryForm from "./_CategoryForm";
import { useI18n } from "@/lib/i18n";

export default function CategoriesCreate() {
  const { locale, categories = [], languages = [] } = usePage().props;
  const { t } = useI18n();

  return (
    <AuthenticatedLayout
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">
              {t("ui.common.new", "New")} {t("ui.common.category", "Category")}
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
      <Head title="Manager · New Category" />

      <div className="py-6">
        <div className="mx-auto max-w-5xl sm:px-6 lg:px-8">
          <div className="bg-white shadow-sm sm:rounded-lg p-4 sm:p-6">
            <CategoryForm
              mode="create"
              categories={categories}
              languages={languages}
              onSubmit={(form) =>
                form.post(route("manager.categories.store", { locale }), {
                  preserveScroll: true,
                  forceFormData: true,
                  onSuccess: () => {
                    router.visit(route("manager.categories.index", { locale }), {
                      preserveScroll: true,
                    });
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
