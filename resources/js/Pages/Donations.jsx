import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage, router } from '@inertiajs/react';
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

    const receiptImage = {
        src: '/images/donations/recibo.jpg',
        alt: t(
            'ui.donations.guides.receipt_alt',
            'Recibo do donativo para saúde mental'
        ),
    };

    const mbwayImage = {
        src: '/images/donations/donativo.jpg',
        alt: t(
            'ui.donations.guides.mbway_alt',
            'Como enviar um donativo por MB WAY'
        ),
    };

    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [paymentMethodCode, setPaymentMethodCode] = useState('ifthenpay_mbway');
    const [mbwayPhone, setMbwayPhone] = useState('');
    const [ibanCopied, setIbanCopied] = useState(false);

    const ibanFormatted = 'PT50 0036 0367 9910 6033 18907';
    const ibanPlain = 'PT50003603679910603318907';

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

    const handleCopyIban = async () => {
        await navigator.clipboard.writeText(ibanPlain);
        setIbanCopied(true);

        setTimeout(() => {
            setIbanCopied(false);
        }, 2000);
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
                    <section className="mb-10">
                        <div className="w-full overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
                            <img
                                src={mbwayImage.src}
                                alt={mbwayImage.alt}
                                className="mx-auto max-h-[620px] w-full rounded-xl object-contain"
                            />

                            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <code className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
                                    {ibanFormatted}
                                </code>

                                <button
                                    type="button"
                                    onClick={handleCopyIban}
                                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                >
                                    {ibanCopied ? 'IBAN copiado!' : 'Copiar IBAN'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-xl">
                        <div className="grid gap-8 px-6 py-10 text-white sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-14">
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => setExpandedImage(receiptImage)}
                                    className="block w-full max-w-xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl transition hover:scale-[1.01] sm:p-5"
                                >
                                    <img
                                        src={receiptImage.src}
                                        alt={receiptImage.alt}
                                        className="max-h-[520px] w-full rounded-xl object-contain"
                                    />
                                </button>
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
                                            />
                                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-gray-500">
                                                €
                                            </span>
                                        </div>
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
                                <a
                                    href="https://mentemovimento.pt/em-que-posso-ajudar/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                                >
                                    {t('ui.donations.cta_button', 'Quero apoiar')}
                                </a>

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
