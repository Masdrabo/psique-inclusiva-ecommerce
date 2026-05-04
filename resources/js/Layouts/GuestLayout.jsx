import LanguageSwitcher from '@/Components/LanguageSwitcher';
import FlashMessage from '@/Components/FlashMessage';
import { Link, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import Logo from '@/images/psique-inclusiva-online.jpg';

export default function GuestLayout({ children }) {
    const { locale } = usePage().props;
    const resolvedLocale = locale ?? 'pt';
    const { t } = useI18n();

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="border-b border-gray-100 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-16 items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-4">
                            <Link href={`/${resolvedLocale}`} className="flex items-center gap-3">
                                <img
                                    src={Logo}
                                    alt="Psique Inclusiva"
                                    className="h-10 w-auto"
                                />
                                <span className="font-semibold text-gray-900">
                                    Psique Inclusiva
                                </span>
                            </Link>

                            <nav className="hidden sm:flex items-center gap-4">
                                <Link
                                    href={`/${resolvedLocale}`}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                                >
                                    {t('ui.nav.home', 'Home')}
                                </Link>

                                <Link
                                    href={`/${resolvedLocale}/shop`}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                                >
                                    {t('ui.nav.shop', 'Shop')}
                                </Link>
                            </nav>
                        </div>

                        <div className="flex items-center gap-3">
                            <LanguageSwitcher />

                            <div className="hidden sm:flex items-center gap-3">
                                <Link
                                    href={`/${resolvedLocale}/login`}
                                    className="rounded-md text-sm font-medium text-gray-600 hover:text-gray-900"
                                >
                                    {t('ui.auth.login_button', 'Log in')}
                                </Link>

                                <Link
                                    href={`/${resolvedLocale}/register`}
                                    className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                >
                                    {t('ui.auth.register_button', 'Register')}
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="sm:hidden pb-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href={`/${resolvedLocale}`}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                {t('ui.nav.home', 'Home')}
                            </Link>

                            <Link
                                href={`/${resolvedLocale}/shop`}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                {t('ui.nav.shop', 'Shop')}
                            </Link>

                            <span className="text-gray-300">|</span>

                            <Link
                                href={`/${resolvedLocale}/login`}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                {t('ui.auth.login_button', 'Log in')}
                            </Link>

                            <Link
                                href={`/${resolvedLocale}/register`}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                {t('ui.auth.register_button', 'Register')}
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="pt-4">
                    <FlashMessage />
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex min-h-[calc(100vh-8rem)] items-start justify-center py-6 sm:py-10">
                    <div className="w-full sm:max-w-md overflow-hidden bg-white px-6 py-4 shadow-md sm:rounded-lg">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
