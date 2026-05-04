import { Link } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";

function normalizeLabel(label, t) {
    if (!label) return "";

    const clean = label
        .replace(/&laquo;|«/g, "")
        .replace(/&raquo;|»/g, "")
        .replace(/<[^>]+>/g, "")
        .trim()
        .toLowerCase();

    if (clean.includes("previous")) {
        return t("ui.pagination.previous", "Previous");
    }

    if (clean.includes("next")) {
        return t("ui.pagination.next", "Next");
    }

    return label.replace(/<[^>]+>/g, "").trim();
}

export default function PaginationLinks({
    links = [],
    variant = "default", // default | compact | centered | inline
}) {
    const { t } = useI18n();

    if (!links.length) return null;

    const baseClasses =
        variant === "compact"
            ? "px-2 py-1 text-xs"
            : "px-3 py-1.5 text-sm";

    const wrapperClasses =
        variant === "centered"
            ? "mt-6 flex flex-wrap justify-center gap-2"
            : variant === "inline"
            ? "flex flex-wrap items-center gap-2"
            : "mt-6 flex flex-wrap gap-2";

    return (
        <div className={wrapperClasses}>
            {links.map((link, index) => {
                const disabled = !link.url;
                const label = normalizeLabel(link.label, t);

                return (
                    <Link
                        key={`${index}-${label}`}
                        href={link.url ?? "#"}
                        preserveScroll
                        preserveState
                        className={[
                            "rounded-md border transition",
                            baseClasses,
                            link.active
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                            disabled ? "pointer-events-none opacity-50" : "",
                        ].join(" ")}
                    >
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
