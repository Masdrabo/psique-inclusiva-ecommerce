import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage, router, } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';


const MIN_DONATION_AMOUNT = 1;
const MAX_DONATION_AMOUNT = 10000;

function normalizeAmountInput(value) {
    const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
    const parts = normalized.split('.');

    if (parts.length <= 2) return normalized;

    return `${parts[0]}.${parts.slice(1).join('')}`;
}

function parseAmount(value) {
    if (value === null || value === undefined || value === '') return null;

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatEuroAmount(value) {
    const parsed = typeof value === 'number' ? value : parseAmount(value);
    if (!Number.isFinite(parsed)) return null;

    return `${parsed.toFixed(2)} €`;
}

function validateDonationAmount(amount, t) {
    if (amount === null) {
        return t('ui.donations.validation.required', 'Escolhe ou introduz um montante.');
    }

    if (!Number.isFinite(amount)) {
        return t('ui.donations.validation.invalid', 'Introduz um montante válido.');
    }

    if (amount <= 0) {
        return t('ui.donations.validation.positive', 'O montante tem de ser superior a 0.');
    }

    if (amount < MIN_DONATION_AMOUNT) {
        return t(
            'ui.donations.validation.min_amount',
            `O montante mínimo é ${MIN_DONATION_AMOUNT.toFixed(2)} €.`
        );
    }

    if (amount > MAX_DONATION_AMOUNT) {
        return t(
            'ui.donations.validation.max_amount',
            `O montante máximo é ${MAX_DONATION_AMOUNT.toFixed(2)} €.`
        );
    }

    return null;
}

export default function Donations() {
    const { props } = usePage();
    const { locale } = props;
    const { t } = useI18n();

    const donationAmounts = [
        { value: 5, label: '5€' },
        { value: 10, label: '10€' },
        { value: 20, label: '20€' },
        { value: 50, label: '50€' },
    ];

    const donationGuideImages = [
        {
            src: '/images/donations/recibo.jpg',
            alt: t(
                'ui.donations.guides.receipt_alt',
                'Recibo do donativo para saúde mental'
            ),
            title: t(
                'ui.donations.guides.receipt_title',
                'Recibo do donativo'
            ),
            description: t(
                'ui.donations.guides.receipt_description',
                'Informação sobre recibo e benefícios fiscais associados ao donativo.'
            ),
        },
        {
            src: '/images/donations/donativo.jpg',
            alt: t(
                'ui.donations.guides.mbway_alt',
                'Como enviar um donativo por MB WAY'
            ),
            title: t(
                'ui.donations.guides.mbway_title',
                'Como doar'
            ),
            description: t(
                'ui.donations.guides.mbway_description',
                'Consulta as instruções para enviar o teu donativo por MB WAY ou outros meios.'
            ),
        },
    ];

    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [paymentMethodCode, setPaymentMethodCode] = useState('ifthenpay_mb');
    const [mbwayPhone, setMbwayPhone] = useState('');

    const selectedNumericAmount = useMemo(() => {
        if (customAmount !== '') return parseAmount(customAmount);
        if (selectedAmount !== null) return Number(selectedAmount);
        return null;
    }, [customAmount, selectedAmount]);

    const validationError = useMemo(() => {
        return validateDonationAmount(selectedNumericAmount, t);
    }, [selectedNumericAmount, t]);

    const activeAmountPreview = useMemo(() => {
        if (validationError) return null;
        if (selectedNumericAmount === null) return null;
        return formatEuroAmount(selectedNumericAmount);
    }, [selectedNumericAmount, validationError]);

    const isDonationValid = !validationError;

    const mbwayPhoneError =
        paymentMethodCode === 'ifthenpay_mbway' && mbwayPhone.replace(/\D+/g, '').length !== 9
            ? 'Introduz um número MB WAY português válido com 9 dígitos.'
            : null;

    const canSubmitDonation = isDonationValid && !mbwayPhoneError;

    const impactItems = [
        {
            title: t('ui.donations.impact.secure_platform_title', 'Ajuda a manter a plataforma'),
            description: t(
                'ui.donations.impact.secure_platform_description',
                'O teu contributo ajuda-nos a manter a loja, melhorar funcionalidades e garantir uma melhor experiência para todos.'
            ),
        },
        {
            title: t('ui.donations.impact.improve_project_title', 'Permite continuar a evoluir o projeto'),
            description: t(
                'ui.donations.impact.improve_project_description',
                'Os donativos ajudam no desenvolvimento contínuo, na manutenção técnica e na criação de novas funcionalidades.'
            ),
        },
        {
            title: t('ui.donations.impact.community_title', 'Contribui para a comunidade'),
            description: t(
                'ui.donations.impact.community_description',
                'Cada apoio é uma forma de fortalecer este projeto e apoiar o seu crescimento a longo prazo.'
            ),
        },
    ];

    const handlePresetAmountClick = (value) => {
        setSelectedAmount(value);
        setCustomAmount('');
        setHasTriedSubmit(false);
    };

    const handleCustomAmountChange = (event) => {
        const normalized = normalizeAmountInput(event.target.value);
        setCustomAmount(normalized);
        setSelectedAmount(null);
    };

    const handleDonateClick = () => {
        setHasTriedSubmit(true);

        if (!canSubmitDonation) return;

        router.post(`/${locale}/donativos`, {
            amount: selectedNumericAmount,
            payment_method_code: paymentMethodCode,
            donor_name: null,
            donor_email: null,
            donor_phone: paymentMethodCode === 'ifthenpay_mbway' ? mbwayPhone : null,
            phone: paymentMethodCode === 'ifthenpay_mbway' ? mbwayPhone : null,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {t('ui.donations.title', 'Donativos')}
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                            {t(
                                'ui.donations.subtitle',
                                'Ajuda-nos a continuar a melhorar este projeto com o teu apoio.'
                            )}
                        </p>
                    </div>

                    <Link
                        href={`/${locale}`}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                        {t('ui.donations.back_home', 'Voltar ao início')}
                    </Link>
                </div>
            }
        >
            <Head title={t('ui.donations.meta_title', 'Donativos')} />

            <div className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-xl">
                        <div className="grid gap-8 px-6 py-10 text-white sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-14">
                            <div className="flex flex-col justify-center">
                                <span className="mb-3 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                    {t('ui.donations.hero_badge', 'Apoio ao projeto')}
                                </span>

                                <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                                    {t('ui.donations.hero_title', 'O teu apoio faz a diferença')}
                                </h2>

                                <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                                    {t(
                                        'ui.donations.hero_description',
                                        'Se gostas deste projeto e queres ajudar na sua evolução, podes contribuir através de um donativo. Todo o apoio ajuda a melhorar a plataforma, manter a infraestrutura e desenvolver novas funcionalidades.'
                                    )}
                                </p>

                                <div className="mt-6 flex flex-wrap gap-3">
                                    <a
                                        href="#opcoes-donativo"
                                        className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                    >
                                        {t('ui.donations.hero_cta_primary', 'Ver opções de donativo')}
                                    </a>

                                    <a
                                        href="#porque-doar"
                                        className="inline-flex items-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                    >
                                        {t('ui.donations.hero_cta_secondary', 'Saber mais')}
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center justify-center">
                                <div className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                className="h-6 w-6"
                                            >
                                                <path d="M12 21a1 1 0 01-.707-.293l-6.5-6.5a4.5 4.5 0 116.364-6.364L12 8.686l.843-.843a4.5 4.5 0 116.364 6.364l-6.5 6.5A1 1 0 0112 21z" />
                                            </svg>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {t('ui.donations.card_title', 'Apoiar este projeto')}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {t(
                                                    'ui.donations.card_subtitle',
                                                    'Escolhe um valor simbólico para contribuir.'
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        {donationAmounts.map((amount) => {
                                            const isActive =
                                                selectedAmount === amount.value && customAmount === '';

                                            return (
                                                <button
                                                    key={amount.value}
                                                    type="button"
                                                    onClick={() => handlePresetAmountClick(amount.value)}
                                                    className={[
                                                        'rounded-xl border px-4 py-3 text-sm font-semibold transition',
                                                        isActive
                                                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100',
                                                    ].join(' ')}
                                                >
                                                    {amount.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-5">
                                        <label
                                            htmlFor="custom-donation-amount"
                                            className="mb-2 block text-sm font-semibold text-gray-800"
                                        >
                                            {t('ui.donations.custom_amount_label', 'Ou introduz um valor personalizado')}
                                        </label>

                                        <div className="relative">
                                            <input
                                                id="custom-donation-amount"
                                                type="text"
                                                inputMode="decimal"
                                                value={customAmount}
                                                onChange={handleCustomAmountChange}
                                                placeholder={t('ui.donations.custom_amount_placeholder', 'Ex.: 15')}
                                                className={[
                                                    'w-full rounded-xl border px-4 py-3 pr-12 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400',
                                                    hasTriedSubmit && validationError
                                                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                                        : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200',
                                                ].join(' ')}
                                                aria-label={t(
                                                    'ui.donations.custom_amount_label',
                                                    'Ou introduz um valor personalizado'
                                                )}
                                            />
                                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-gray-500">
                                                €
                                            </span>
                                        </div>

                                        <p className="mt-2 text-xs text-gray-500">
                                            {t(
                                                'ui.donations.custom_amount_hint',
                                                'Podes escrever o montante que desejares.'
                                            )}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500">
                                            {t(
                                                'ui.donations.custom_amount_limits',
                                                `Montante mínimo: ${MIN_DONATION_AMOUNT.toFixed(2)} € | máximo: ${MAX_DONATION_AMOUNT.toFixed(2)} €.`
                                            )}
                                        </p>
                                    </div>

                                    {hasTriedSubmit && validationError ? (
                                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {validationError}
                                        </div>
                                    ) : null}

                                    {activeAmountPreview ? (
                                        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                            <span className="font-semibold">
                                                {t('ui.donations.selected_amount', 'Montante selecionado')}:
                                            </span>{' '}
                                            {activeAmountPreview}
                                        </div>
                                    ) : null}

                                    <div className="mt-5">
                                        <label className="mb-2 block text-sm font-semibold text-gray-800">
                                            Método de pagamento
                                        </label>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethodCode('ifthenpay_mb')}
                                                className={[
                                                    'rounded-xl border px-4 py-3 text-sm font-semibold transition',
                                                    paymentMethodCode === 'ifthenpay_mb'
                                                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
                                                ].join(' ')}
                                            >
                                                Multibanco
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethodCode('ifthenpay_mbway')}
                                                className={[
                                                    'rounded-xl border px-4 py-3 text-sm font-semibold transition',
                                                    paymentMethodCode === 'ifthenpay_mbway'
                                                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
                                                ].join(' ')}
                                            >
                                                MB WAY
                                            </button>
                                        </div>
                                    </div>

                                    {paymentMethodCode === 'ifthenpay_mbway' ? (
                                        <div className="mt-5">
                                            <label
                                                htmlFor="mbway-phone"
                                                className="mb-2 block text-sm font-semibold text-gray-800"
                                            >
                                                Telemóvel MB WAY
                                            </label>

                                            <input
                                                id="mbway-phone"
                                                type="tel"
                                                inputMode="numeric"
                                                value={mbwayPhone}
                                                onChange={(event) => setMbwayPhone(event.target.value.replace(/\D+/g, '').slice(0, 9))}
                                                placeholder="Ex.: 912345678"
                                                className={[
                                                    'w-full rounded-xl border px-4 py-3 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400',
                                                    hasTriedSubmit && mbwayPhoneError
                                                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                                        : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200',
                                                ].join(' ')}
                                            />

                                            {hasTriedSubmit && mbwayPhoneError ? (
                                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                    {mbwayPhoneError}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                                        <p className="text-sm text-gray-700">
                                            {t(
                                                'ui.donations.card_notice',
                                                'Nesta fase, esta página pode funcionar como apresentação institucional do sistema de donativos. No passo seguinte, podemos ligar aqui Stripe, PayPal ou outro método de pagamento.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-6">
                                        <button
                                            type="button"
                                            onClick={handleDonateClick}
                                            disabled={!canSubmitDonation}
                                            className={[
                                                'inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition',
                                                canSubmitDonation
                                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                                    : 'cursor-not-allowed bg-gray-400',
                                            ].join(' ')}
                                        >
                                            {t('ui.donations.donate_now', 'Doar agora')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mt-10">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {t('ui.donations.guides.section_title', 'Como contribuir')}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">
                                {t(
                                    'ui.donations.guides.section_description',
                                    'Consulta estas imagens para veres como doar e como funciona a emissão do recibo.'
                                )}
                            </p>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            {donationGuideImages.map((image) => (
                                <div
                                    key={image.src}
                                    className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpandedImage(image)}
                                        className="group block w-full text-left"
                                    >
                                        <div className="flex h-[420px] items-center justify-center overflow-hidden p-4 sm:p-5">
                                            <img
                                                src={image.src}
                                                alt={image.alt}
                                                className="max-h-full max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.01]"
                                            />
                                        </div>
                                    </button>

                                    <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {image.title}
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">
                                            {image.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* <section id="porque-doar" className="mt-10 grid gap-6 lg:grid-cols-3">
                        {impactItems.map((item) => (
                            <div
                                key={item.title}
                                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-6 w-6"
                                    >
                                        <path d="M11.7 2.805a.75.75 0 01.6 0l7.5 3a.75.75 0 01.45.696V12a9.75 9.75 0 01-7.19 9.406.75.75 0 01-.42 0A9.75 9.75 0 014.75 12V6.5a.75.75 0 01.45-.696l7.5-3z" />
                                    </svg>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>

                                <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                            </div>
                        ))}
                    </section>

                    <section
                        id="opcoes-donativo"
                        className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8"
                    >
                        <div className="max-w-3xl">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {t('ui.donations.options_title', 'Opções de donativo')}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
                                {t(
                                    'ui.donations.options_description',
                                    'Podes começar com uma secção simples de apoio ao projeto e, mais tarde, integrar um sistema real de pagamentos com confirmação, histórico e agradecimento automático.'
                                )}
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-gray-200 p-5">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {t('ui.donations.option_one_title', 'Donativo simples')}
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    {t(
                                        'ui.donations.option_one_description',
                                        'Valor único, rápido e direto, ideal para quem quer apoiar de forma simples.'
                                    )}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 p-5">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {t('ui.donations.option_two_title', 'Valor personalizado')}
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    {t(
                                        'ui.donations.option_two_description',
                                        'Possibilidade de o utilizador escolher livremente quanto deseja contribuir.'
                                    )}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 p-5">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {t('ui.donations.option_three_title', 'Integração futura')}
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    {t(
                                        'ui.donations.option_three_description',
                                        'Preparado para evoluir com gateways como Stripe, PayPal ou referências de pagamento.'
                                    )}
                                </p>
                            </div>
                        </div>
                    </section> */}

                    <section className="mt-10 rounded-2xl bg-gray-900 px-6 py-8 text-white shadow-lg sm:px-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-2xl">
                                <h2 className="text-2xl font-bold">
                                    {t(
                                        'ui.donations.cta_title',
                                        'Obrigado por considerares apoiar este projeto'
                                    )}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-gray-300 sm:text-base">
                                    {t(
                                        'ui.donations.cta_description',
                                        'Mesmo um pequeno contributo pode ajudar bastante no crescimento, manutenção e melhoria contínua da plataforma.'
                                    )}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                                >
                                    {t('ui.donations.cta_button', 'Quero apoiar')}
                                </button>

                                <Link
                                    href={`/${locale}/shop`}
                                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                >
                                    {t('ui.donations.cta_secondary_button', 'Continuar na loja')}
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {expandedImage ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setExpandedImage(null)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-6xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setExpandedImage(null)}
                            aria-label={t('ui.donations.guides.close_modal', 'Fechar imagem')}
                            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800 shadow hover:bg-white"
                        >
                            {t('ui.donations.guides.close_button', 'Fechar')}
                        </button>

                        <img
                            src={expandedImage.src}
                            alt={expandedImage.alt}
                            className="max-h-[90vh] w-auto max-w-full rounded-2xl shadow-2xl"
                        />
                    </div>
                </div>
            ) : null}
        </AuthenticatedLayout>
    );
}
