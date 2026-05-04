<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Donation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DonationController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $method = trim((string) $request->query('method', ''));

        $donations = Donation::query()
            ->with(['user:id,name,email', 'paymentMethod:id,code,name', 'currency:id,code,symbol,decimal_places'])
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('donation_number', 'like', "%{$q}%")
                        ->orWhere('donor_name', 'like', "%{$q}%")
                        ->orWhere('donor_email', 'like', "%{$q}%")
                        ->orWhereHas('user', function ($userQuery) use ($q) {
                            $userQuery->where('name', 'like', "%{$q}%")
                                ->orWhere('email', 'like', "%{$q}%");
                        });
                });
            })
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($method !== '', function ($query) use ($method) {
                $query->whereHas('paymentMethod', fn ($m) => $m->where('code', $method));
            })
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Donation $donation) => [
                'id' => $donation->id,
                'number' => $donation->donation_number,
                'amount' => (int) $donation->amount,
                'status' => $donation->status,
                'donor_name' => $donation->donor_name ?? $donation->user?->name,
                'donor_email' => $donation->donor_email ?? $donation->user?->email,
                'method' => [
                    'code' => $donation->paymentMethod?->code,
                    'name' => $donation->paymentMethod?->name,
                ],
                'created_at' => optional($donation->created_at)?->toISOString(),
                'paid_at' => optional($donation->paid_at)?->toISOString(),
                'public_token' => $donation->public_token,
            ]);

        return Inertia::render('Admin/Donations/Index', [
            'donations' => $donations,
            'filters' => [
                'q' => $q,
                'status' => $status,
                'method' => $method,
            ],
            'summary' => [
                'total_count' => Donation::count(),
                'paid_count' => Donation::where('status', 'paid')->count(),
                'pending_count' => Donation::where('status', 'pending')->count(),
                'paid_total_amount' => (int) Donation::where('status', 'paid')->sum('amount'),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $filename = 'donativos-' . now()->format('Y-m-d-His') . '.csv';

        $donations = Donation::query()
            ->with(['user:id,name,email', 'paymentMethod:id,code,name'])
            ->latest()
            ->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        return response()->stream(function () use ($donations) {
            $handle = fopen('php://output', 'w');

        // BOM para Excel abrir acentos corretamente
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Número',
                'Estado',
                'Valor',
                'Método',
                'Doador',
                'Email',
                'Telefone',
                'Provider',
                'Entidade',
                'Referência',
                'Provider Payment ID',
                'Criado em',
                'Pago em',
            ], ';');

            foreach ($donations as $donation) {
                fputcsv($handle, [
                    $donation->donation_number,
                    $donation->status,
                    number_format($donation->amount / 100, 2, ',', '.'),
                    $donation->paymentMethod?->name,
                    $donation->donor_name ?? $donation->user?->name,
                    $donation->donor_email ?? $donation->user?->email,
                    $donation->donor_phone,
                    $donation->provider,
                    $donation->entity,
                    $donation->reference,
                    $donation->provider_payment_id,
                    optional($donation->created_at)->format('Y-m-d H:i:s'),
                    optional($donation->paid_at)->format('Y-m-d H:i:s'),
                ], ';');
            }

            fclose($handle);
        }, 200, $headers);
    }
}
