import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import FlashMessage from '@/Components/FlashMessage';
import FloatingCartDrawer from '@/Components/Cart/FloatingCartDrawer';
import FloatingAdminHelperDrawer from '@/Components/AdminHelper/FloatingAdminHelperDrawer';
import SearchBar from '@/Components/Shop/SearchBar';
import Footer from '@/Components/Layout/Footer';
import CookieConsentBanner from '@/Components/CookieConsentBanner';
import { Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import Logo from '@/images/psique-inclusiva-online.jpg';

function SearchIcon({ className = 'h-5 w-5' }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            />
        </svg>
    );
}

export default function AuthenticatedLayout({ header, headerActions = null, children }) {
    const page = usePage();
    const { auth, locale, cart } = page.props;
    const { url } = page;

    const user = auth?.user ?? null;
    const role = user?.role ?? null;

    const { t } = useI18n();
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    const cartCount = useMemo(() => {
        const parsed = Number(cart?.count);
        return Number.isFinite(parsed) ? parsed : 0;
    }, [cart?.count]);

    const canSeeCart = !!user;
    const canSeeManager = role === 'admin' || role === 'manager';
    const canSeeAdmin = role === 'admin';

    const isShop = url.startsWith(`/${locale}/shop`);
    const isCart = url.startsWith(`/${locale}/cart`);
    const isManager = url.startsWith(`/${locale}/manager`);
    const isAdmin = url.startsWith(`/${locale}/admin`);
    const isDashboard = url.startsWith(`/${locale}/dashboard`);
    const isWishlist = url.startsWith(`/${locale}/wishlist`);
    const isDonations = url.startsWith(`/${locale}/donativos`);
    const isPurpose = url.startsWith(`/${locale}/proposito`);

    const showHeaderSearch = isShop || isCart || isDashboard || isWishlist;

    const navLinks = [
        {
            key: 'mentemovimento',
            label: t('ui.nav.mentemovimento', {}, 'MenteMovimento'),
            href: 'https://mentemovimento.pt',
            active: false,
            show: true,
            external: true,
        },
        {
            key: 'shop',
            label: t('ui.nav.shop', {}, 'Shop'),
            href: `/${locale}/shop`,
            active: isShop,
            show: true,
        },
        {
            key: 'purpose',
            label: t('ui.nav.purpose', {}, 'Propósito'),
            href: route('purpose.index', { locale }),
            active: isPurpose,
            show: true,
        },
        {
            key: 'cart',
            label: t('ui.nav.cart', {}, 'Cart'),
            href: `/${locale}/cart`,
            active: isCart,
            show: canSeeCart,
            badge: cartCount,
        },
        {
            key: 'wishlist',
            label: t('ui.wishlist.title', {}, 'Wishlist'),
            href: route('wishlist.index', { locale }),
            active: isWishlist,
            show: !!user,
        },
        {
            key: 'manager',
            label: t('ui.nav.manager', {}, 'Manager'),
            href: `/${locale}/manager`,
            active: isManager,
            show: canSeeManager,
        },
        {
            key: 'admin',
            label: t('ui.nav.admin', {}, 'Admin'),
            href: `/${locale}/admin`,
            active: isAdmin,
            show: canSeeAdmin,
        },
        {
            key: 'dashboard',
            label: t('ui.common.dashboard', {}, 'Dashboard'),
            href: route('dashboard', { locale }),
            active: isDashboard,
            show: !!user,
        },
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="relative z-30 border-b border-gray-100 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex min-w-0 items-center">
                            <div className="flex shrink-0 items-center">
                                <Link href={`/${locale}`} className="flex items-center gap-3">
                                    <img
                                        src={Logo}
                                        alt="Psique Inclusiva"
                                        className="block h-10 w-auto"
                                    />
                                </Link>
                            </div>

                            <div className="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex">
                                {navLinks
                                    .filter((l) => l.show)
                                    .map((l) =>
                                        l.external ? (
                                            <a
                                                key={l.key}
                                                href={l.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium leading-5 text-gray-500 transition duration-150 ease-in-out hover:border-gray-300 hover:text-gray-700 focus:outline-none focus:border-gray-300 focus:text-gray-700"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    {l.label}
                                                    {typeof l.badge === 'number' && l.badge > 0 && (
                                                        <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                                                            {l.badge}
                                                        </span>
                                                    )}
                                                </span>
                                            </a>
                                        ) : (
                                            <NavLink key={l.key} href={l.href} active={l.active}>
                                                <span className="inline-flex items-center gap-2">
                                                    {l.label}
                                                    {typeof l.badge === 'number' && l.badge > 0 && (
                                                        <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                                                            {l.badge}
                                                        </span>
                                                    )}
                                                </span>
                                            </NavLink>
                                        )
                                    )}
                            </div>
                        </div>

                        <div className="hidden gap-3 sm:ms-6 sm:flex sm:items-center">
                            <LanguageSwitcher />

                            {!user ? (
                                <div className="flex items-center gap-3">
                                    <Link
                                        href={`/${locale}/login`}
                                        className="rounded-md text-sm font-medium text-gray-600 hover:text-gray-900"
                                    >
                                        {t('ui.auth.login_button', {}, 'Log in')}
                                    </Link>

                                    <Link
                                        href={`/${locale}/register`}
                                        className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                    >
                                        {t('ui.auth.register_button', {}, 'Register')}
                                    </Link>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Dropdown>
                                        <Dropdown.Trigger>
                                            <span className="inline-flex rounded-md">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center rounded-md border border-transparent bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-500 transition duration-150 ease-in-out hover:text-gray-700 focus:outline-none"
                                                >
                                                    {user.name}
                                                    <svg
                                                        className="-me-0.5 ms-2 h-4 w-4"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </button>
                                            </span>
                                        </Dropdown.Trigger>

                                        <Dropdown.Content>
                                            <Dropdown.Link href={route('profile.edit', { locale })}>
                                                {t('ui.common.profile', {}, 'Profile')}
                                            </Dropdown.Link>

                                            <Dropdown.Link
                                                href={route('logout', { locale })}
                                                method="post"
                                                as="button"
                                            >
                                                {t('ui.common.logout', {}, 'Log Out')}
                                            </Dropdown.Link>
                                        </Dropdown.Content>
                                    </Dropdown>
                                </div>
                            )}
                        </div>

                        <div className="-me-2 flex items-center gap-2 sm:hidden">
                            <button
                                type="button"
                                onClick={() => setShowMobileSearch(true)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-500 focus:bg-gray-100 focus:text-gray-500 focus:outline-none"
                                aria-label={t('ui.search.title', {}, 'Search')}
                            >
                                <SearchIcon className="h-5 w-5" />
                            </button>

                            <button
                                onClick={() => setShowingNavigationDropdown((s) => !s)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-500 focus:bg-gray-100 focus:text-gray-500 focus:outline-none"
                            >
                                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path
                                        className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                    <path
                                        className={showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden'}>
                    <div className="space-y-2 px-4 pb-3 pt-2">
                        <div className="pt-2">
                            <LanguageSwitcher />
                        </div>

                        <div className="space-y-1">
                            {navLinks
                                .filter((l) => l.show)
                                .map((l) =>
                                    l.external ? (
                                        <a
                                            key={l.key}
                                            href={l.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                {l.label}
                                                {typeof l.badge === 'number' && l.badge > 0 && (
                                                    <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                                                        {l.badge}
                                                    </span>
                                                )}
                                            </span>
                                        </a>
                                    ) : (
                                        <ResponsiveNavLink key={l.key} href={l.href} active={l.active}>
                                            <span className="inline-flex items-center gap-2">
                                                {l.label}
                                                {typeof l.badge === 'number' && l.badge > 0 && (
                                                    <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                                                        {l.badge}
                                                    </span>
                                                )}
                                            </span>
                                        </ResponsiveNavLink>
                                    )
                                )}
                        </div>

                        {!user && (
                            <div className="space-y-1 border-t border-gray-200 pt-3">
                                <ResponsiveNavLink href={`/${locale}/login`}>
                                    {t('ui.auth.login_button', {}, 'Log in')}
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={`/${locale}/register`}>
                                    {t('ui.auth.register_button', {}, 'Register')}
                                </ResponsiveNavLink>
                            </div>
                        )}
                    </div>

                    {user && (
                        <div className="border-t border-gray-200 pb-1 pt-4">
                            <div className="px-4">
                                <div className="text-base font-medium text-gray-800">{user.name}</div>
                                <div className="text-sm font-medium text-gray-500">{user.email}</div>
                            </div>

                            <div className="mt-3 space-y-1">
                                <ResponsiveNavLink href={route('profile.edit', { locale })}>
                                    {t('ui.common.profile', {}, 'Profile')}
                                </ResponsiveNavLink>

                                <ResponsiveNavLink
                                    method="post"
                                    href={route('logout', { locale })}
                                    as="button"
                                >
                                    {t('ui.common.logout', {}, 'Log Out')}
                                </ResponsiveNavLink>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {showMobileSearch && (
                <div className="fixed inset-0 z-[1200] bg-black/40 sm:hidden">
                    <div className="absolute inset-x-0 top-0 bg-white p-4 shadow-xl">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <SearchBar locale={locale} t={t} />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowMobileSearch(false)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                aria-label={t('ui.common.close', {}, 'Close')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="absolute inset-0 -z-10 h-full w-full cursor-default"
                        onClick={() => setShowMobileSearch(false)}
                        aria-label={t('ui.common.close', {}, 'Close')}
                    />
                </div>
            )}

            <FlashMessage />

            {header && (
                <header className="bg-white shadow">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        {showHeaderSearch ? (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,520px)_minmax(0,1fr)] xl:items-start">
                                <div className="min-w-0">{header}</div>

                                <div className="hidden xl:flex xl:justify-center xl:self-start">
                                    <div className="w-full max-w-[520px]">
                                        <SearchBar locale={locale} t={t} compact />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                    {headerActions}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 flex-1">{header}</div>

                                {headerActions ? (
                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        {headerActions}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </header>
            )}

            <main className="pb-4 sm:pb-8">{children}</main>

            <Footer />

            <CookieConsentBanner />

            {!!user && <FloatingCartDrawer locale={locale} />}
            {!!user && <FloatingAdminHelperDrawer locale={locale} />}

            <Link
                href={route('donations', { locale })}
                aria-label={t('ui.donations.button', {}, 'Donativos')}
                className={[
                    'fixed bottom-4 right-4 z-50',

                    // 🔥 TAMANHO
                    'inline-flex min-h-[60px] items-center gap-3',
                    'rounded-full px-6 py-4 sm:px-7',

                    // 🔥 TEXTO
                    'text-base font-semibold text-white',

                    // 🔥 VISUAL
                    'shadow-xl transition duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2',

                    'sm:bottom-6 sm:right-6',

                    isDonations
                        ? 'bg-emerald-700 ring-2 ring-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
                ].join(' ')}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5 shrink-0"
                >
                    <path d="M12 21a1 1 0 01-.707-.293l-6.5-6.5a4.5 4.5 0 116.364-6.364L12 8.686l.843-.843a4.5 4.5 0 116.364 6.364l-6.5 6.5A1 1 0 0112 21z" />
                </svg>

                <span>{t('ui.donations.button', {}, 'Donativos')}</span>
            </Link>
        </div>
    );
}
