import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useI18n } from "@/lib/i18n";

function Welcome() {

    const { t, locale } = useI18n();

    return (
        <>
            <Head title={t("ui.nav.home", "Home")} />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">

                            <p className="text-sm text-gray-500 mb-2">
                                Locale atual: {locale}
                            </p>

                            <h1 className="text-2xl font-bold">
                                {t("ui.nav.home", "Home")}
                            </h1>

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

/*
✅ ESTA LINHA É A MAGIA DO INERTIA
liga a página ao layout da dashboard
*/
Welcome.layout = (page) => (
    <AuthenticatedLayout children={page} />
);

export default Welcome;
