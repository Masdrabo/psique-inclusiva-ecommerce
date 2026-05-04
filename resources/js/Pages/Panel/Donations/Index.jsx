import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents) {
    return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function formatDate(value) {
    if (!value) return '—';

    return new Date(value).toLocaleString();
}

function StatusBadge({ status }) {
    if (status === 'paid') {
        return (
            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                Pago
            </span>
        );
    }

    if (status === 'failed' || status === 'cancelled') {
        return (
            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                Cancelado
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            Pendente
        </span>
    );
}

export default function PanelDonationsIndex() {
    const { locale, donations } = usePage().props;
    const { t } = useI18n();

    const rows = donations?.data ?? [];

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Os meus donativos
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Consulta os teus donativos e descarrega comprovativos.
                    </p>
                </div>
            }
        >
            <Head title="Os meus donativos" />

            <div className="py-8 sm:py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                        <div className="border-b border-gray-200 px-5 py-4 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Histórico de donativos
                                </h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    Apenas aparecem donativos associados à tua conta.
                                </p>
                            </div>

                            <Link
                                href={`/${locale}/donativos`}
                                className="mt-4 inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 sm:mt-0"
                            >
                                Fazer novo donativo
                            </Link>
                        </div>

                        {rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Número
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Estado
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Método
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Valor
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Criado em
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Pago em
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {rows.map((donation) => {
                                            const receiptUrl =
                                                donation.status === 'paid'
                                                    ? `/${locale}/donativos/${donation.id}/comprovativo?token=${donation.public_token}`
                                                    : null;

                                            return (
                                                <tr key={donation.id}>
                                                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-900">
                                                        {donation.number}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4">
                                                        <StatusBadge status={donation.status} />
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-700">
                                                        {donation.method?.name || '—'}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-900">
                                                        {formatMoney(donation.amount)}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                                                        {formatDate(donation.created_at)}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                                                        {formatDate(donation.paid_at)}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm">
                                                        <div className="flex justify-end gap-2">
                                                            <Link
                                                                href={`/${locale}/donativos/${donation.id}/obrigado?token=${donation.public_token}`}
                                                                className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                            >
                                                                Ver
                                                            </Link>

                                                            {receiptUrl ? (
                                                                <a
                                                                    href={receiptUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                                                                >
                                                                    PDF
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-5 py-12 text-center">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Ainda não tens donativos associados à tua conta.
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Quando fizeres um donativo autenticado, ele aparece aqui.
                                </p>

                                <Link
                                    href={`/${locale}/donativos`}
                                    className="mt-5 inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                >
                                    Fazer donativo
                                </Link>
                            </div>
                        )}

                        {donations?.links?.length > 3 ? (
                            <div className="flex flex-wrap gap-2 border-t border-gray-200 px-5 py-4">
                                {donations.links.map((link, index) => (
                                    <Link
                                        key={`${link.label}-${index}`}
                                        href={link.url || '#'}
                                        preserveScroll
                                        className={[
                                            'rounded-md border px-3 py-1.5 text-sm',
                                            link.active
                                                ? 'border-gray-900 bg-gray-900 text-white'
                                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                                            !link.url ? 'pointer-events-none opacity-50' : '',
                                        ].join(' ')}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
