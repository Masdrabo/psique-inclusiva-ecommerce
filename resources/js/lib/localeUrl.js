import { usePage } from "@inertiajs/react";

export function useLocaleUrl() {

    const { locale } = usePage().props;

    const localeUrl = (path = "/") => {

        // se já começa com /pt ou /en, não duplica
        const parts = path.split("/").filter(Boolean);

        if (parts.length > 0 && parts[0] === locale) {
            return path;
        }

        // garantir barra inicial
        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        return `/${locale}${path}`;
    };

    return { localeUrl, locale };
}
