import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Privacy() {
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
                        {t('ui.privacy.title', 'Privacy Policy')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {t('ui.privacy.last_updated', 'Last updated:')} {formattedDate}
                    </p>
                </div>
            }
        >
            <Head title={t('ui.footer.privacy', 'Privacy Policy')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="p-6 sm:p-8">
                            <div className="mx-auto max-w-4xl space-y-8 text-gray-700 leading-7">
                                <section>
                                    <p>
                                        {t(
                                            'ui.privacy.intro',
                                            'Your privacy is important to us. This policy explains how we collect, use and protect your personal data in accordance with the General Data Protection Regulation (GDPR).'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.controller', 'Data Controller')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.controller_text',
                                            'The entity responsible for processing your data is Psique Inclusiva. For any questions, you may contact us via geral@psiqueinclusiva.pt.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.data', 'Data We Collect')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.data_text',
                                            'We may collect personal data such as name, email address, billing information, and purchase history when you use our website.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.purpose', 'Purpose of Processing')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.purpose_text',
                                            'Your data is used to process orders, manage your account, improve our services, and comply with legal obligations.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.legal', 'Legal Basis')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.legal_text',
                                            'We process your data based on contract execution, legal obligations, and, where applicable, your consent.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.sharing', 'Data Sharing')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.sharing_text',
                                            'We may share your data with service providers such as payment processors and shipping companies, strictly for order fulfillment purposes.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.retention', 'Data Retention')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.retention_text',
                                            'We retain your data only for as long as necessary to fulfill the purposes outlined or as required by law.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.rights', 'Your Rights')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.rights_text',
                                            'You have the right to access, rectify, delete, restrict, or object to the processing of your personal data, as well as the right to data portability.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.security', 'Data Security')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.security_text',
                                            'We implement appropriate technical and organizational measures to protect your personal data.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.cookies', 'Cookies')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.cookies_text',
                                            'This website uses cookies to improve user experience. You can manage your preferences through your browser settings.'
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {t('ui.privacy.section.contact', 'Contact')}
                                    </h2>
                                    <p className="mt-2">
                                        {t(
                                            'ui.privacy.contact_text',
                                            'If you have any questions regarding this policy or your data, please contact us at geral@psiqueinclusiva.pt.'
                                        )}
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
