<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDonationRequest;
use App\Models\Currency;
use App\Models\Donation;
use App\Models\PaymentMethod;
use App\Services\Payments\IfthenpayService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class DonationController extends Controller
{
    public function store(
        string $locale,
        StoreDonationRequest $request,
        IfthenpayService $ifthenpayService
    ): RedirectResponse {

        $data = $request->validated();
        $user = $request->user();

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();

        abort_unless($currency, 500, 'Moeda não encontrada.');

        $paymentMethod = PaymentMethod::query()
            ->where('code', $data['payment_method_code'])
            ->firstOrFail();

        $amountCents = (int) round($data['amount'] * 100);

        $donation = DB::transaction(function () use (
            $data,
            $currency,
            $paymentMethod,
            $amountCents,
            $ifthenpayService,
            $user
        ) {

            $donation = Donation::create([
                'user_id' => $user?->id,
                'currency_id' => $currency->id,
                'payment_method_id' => $paymentMethod->id,
                'amount' => $amountCents,
                'status' => 'pending',

                'donor_name' => $data['donor_name'] ?? $user?->name,
                'donor_email' => $data['donor_email'] ?? $user?->email,
                'donor_phone' => $data['donor_phone'] ?? null,
            ]);

            // MULTIBANCO
            if ($paymentMethod->code === 'ifthenpay_mb') {
                $response = $ifthenpayService->createMultibancoReference($donation);

                $donation->update([
                    'provider' => 'ifthenpay',
                    'entity' => $response['entity'],
                    'reference' => $response['reference'],
                    'provider_payment_id' => $response['transaction_id'] ?? null,
                    'expires_at' => $response['expires_at'] ?? now()->addDays(3),
                    'payload' => $response,
                ]);
            }

            // MB WAY
            if ($paymentMethod->code === 'ifthenpay_mbway') {

                $phone = preg_replace('/\D+/', '', (string) ($data['phone'] ?? ''));

                if (!$phone) {
                    throw new \RuntimeException('Número MB WAY inválido.');
                }

                $response = $ifthenpayService->createMbwayPayment($donation, $phone);

                $donation->update([
                    'provider' => 'ifthenpay',
                    'reference' => $response['request_id'] ?? null,
                    'provider_payment_id' => $response['request_id'] ?? null,
                    'expires_at' => now()->addMinutes(15),
                    'payload' => $response,
                ]);
            }

            return $donation;
        });

        return redirect()->route('donations.thankyou', [
            'locale' => $locale,
            'donation' => $donation->id,
            'token' => $donation->public_token,
        ]);
    }

    public function thankYou(string $locale, Donation $donation)
    {
        $token = request()->query('token');

        abort_unless($token && $token === $donation->public_token, 403);

        return inertia('Donations/ThankYou', [
            'donation' => [
                'id' => $donation->id,
                'number' => $donation->donation_number,
                'status' => $donation->status,
                'amount' => $donation->amount,
                'entity' => $donation->entity,
                'reference' => $donation->reference,
                'expires_at' => optional($donation->expires_at)?->toISOString(),
                'provider' => $donation->provider,
                'method' => [
                    'code' => $donation->paymentMethod?->code,
                    'name' => $donation->paymentMethod?->name,
                ],
                'public_token' => $donation->public_token,
            ],
        ]);
    }

    public function receipt(string $locale, Request $request, Donation $donation)
    {
        $token = $request->query('token');

        if (!$token || $token !== $donation->public_token) {
            abort(403, 'Acesso não autorizado.');
        }

        if ($donation->status !== 'paid') {
            abort(403, 'Donativo ainda não pago.');
        }

        $pdf = Pdf::loadView('donations.receipt', [
            'donation' => $donation->loadMissing(['paymentMethod', 'currency']),
        ]);

        return $pdf->download('comprovativo-'.$donation->donation_number.'.pdf');
    }
}
