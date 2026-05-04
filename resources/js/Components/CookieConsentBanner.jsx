import { useEffect, useMemo, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

const STORAGE_KEY = 'cookie_consent_v1';

function readStoredConsent() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.essential === 'boolean' &&
            typeof parsed.optional === 'boolean'
        ) {
            return parsed;
        }

        return null;
    } catch {
        return null;
    }
}

function writeStoredConsent(value) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                essential: true,
                optional: !!value.optional,
                updatedAt: new Date().toISOString(),
            })
        );
    } catch {
        // ignore storage errors
    }
}

export function getCookieConsent() {
    return readStoredConsent();
}

export default function CookieConsentBanner() {
    const page = usePage();
    const { locale } = page.props;
    const { t } = useI18n();

    const [mounted, setMounted] = useState(false);
    const [consent, setConsent] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const stored = readStoredConsent();
        setConsent(stored);
        setMounted(true);
        setVisible(!stored);
    }, []);

    const hasDecision = useMemo(() => !!consent, [consent]);

    function acceptAll() {
        const next = { essential: true, optional: true };
        writeStoredConsent(next);
        setConsent(next);
        setVisible(false);
    }

    function rejectOptional() {
        const next = { essential: true, optional: false };
        writeStoredConsent(next);
        setConsent(next);
        setVisible(false);
    }

    function reopenBanner() {
        setVisible(true);
    }

    if (!mounted) return null;

    return (
        <>
            {visible && (
                <div className="fixed inset-x-0 bottom-0 z-[1300] px-4 pb-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                        <div className="p-5 sm:p-6">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-3xl">
                                    <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                                        {t('ui.cookies.title', {}, 'Cookies')}
                                    </h2>

                                    <p className="mt-2 text-sm leading-6 text-gray-600">
                                        {t(
                                            'ui.cookies.description',
                                            {},
                                            'We use essential cookies to keep the website working correctly and optional cookies to improve the experience. You can accept or reject optional cookies.'
                                        )}
                                    </p>

                                    <p className="mt-3 text-xs leading-5 text-gray-500">
                                        {t('ui.cookies.essential_notice', {}, 'Essential cookies are always active.')}{' '}
                                        <Link
                                            href={`/${locale}/privacy`}
                                            className="font-medium text-gray-700 underline hover:text-gray-900"
                                        >
                                            {t('ui.footer.privacy', {}, 'Privacy Policy')}
                                        </Link>
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                                    <button
                                        type="button"
                                        onClick={rejectOptional}
                                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                    >
                                        {t('ui.cookies.reject', {}, 'Reject optional')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={acceptAll}
                                        className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                                    >
                                        {t('ui.cookies.accept', {}, 'Accept all')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {hasDecision && !visible && (
                <button
                    type="button"
                    onClick={reopenBanner}
                    className="fixed bottom-4 left-4 z-50 inline-flex min-h-[52px] items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-700 hover:bg-gray-800 focus:ring-gray-500 sm:bottom-6 sm:left-6"
                    aria-label={t('ui.cookies.manage', {}, 'Manage cookies')}
                >
                    <span>{t('ui.cookies.manage', {}, 'Manage cookies')}</span>
                </button>
            )}
        </>
    );
}
