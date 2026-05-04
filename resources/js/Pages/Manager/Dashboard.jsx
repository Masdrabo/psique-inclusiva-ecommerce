import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";

function DashboardCard({ href, icon, title, description, meta }) {
    return (
        <Link
            href={href}
            className="group cursor-pointer rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
        >
            <div className="flex flex-col gap-3">
                <div className="text-3xl">{icon}</div>

                <div className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                    {title}
                </div>

                <div className="text-sm text-gray-600">
                    {description}
                </div>

                {meta ? (
                    <div className="pt-2 text-xs text-gray-500">
                        {meta}
                    </div>
                ) : null}
            </div>
        </Link>
    );
}

export default function ManagerDashboard() {
    const { locale, inventoryCards = {} } = usePage().props;
    const { t } = useI18n();

    const outOfStock = inventoryCards.out_of_stock_products ?? 0;
    const lowStock = inventoryCards.low_stock_products ?? 0;
    const totalUnits = inventoryCards.total_units ?? 0;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t("ui.manager.dashboard1", "Gestão da Loja")}
                </h2>
            }
        >
            <Head title={t('ui.manager.dashboard', 'Gestão da Loja')} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <DashboardCard
                            href={route("manager.categories.index", { locale })}
                            icon="📂"
                            title={t("ui.common.categories", "Categories")}
                            description={t(
                                "ui.manager.categories_desc",
                                "Manage shop categories, hierarchy and translations"
                            )}
                        />

                        <DashboardCard
                            href={route("manager.products.index", { locale })}
                            icon="📦"
                            title={t("ui.common.products", "Products")}
                            description={t(
                                "ui.manager.products_desc",
                                "Manage products, pricing and translations"
                            )}
                        />

                        <DashboardCard
                            href={route("manager.inventories.index", { locale })}
                            icon="📊"
                            title={t("ui.common.inventory", "Inventory")}
                            description={t(
                                "ui.manager.inventory_desc",
                                "Manage product stock, availability and inventory levels"
                            )}
                            meta={`${outOfStock} sem stock · ${lowStock} stock baixo · ${totalUnits} unidades`}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
