import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents) {
    return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function CopyButton({ value, label, t }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            alert(t('ui.thankyou.copied', 'Copiado!'));
        }
    };

    return (
        <button type="button" onClick={copy} className="mt-2 inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
            {copied ? t('ui.thankyou.copied', 'Copiado!') : label}
        </button>
    );
}

function StatusBadge({ status, t }) {
    if (status === 'paid') {
        return <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{t('ui.statuses.paid', 'Pago')}</span>;
    }

    if (status === 'failed' || status === 'cancelled') {
        return <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{t('ui.statuses.cancelled', 'Cancelado')}</span>;
    }

    return <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{t('ui.thankyou.payment_pending', 'Pagamento pendente')}</span>;
}

function MultibancoDonationBox({ donation, t }) {
    if (donation?.method?.code !== 'ifthenpay_mb') return null;

    return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-lg font-bold text-gray-900">{t('ui.donations.thankyou.mb_title', 'Pagamento por Multibanco')}</h2>

            <p className="mt-2 text-sm leading-6 text-gray-700">
                {t('ui.donations.thankyou.mb_help', 'Usa os dados abaixo para concluir o teu donativo numa caixa Multibanco, homebanking ou app bancária.')}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('ui.thankyou.entity', 'Entidade')}</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{donation.entity || '—'}</div>
                    <CopyButton value={donation.entity} label={t('ui.thankyou.copy_entity', 'Copiar entidade')} t={t} />
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('ui.thankyou.reference', 'Referência')}</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{donation.reference || '—'}</div>
                    <CopyButton value={donation.reference} label={t('ui.thankyou.copy_reference', 'Copiar referência')} t={t} />
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('ui.thankyou.total', 'Total')}</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{formatMoney(donation.amount)}</div>
                </div>
            </div>

            {donation.expires_at ? (
                <div className="mt-4 text-xs text-gray-600">
                    {t('ui.donations.thankyou.expires_at', 'Válido até')}:{' '}
                    <span className="font-semibold">{new Date(donation.expires_at).toLocaleString()}</span>
                </div>
            ) : null}
        </div>
    );
}

function MbwayDonationBox({ donation, t }) {
    if (donation?.method?.code !== 'ifthenpay_mbway') return null;

    return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-bold text-gray-900">{t('ui.donations.thankyou.mbway_title', 'Pagamento por MB WAY')}</h2>

            <p className="mt-2 text-sm leading-6 text-gray-700">
                {t('ui.donations.thankyou.mbway_help', 'Vais receber uma notificação no telemóvel para autorizar o donativo.')}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('ui.thankyou.total', 'Total')}</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{formatMoney(donation.amount)}</div>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('ui.donations.thankyou.request_id', 'Pedido')}</div>
                    <div className="mt-1 break-all text-sm font-semibold text-gray-900">{donation.provider_payment_id || donation.reference || '—'}</div>
                </div>
            </div>

            {donation.expires_at ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    {t('ui.donations.thankyou.mbway_expires_notice', 'O pedido MB WAY expira em poucos minutos. Se expirar, cria um novo donativo.')}
                </div>
            ) : null}
        </div>
    );
}

export default function DonationThankYou() {
    const { locale, donation } = usePage().props;
    const { t } = useI18n();

    useEffect(() => {
        if (donation?.status === 'paid') return;

        const interval = setInterval(() => {
            router.reload({
                only: ['donation'],
                preserveScroll: true,
                preserveState: true,
            });
        }, 15000);

        return () => clearInterval(interval);
    }, [donation?.status]);

    const receiptUrl =
        donation?.id && donation?.public_token
            ? `/${locale}/donativos/${donation.id}/comprovativo?token=${donation.public_token}`
            : null;

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {t('ui.donations.thankyou.title', 'Obrigado pelo teu donativo')}
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {t('ui.donations.thankyou.subtitle', 'Guarda esta página até o pagamento ficar confirmado.')}
                    </p>
                </div>
            }
        >
            <Head title={t('ui.donations.thankyou.meta_title', 'Donativo')} />

            <div className="py-8 sm:py-10">
                <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <StatusBadge status={donation?.status} t={t} />

                                    {donation?.status !== 'paid' ? (
                                        <span className="text-xs text-gray-500">
                                            {t('ui.donations.thankyou.auto_checking', 'A verificar pagamento automaticamente...')}
                                        </span>
                                    ) : null}
                                </div>

                                <h2 className="mt-4 text-3xl font-bold text-gray-900">
                                    {donation?.status === 'paid'
                                        ? t('ui.donations.thankyou.paid_title', 'Donativo confirmado ✅')
                                        : t('ui.donations.thankyou.pending_title', 'Donativo criado')}
                                </h2>

                                <div className="mt-4 space-y-1 text-sm text-gray-700">
                                    <div>
                                        {t('ui.donations.thankyou.number', 'Número')}:{' '}
                                        <span className="font-semibold">{donation?.number || '—'}</span>
                                    </div>

                                    <div>
                                        {t('ui.thankyou.total', 'Total')}:{' '}
                                        <span className="font-semibold">{formatMoney(donation?.amount)}</span>
                                    </div>

                                    <div>
                                        {t('ui.thankyou.method', 'Método')}:{' '}
                                        <span className="font-semibold">{donation?.method?.name || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                                {donation?.status === 'paid' && receiptUrl ? (
                                    <a
                                        href={receiptUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                                    >
                                        {t('ui.donations.thankyou.download_receipt', 'Descarregar comprovativo')}
                                    </a>
                                ) : null}

                                <Link
                                    href={route('donations', { locale })}
                                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                    {t('ui.donations.thankyou.new_donation', 'Fazer novo donativo')}
                                </Link>

                                <Link
                                    href={route('shop.index', { locale })}
                                    className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                >
                                    {t('ui.donations.thankyou.back_shop', 'Voltar à loja')}
                                </Link>
                            </div>
                        </div>
                    </section>

                    {donation?.status === 'paid' ? (
                        <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm leading-7 text-green-800">
                            {t('ui.donations.thankyou.paid_message', 'O teu donativo foi confirmado. Obrigado pelo apoio ao projeto.')}
                        </section>
                    ) : (
                        <>
                            <MultibancoDonationBox donation={donation} t={t} />
                            <MbwayDonationBox donation={donation} t={t} />
                        </>
                    )}

                    <section className="rounded-2xl bg-gray-900 p-6 text-white">
                        <h2 className="text-xl font-bold">
                            {t('ui.donations.thankyou.final_title', 'Obrigado por apoiares a MenteMovimento')}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-gray-300">
                            {t('ui.donations.thankyou.final_text', 'Cada contributo ajuda a manter e melhorar esta plataforma.')}
                        </p>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
