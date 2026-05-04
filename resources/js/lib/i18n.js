import { usePage } from '@inertiajs/react';

/**
 * i18n PRO para Inertia:
 * - t(key, params?, fallback?)
 * - tc(key, count, params?, fallback?)
 */
export function useI18n() {
    const { translations, locale } = usePage().props;

    const get = (obj, path) => {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => acc?.[part], obj);
    };

    const interpolate = (str, params = {}) => {
        if (typeof str !== 'string') return str;

        return str.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
            const val = params[key];
            return val === undefined || val === null ? `:${key}` : String(val);
        });
    };

    const t = (key, params = {}, fallback = undefined) => {
        // tenta traduções (ex.: ui.auth.login_title)
        const value = get(translations, key);

        // fallback: se não existir, usa fallback ou a própria key
        const resolved =
            typeof value === 'string'
                ? value
                : (fallback ?? key);

        return interpolate(resolved, params);
    };

    /**
     * Pluralização PRO (simples e eficaz):
     * No ficheiro lang podes escrever:
     * 'items' => '{0} Nenhum item|{1} :count item|[2,*] :count itens'
     */
    const tc = (key, count, params = {}, fallback = undefined) => {
        const raw = get(translations, key);

        const str =
            typeof raw === 'string'
                ? raw
                : (fallback ?? key);

        const chosen = choosePluralForm(str, count);

        return interpolate(chosen, { ...params, count });
    };

    return { t, tc, locale };
}

/**
 * Suporta:
 * - "{0} ..."  / "{1} ..." / "[2,*] ..."
 * - fallback: se não tiver regras, devolve a string original
 */
function choosePluralForm(ruleString, count) {
    if (typeof ruleString !== 'string') return ruleString;

    const parts = ruleString.split('|').map(s => s.trim());
    if (parts.length === 1) return ruleString;

    for (const part of parts) {
        const match = part.match(/^(\{(\d+)\}|\[(\d+),(\*|\d+)\])\s*(.*)$/);
        if (!match) continue;

        // {n}
        if (match[2] !== undefined) {
            const n = Number(match[2]);
            if (count === n) return match[5];
        }

        // [a,b] or [a,*]
        if (match[3] !== undefined) {
            const a = Number(match[3]);
            const b = match[4] === '*' ? Infinity : Number(match[4]);
            if (count >= a && count <= b) return match[5];
        }
    }

    // se não bater em nenhuma regra, usa a última parte (comum em [2,*])
    const last = parts[parts.length - 1];
    return last.replace(/^(\{.*?\}|\[.*?\])\s*/, '');
}
