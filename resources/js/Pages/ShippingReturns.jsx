import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function ShippingReturns() {
    const { locale } = usePage().props;
    const { t } = useI18n();

    const formattedDate = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date());

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        {t('ui.shipping_returns.title')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {t('ui.shipping_returns.last_updated')} {formattedDate}
                    </p>
                </div>
            }
        >
            <Head title={t('ui.shipping_returns.title', 'Shipping & Returns')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="p-6 sm:p-8">
                            <div className="mx-auto max-w-4xl space-y-8 text-gray-700 leading-7">
                                <section>
                                    <p>
                                        {t('ui.shipping_returns.intro')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.shipping')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.shipping_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.delivery_times')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.delivery_times_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.returns')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.returns_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.withdrawal')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.withdrawal_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.refunds')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.refunds_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.exceptions')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.exceptions_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.shipping_returns.section.contact')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.shipping_returns.contact_text')}
                                    </p>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
