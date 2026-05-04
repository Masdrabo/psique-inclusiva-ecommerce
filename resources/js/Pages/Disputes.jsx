import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Disputes() {
    const { locale } = usePage().props;
    const { t } = useI18n();

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t('ui.disputes.title')}
                </h2>
            }
        >
            <Head title={t('ui.disputes.title')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="p-6 sm:p-8">
                            <div className="mx-auto max-w-4xl space-y-6 text-gray-700 leading-7">

                                <p>
                                    {t('ui.disputes.intro')}
                                </p>

                                <p className="font-semibold text-gray-900">
                                    {t('ui.disputes.cniacc')}
                                </p>

                                <p>
                                    {t('ui.disputes.description')}{' '}
                                    <a
                                        href="https://www.consumidor.gov.pt"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline hover:text-blue-800"
                                    >
                                        {t('ui.disputes.link_text')}
                                    </a>
                                </p>

                                <p>
                                    {t('ui.disputes.eu_platform')}{' '}
                                    <a
                                        href="https://ec.europa.eu/consumers/odr"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline hover:text-blue-800"
                                    >
                                        https://ec.europa.eu/consumers/odr
                                    </a>
                                </p>

                                <p className="text-sm text-gray-500">
                                    {t('ui.disputes.note')}
                                </p>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
