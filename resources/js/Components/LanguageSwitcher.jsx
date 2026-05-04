import { usePage, router } from '@inertiajs/react';

export default function LanguageSwitcher() {
    const { locale, locales } = usePage().props;
    const url = usePage().url; // ex: "/pt/profile?x=1"

    const switchTo = (newLocale) => {
        if (newLocale === locale) return;

        // remove query string
        const [path, query] = url.split('?');

        // troca o primeiro segmento (locale)
        const parts = path.split('/').filter(Boolean); // ["pt","profile"]
        if (parts.length === 0) {
            router.visit(`/${newLocale}`);
            return;
        }

        parts[0] = newLocale; // substitui "pt" por "en"
        const next = `/${parts.join('/')}${query ? `?${query}` : ''}`;

        router.visit(next, { preserveScroll: true });
    };

    return (
        <div className="flex items-center gap-2">
            {locales?.map((l) => (
                <button
                    key={l.code}
                    type="button"
                    onClick={() => switchTo(l.code)}
                    className={
                        "rounded-md px-2 py-1 text-sm border " +
                        (l.code === locale
                            ? "border-gray-900 text-gray-900"
                            : "border-gray-200 text-gray-600 hover:text-gray-900")
                    }
                    title={l.label}
                >
                    <span className="mr-1">{l.flag}</span>
                    {l.code.toUpperCase()}
                </button>
            ))}
        </div>
    );
}
