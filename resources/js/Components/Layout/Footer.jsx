import { Link, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import Logo from "@/images/psique-inclusiva-online.jpg";
import ComplaintsBookImage from "@/images/livro-reclamacoes.png";

function FooterSection({ title, children }) {
    return (
        <div className="text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                {title}
            </h3>
            <div className="mt-4 flex flex-col items-center gap-3">
                {children}
            </div>
        </div>
    );
}

function FooterLink({ href, children, external = false }) {
    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-600 transition hover:text-gray-900 text-center"
            >
                {children}
            </a>
        );
    }

    return (
        <Link
            href={href}
            className="block text-sm text-gray-600 transition hover:text-gray-900 text-center"
        >
            {children}
        </Link>
    );
}

export default function Footer() {
    const page = usePage();
    const { auth, locale, cart } = page.props;
    const { t } = useI18n();

    const user = auth?.user ?? null;
    const cartCount = Number.isFinite(cart?.count) ? cart.count : 0;

    const year = new Date().getFullYear();

    const shopLinks = [
        {
            key: "home",
            label: t("ui.nav.home", "Home"),
            href: `/${locale}`,
            show: true,
        },
        {
            key: "shop",
            label: t("ui.nav.shop", "Shop"),
            href: `/${locale}/shop`,
            show: true,
        },
        {
            key: "cart",
            label:
                cartCount > 0
                    ? `${t("ui.nav.cart", "Cart")} (${cartCount})`
                    : t("ui.nav.cart", "Cart"),
            href: `/${locale}/cart`,
            show: !!user,
        },
        {
            key: "wishlist",
            label: t("ui.wishlist.title", "Wishlist"),
            href: route("wishlist.index", { locale }),
            show: !!user,
        },
        {
            key: "donations",
            label: t("ui.donations.button", "Donativos"),
            href: route("donations", { locale }),
            show: true,
        },
    ];

    const accountLinks = [
        {
            key: "dashboard",
            label: t("ui.common.dashboard", "Dashboard"),
            href: route("dashboard", { locale }),
            show: !!user,
        },
        {
            key: "profile",
            label: t("ui.common.profile", "Profile"),
            href: route("profile.edit", { locale }),
            show: !!user,
        },
    ];

    const infoLinks = [
        {
            key: "terms",
            label: t("ui.footer.terms", "Terms & Conditions"),
            href: `/${locale}/terms`,
        },
        {
            key: "privacy",
            label: t("ui.footer.privacy", "Privacy Policy"),
            href: `/${locale}/privacy`,
        },
        {
            key: "faq",
            label: t("ui.footer.faq", "FAQ"),
            href: `/${locale}/faq`,
        },
        {
            key: "disputes",
            label: t("ui.disputes.title", "Dispute Resolution"),
            href: `/${locale}/disputes`,
        },
        {
            key: "shipping_returns",
            label: t("ui.shipping_returns.title", "Shipping & Returns"),
            href: `/${locale}/shipping-returns`,
        },
    ];

    return (
        <footer className="border-t border-gray-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-10 text-center md:grid-cols-2 xl:grid-cols-4">

                    {/* BRAND */}
                    <div className="flex flex-col items-center">
                        <Link href={`/${locale}`} className="flex justify-center">
                            <img
                                src={Logo}
                                alt="Psique Inclusiva Online"
                                className="h-20 w-auto object-contain"
                            />
                        </Link>

                        <p className="mt-4 max-w-sm text-center text-sm leading-6 text-gray-600">
                            {t(
                                "ui.footer.brand_text",
                                "Inclusive products, services and experiences, with a clean and accessible shopping experience."
                            )}
                        </p>

                        <div className="mt-4 text-center text-sm text-gray-500">
                            {t("ui.footer.support_email_label", "Support")}:{" "}
                            <a
                                href="mailto:contacto@psiqueinclusivaonline.pt"
                                className="font-medium text-gray-700 hover:text-gray-900"
                            >
                                contacto@psiqueinclusivaonline.pt
                            </a>
                        </div>
                    </div>

                    {/* SHOP */}
                    <FooterSection title={t("ui.footer.shop", "Shop")}>
                        {shopLinks
                            .filter((item) => item.show)
                            .map((item) => (
                                <FooterLink key={item.key} href={item.href}>
                                    {item.label}
                                </FooterLink>
                            ))}
                    </FooterSection>

                    {/* ACCOUNT */}
                    <FooterSection title={t("ui.footer.account", "Account")}>
                        {accountLinks
                            .filter((item) => item.show)
                            .map((item) => (
                                <FooterLink key={item.key} href={item.href}>
                                    {item.label}
                                </FooterLink>
                            ))}
                    </FooterSection>

                    {/* INFO */}
                    <FooterSection title={t("ui.footer.information", "Information")}>
                        {infoLinks.map((item) => (
                            <FooterLink key={item.key} href={item.href}>
                                {item.label}
                            </FooterLink>
                        ))}

                        <a
                            href="https://www.livroreclamacoes.pt/pedido/reclamacao"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pt-2"
                            aria-label={t("ui.footer.complaints_book", "Livro de Reclamações")}
                        >
                            <img
                                src={ComplaintsBookImage}
                                alt={t("ui.footer.complaints_book", "Livro de Reclamações")}
                                className="h-auto w-44 max-w-full object-contain transition hover:opacity-90"
                            />
                        </a>
                    </FooterSection>
                </div>

                {/* LEGAL INFO */}
                <div className="mt-10 border-t border-gray-100 pt-6 text-center text-xs text-gray-500 space-y-2">
                    <div>
                        © {year} Mentemovimento – Associação.{" "}
                        {t("ui.footer.rights", "All rights reserved.")}
                    </div>

                    <div>
                        NIF 514123176 · Praça Barbezieux, 2359, 3700-055 S. João da Madeira
                    </div>

                    <div>
                        contacto@psiqueinclusivaonline.pt · +351 962146424
                    </div>

                    <div>
                        {t("ui.footer.author")}{" "}
                        <a
                            href="https://github.com/Masdrabo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-700 hover:text-gray-900 underline"
                        >
                            Ricardo Oliveira
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
