import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import ProductForm from "./_ProductForm";
import { useI18n } from "@/lib/i18n";

export default function ProductsCreate() {
    const {
        locale,
        categories = [],
        attributes = [],
        currency = null,
    } = usePage().props;

    const { t } = useI18n();

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {t("ui.common.new", "New")} {t("ui.common.product", "Product")}
                        </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("manager.products.index", { locale })}
                            className="text-sm underline"
                        >
                            {t("ui.common.back", "Back")}
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title="Manager · New Product" />

            <div className="py-6">
                <div className="mx-auto max-w-6xl sm:px-6 lg:px-8">
                    <div className="bg-white shadow-sm sm:rounded-lg p-4 sm:p-6">
                        <ProductForm
                            mode="create"
                            categories={categories}
                            attributes={attributes}
                            currency={currency}
                            onSubmit={(form) =>
                                form.post(route("manager.products.store", { locale }), {
                                    forceFormData: true,
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        router.visit(route("manager.products.index", { locale }), {
                                            preserveScroll: true,
                                        });
                                    },
                                    onError: (errors) => {
                                        console.log("PRODUCT CREATE ERRORS:", errors);
                                        alert(JSON.stringify(errors, null, 2));
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
