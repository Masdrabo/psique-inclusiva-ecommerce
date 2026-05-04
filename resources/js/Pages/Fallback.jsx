import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Fallback() {

    const { locale, auth } = usePage().props;
    const { t } = useI18n();

    const isAuthed = !!auth?.user;

    return (
        <GuestLayout>

            <Head title={t('ui.fallback.title', 'Page not found')} />

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                <h1 className="text-lg font-semibold text-gray-900">
                    {t('ui.fallback.title', "Don't get lost in our Shop..")}
                </h1>

                <p className="mt-2 text-sm text-gray-600">
                    {t('ui.fallback.subtitle', 'The page you are looking for does not exist or has moved.')}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                    {/* SEMPRE aparece */}
                    <Link
                        href={`/${locale}`}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {t('ui.fallback.go_home', 'Back to home')}
                    </Link>

                    {/* lógica ORIGINAL correta */}
                    {isAuthed ? (
                        <Link
                            href={`/${locale}/dashboard`}
                            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            {t('ui.fallback.go_dashboard', 'Go to dashboard')}
                        </Link>
                    ) : (
                        <Link
                            href={`/${locale}/login`}
                            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            {t('ui.fallback.go_login', 'Log in')}
                        </Link>
                    )}

                </div>
            </div>

        </GuestLayout>
    );
}
