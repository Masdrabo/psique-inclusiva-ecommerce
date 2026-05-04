import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaginationLinks from '@/Components/PaginationLinks';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function formatMoney(cents) {
    return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString();
}

function StatusBadge({ status }) {
    if (status === 'paid') {
        return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Pago</span>;
    }

    if (status === 'pending') {
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pendente</span>;
    }

    return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{status || '—'}</span>;
}

function SummaryCard({ label, value, tone = 'text-gray-900' }) {
    return (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
        </div>
    );
}

export default function AdminDonationsIndex() {
    const { locale, donations, filters, summary } = usePage().props;

    const [q, setQ] = useState(filters?.q ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');
    const [method, setMethod] = useState(filters?.method ?? '');

    useEffect(() => {
        setQ(filters?.q ?? '');
        setStatus(filters?.status ?? '');
        setMethod(filters?.method ?? '');
    }, [filters?.q, filters?.status, filters?.method]);

    function applyFilters(event) {
        event.preventDefault();

        router.get(
            route('admin.donations.index', { locale }),
            {
                q: q || undefined,
                status: status || undefined,
                method: method || undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
    }

    function clearFilters() {
        setQ('');
        setStatus('');
        setMethod('');

        router.get(route('admin.donations.index', { locale }), {}, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    const rows = donations?.data ?? [];

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Donativos</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Gestão e consulta dos donativos realizados.
                    </p>
                </div>
            }
        >
            <Head title="Admin · Donativos" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard label="Total de donativos" value={summary?.total_count ?? 0} />
                        <SummaryCard label="Pagos" value={summary?.paid_count ?? 0} tone="text-green-700" />
                        <SummaryCard label="Pendentes" value={summary?.pending_count ?? 0} tone="text-amber-700" />
                        <SummaryCard label="Total pago" value={formatMoney(summary?.paid_total_amount ?? 0)} tone="text-emerald-700" />
                    </div>

                    <div className="rounded-2xl border bg-white shadow-sm">
                        <div className="border-b px-6 py-5">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Histórico de donativos
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Pesquisa por número, nome ou email.
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <a
                                        href={route('admin.donations.export', { locale })}
                                        className="text-sm font-semibold text-emerald-700 underline"
                                    >
                                        Exportar CSV
                                    </a>

                                    <Link
                                        href={route('admin.dashboard', { locale })}
                                        className="text-sm font-semibold text-gray-900 underline"
                                    >
                                        Voltar ao admin
                                    </Link>
                                </div>
                            </div>

                            <form onSubmit={applyFilters} className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_200px_220px_auto]">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600">
                                        Pesquisa
                                    </label>
                                    <input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="DON-..., nome ou email"
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600">
                                        Estado
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    >
                                        <option value="">Todos</option>
                                        <option value="pending">Pendente</option>
                                        <option value="paid">Pago</option>
                                        <option value="failed">Falhado</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600">
                                        Método
                                    </label>
                                    <select
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value)}
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                    >
                                        <option value="">Todos</option>
                                        <option value="ifthenpay_mb">Multibanco</option>
                                        <option value="ifthenpay_mbway">MB WAY</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 lg:self-end">
                                    <button
                                        type="submit"
                                        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                    >
                                        Aplicar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </form>
                        </div>

                        {rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Número</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Doador</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Método</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Criado</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Pago</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Ações</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {rows.map((donation) => {
                                            const receiptUrl =
                                                donation.status === 'paid'
                                                    ? `/${locale}/donativos/${donation.id}/comprovativo?token=${donation.public_token}`
                                                    : null;

                                            const publicUrl = `/${locale}/donativos/${donation.id}/obrigado?token=${donation.public_token}`;

                                            return (
                                                <tr key={donation.id}>
                                                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-900">
                                                        {donation.number}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-gray-700">
                                                        <div className="font-medium text-gray-900">
                                                            {donation.donor_name || '—'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {donation.donor_email || '—'}
                                                        </div>
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
                                                            <a
                                                                href={publicUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                            >
                                                                Ver
                                                            </a>

                                                            {receiptUrl ? (
                                                                <a
                                                                    href={receiptUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
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
                            <div className="px-6 py-12 text-center">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Nenhum donativo encontrado.
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Ajusta os filtros ou aguarda novos donativos.
                                </p>
                            </div>
                        )}

                        <PaginationLinks links={donations?.links ?? []} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
