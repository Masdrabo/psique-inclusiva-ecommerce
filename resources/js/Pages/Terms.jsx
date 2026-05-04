import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Terms() {
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
                        {t('ui.terms.title', 'Terms & Conditions')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {t('ui.terms.last_updated', 'Last updated:')} {formattedDate}
                    </p>
                </div>
            }
        >
            <Head title={t('ui.footer.terms', 'Terms & Conditions')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="p-6 sm:p-8">
                            <div className="mx-auto max-w-4xl space-y-8 text-gray-700 leading-7">

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.company', 'Company Information')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.company_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.usage', 'Website Usage')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.usage_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.account', 'User Accounts')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.account_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.orders', 'Orders & Purchases')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.orders_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.pricing', 'Pricing & Payments')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.pricing_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.shipping', 'Shipping')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.shipping_text')}
                                    </p>
                                    <p className="mt-3 text-sm text-gray-600">
                                        {t('ui.terms.shipping_more_info_prefix', 'For more information, please see our')}{' '}
                                        <Link
                                            href={`/${locale}/shipping-returns`}
                                            className="font-medium text-gray-900 underline hover:text-gray-700"
                                        >
                                            {t('ui.shipping_returns.title', 'Shipping & Returns')}
                                        </Link>
                                        .
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.returns', 'Returns & Right of Withdrawal')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.returns_text')}
                                    </p>
                                    <p className="mt-3 text-sm text-gray-600">
                                        {t('ui.terms.returns_more_info_prefix', 'Detailed conditions are available on our')}{' '}
                                        <Link
                                            href={`/${locale}/shipping-returns`}
                                            className="font-medium text-gray-900 underline hover:text-gray-700"
                                        >
                                            {t('ui.shipping_returns.title', 'Shipping & Returns')}
                                        </Link>
                                        .
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.liability', 'Liability')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.liability_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.ip', 'Intellectual Property')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.ip_text')}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.terms.section.law', 'Applicable Law')}
                                    </h2>
                                    <p className="mt-2">
                                        {t('ui.terms.law_text')}
                                    </p>
                                    <p className="mt-3 text-sm text-gray-600">
                                        {t('ui.terms.disputes_more_info_prefix', 'You may also consult our page on')}{' '}
                                        <Link
                                            href={`/${locale}/disputes`}
                                            className="font-medium text-gray-900 underline hover:text-gray-700"
                                        >
                                            {t('ui.disputes.title', 'Dispute Resolution')}
                                        </Link>
                                        .
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
