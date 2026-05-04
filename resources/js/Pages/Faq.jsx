import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function FaqItem({ question, answer, open, onToggle }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
                <span className="text-base font-semibold text-gray-900">
                    {question}
                </span>

                <span className="shrink-0 text-xl text-gray-500">
                    {open ? '−' : '+'}
                </span>
            </button>

            {open && (
                <div className="border-t border-gray-100 px-5 py-4 text-sm leading-7 text-gray-700">
                    {answer}
                </div>
            )}
        </div>
    );
}

function FaqSection({ title, items, openIndex, onToggle }) {
    if (!items.length) return null;

    return (
        <section className="space-y-4 first:pt-0 pt-6">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>

            <div className="space-y-3">
                {items.map((item, index) => (
                    <FaqItem
                        key={`${title}-${index}`}
                        question={item.question}
                        answer={item.answer}
                        open={openIndex === index}
                        onToggle={() => onToggle(index)}
                    />
                ))}
            </div>
        </section>
    );
}

export default function Faq() {
    const { locale } = usePage().props;
    const { t } = useI18n();

    const [openMap, setOpenMap] = useState({});
    const [search, setSearch] = useState('');

    const formattedDate = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date());

    const sections = useMemo(() => [
        {
            key: 'orders',
            title: t('ui.faq.sections.orders'),
            items: [
                { question: t('ui.faq.orders.q1'), answer: t('ui.faq.orders.a1') },
                { question: t('ui.faq.orders.q2'), answer: t('ui.faq.orders.a2') },
                { question: t('ui.faq.orders.q3'), answer: t('ui.faq.orders.a3') },
            ],
        },
        {
            key: 'payments',
            title: t('ui.faq.sections.payments'),
            items: [
                { question: t('ui.faq.payments.q1'), answer: t('ui.faq.payments.a1') },
                { question: t('ui.faq.payments.q2'), answer: t('ui.faq.payments.a2') },
            ],
        },
        {
            key: 'shipping',
            title: t('ui.faq.sections.shipping'),
            items: [
                { question: t('ui.faq.shipping.q1'), answer: t('ui.faq.shipping.a1') },
                { question: t('ui.faq.shipping.q2'), answer: t('ui.faq.shipping.a2') },
            ],
        },
        {
            key: 'returns',
            title: t('ui.faq.sections.returns'),
            items: [
                { question: t('ui.faq.returns.q1'), answer: t('ui.faq.returns.a1') },
                { question: t('ui.faq.returns.q2'), answer: t('ui.faq.returns.a2') },
                { question: t('ui.faq.returns.q3'), answer: t('ui.faq.returns.a3') },
            ],
        },
        {
            key: 'account',
            title: t('ui.faq.sections.account'),
            items: [
                { question: t('ui.faq.account.q1'), answer: t('ui.faq.account.a1') },
                { question: t('ui.faq.account.q2'), answer: t('ui.faq.account.a2') },
                { question: t('ui.faq.account.q3'), answer: t('ui.faq.account.a3') },
            ],
        },
        {
            key: 'products',
            title: t('ui.faq.sections.products'),
            items: [
                { question: t('ui.faq.products.q1'), answer: t('ui.faq.products.a1') },
                { question: t('ui.faq.products.q2'), answer: t('ui.faq.products.a2') },
            ],
        },
        {
            key: 'support',
            title: t('ui.faq.sections.support'),
            items: [
                { question: t('ui.faq.support.q1'), answer: t('ui.faq.support.a1') },
                { question: t('ui.faq.support.q2'), answer: t('ui.faq.support.a2') },
            ],
        },
        {
            key: 'accessibility',
            title: t('ui.faq.sections.accessibility'),
            items: [
                { question: t('ui.faq.accessibility.q1'), answer: t('ui.faq.accessibility.a1') },
                { question: t('ui.faq.accessibility.q2'), answer: t('ui.faq.accessibility.a2') },
            ],
        },
    ], [t]);

    // 🔍 FILTER
    const filteredSections = useMemo(() => {
        if (!search.trim()) return sections;

        const term = search.toLowerCase();

        return sections
            .map(section => ({
                ...section,
                items: section.items.filter(item =>
                    item.question.toLowerCase().includes(term) ||
                    item.answer.toLowerCase().includes(term)
                ),
            }))
            .filter(section => section.items.length > 0);
    }, [search, sections]);

    function toggleSectionItem(sectionKey, itemIndex) {
        setOpenMap((prev) => ({
            ...prev,
            [sectionKey]: prev[sectionKey] === itemIndex ? null : itemIndex,
        }));
    }

    const hasResults = filteredSections.length > 0;

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        {t('ui.faq.title')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {t('ui.faq.last_updated')} {formattedDate}
                    </p>
                </div>
            }
        >
            <Head title={t('ui.footer.faq', 'FAQ')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="p-6 sm:p-8">
                            <div className="mx-auto max-w-4xl space-y-10">

                                {/* INTRO */}
                                <div className="rounded-xl bg-gray-50 p-5 text-sm leading-7 text-gray-700">
                                    {t('ui.faq.intro')}
                                </div>

                                {/* 🔍 SEARCH */}
                                <div>
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t('ui.faq.search', 'Search FAQ...')}
                                        className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                                    />
                                </div>

                                {/* CONTENT */}
                                {hasResults ? (
                                    filteredSections.map((section) => (
                                        <FaqSection
                                            key={section.key}
                                            title={section.title}
                                            items={section.items}
                                            openIndex={openMap[section.key] ?? null}
                                            onToggle={(itemIndex) =>
                                                toggleSectionItem(section.key, itemIndex)
                                            }
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-10">
                                        <div className="text-lg font-semibold text-gray-900">
                                            {t('ui.faq.no_results_title')}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-500">
                                            {t('ui.faq.no_results_text')}
                                        </div>
                                    </div>
                                )}

                                {/* SUPPORT */}
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm leading-7 text-gray-700">
                                    <p className="font-semibold text-gray-900">
                                        {t('ui.faq.still_need_help_title')}
                                    </p>
                                    <p className="mt-2">
                                        {t('ui.faq.still_need_help_text')}
                                    </p>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
