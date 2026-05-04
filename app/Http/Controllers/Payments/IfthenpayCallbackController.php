<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Models\Donation;
use App\Models\Payment;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class IfthenpayCallbackController extends Controller
{
    public function __invoke(Request $request, OrderStatusService $orderStatusService): JsonResponse
    {
        $data = $request->validate([
            'key' => ['nullable', 'string', 'max:120'],
            'reference' => ['nullable', 'string', 'max:120'],
            'entity' => ['nullable', 'string', 'max:40'],
            'amount' => ['nullable', 'numeric'],
            'transaction_id' => ['nullable', 'string', 'max:120'],
            'requestId' => ['nullable', 'string', 'max:120'],
            'request_id' => ['nullable', 'string', 'max:120'],
            'orderId' => ['nullable', 'string', 'max:120'],
            'order_id' => ['nullable', 'string', 'max:120'],
            'payment_datetime' => ['nullable', 'string', 'max:120'],
            'method' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', 'string', 'max:40'],
        ]);

        $expectedKey = config('services.ifthenpay.anti_phishing_key');

        if ($expectedKey && !hash_equals((string) $expectedKey, (string) ($data['key'] ?? ''))) {
            Log::warning('Ifthenpay callback invalid anti-phishing key.', [
                'payload' => $request->all(),
                'ip' => $request->ip(),
            ]);

            return response()->json(['ok' => false, 'message' => 'Invalid anti-phishing key.'], 403);
        }

        $callbackIdentifier = $data['transaction_id']
            ?? $data['requestId']
            ?? $data['request_id']
            ?? $data['reference']
            ?? $data['orderId']
            ?? $data['order_id']
            ?? null;

        if (!$callbackIdentifier) {
            return response()->json([
                'ok' => false,
                'message' => 'reference, transaction_id, requestId ou orderId é obrigatório.',
            ], 422);
        }

        Log::info('Ifthenpay callback received.', [
            'payload' => $request->all(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        try {
            DB::transaction(function () use ($data, $request, $orderStatusService) {
                $donation = $this->findDonationForCallback($data);

                if ($donation) {
                    $this->markDonationAsPaid($donation, $data, $request);
                    return;
                }

                $payment = $this->findPaymentForCallback($data);

                if ($payment) {
                    $this->markPaymentAsPaid($payment, $data, $request, $orderStatusService);
                    return;
                }

                throw ValidationException::withMessages([
                    'payment' => 'Pagamento ou donativo não encontrado.',
                ]);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Ifthenpay callback failed.', [
                'payload' => $request->all(),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['ok' => false, 'message' => 'Callback failed.'], 422);
        }

        return response()->json(['ok' => true]);
    }

    private function markPaymentAsPaid(Payment $payment, array $data, Request $request, OrderStatusService $orderStatusService): void
    {
        if (in_array($payment->status, ['cancelled', 'failed', 'refunded'], true)) {
            return;
        }

        if ($payment->status === 'paid') {
            $payment->update([
                'payload' => array_merge($payment->payload ?? [], [
                    'ifthenpay_duplicate_callback' => array_merge($request->all(), [
                        'received_at' => now()->toISOString(),
                    ]),
                ]),
            ]);

            return;
        }

        $receivedAmountCents = $this->validatedReceivedAmountCents((int) $payment->amount, $data, [
            'type' => 'payment',
            'id' => $payment->id,
        ]);

        $providerPaymentId = $data['transaction_id']
            ?? $data['requestId']
            ?? $data['request_id']
            ?? $payment->provider_payment_id;

        $payment->update([
            'status' => 'paid',
            'paid_at' => now(),
            'provider_payment_id' => $providerPaymentId,
            'payload' => array_merge($payment->payload ?? [], [
                'ifthenpay_callback' => array_merge($request->all(), [
                    'received_at' => now()->toISOString(),
                    'received_amount_cents' => $receivedAmountCents,
                ]),
            ]),
        ]);

        if ($payment->order?->status?->code === 'pending_payment') {
            $orderStatusService->transition(
                order: $payment->order,
                toCode: 'paid',
                changedByUserId: null,
                notes: 'Pagamento confirmado via Ifthenpay.'
            );
        }
    }

    private function markDonationAsPaid(Donation $donation, array $data, Request $request): void
    {
        if (in_array($donation->status, ['cancelled', 'failed'], true)) {
            return;
        }

        if ($donation->status === 'paid') {
            $donation->update([
                'payload' => array_merge($donation->payload ?? [], [
                    'ifthenpay_duplicate_callback' => array_merge($request->all(), [
                        'received_at' => now()->toISOString(),
                    ]),
                ]),
            ]);

            return;
        }

        $receivedAmountCents = $this->validatedReceivedAmountCents((int) $donation->amount, $data, [
            'type' => 'donation',
            'id' => $donation->id,
        ]);

        $providerPaymentId = $data['transaction_id']
            ?? $data['requestId']
            ?? $data['request_id']
            ?? $donation->provider_payment_id;

        $donation->update([
            'status' => 'paid',
            'paid_at' => now(),
            'provider_payment_id' => $providerPaymentId,
            'payload' => array_merge($donation->payload ?? [], [
                'ifthenpay_callback' => array_merge($request->all(), [
                    'received_at' => now()->toISOString(),
                    'received_amount_cents' => $receivedAmountCents,
                ]),
            ]),
        ]);
    }

    private function findPaymentForCallback(array $data): ?Payment
    {
        $requestId = $data['requestId'] ?? $data['request_id'] ?? null;
        $transactionId = $data['transaction_id'] ?? null;
        $reference = $data['reference'] ?? null;
        $orderId = $data['orderId'] ?? $data['order_id'] ?? null;

        if (
            empty($transactionId)
            && empty($requestId)
            && empty($reference)
            && (empty($orderId) || !is_numeric($orderId))
        ) {
            return null;
        }

        return Payment::query()
            ->where('provider', 'ifthenpay')
            ->where(function ($query) use ($transactionId, $requestId, $reference, $orderId) {
                if (!empty($transactionId)) {
                    $query->orWhere('provider_payment_id', $transactionId)
                        ->orWhere('reference', $transactionId);
                }

                if (!empty($requestId)) {
                    $query->orWhere('provider_payment_id', $requestId)
                        ->orWhere('reference', $requestId);
                }

                if (!empty($reference)) {
                    $query->orWhere('reference', $reference)
                        ->orWhere('provider_payment_id', $reference);
                }

                if (!empty($orderId) && is_numeric($orderId)) {
                    $query->orWhere('order_id', (int) $orderId);
                }
            })
            ->when(!empty($data['entity']), function ($query) use ($data) {
                $query->where(function ($q) use ($data) {
                    $q->whereNull('entity')->orWhere('entity', $data['entity']);
                });
            })
            ->lockForUpdate()
            ->with(['order.status', 'method'])
            ->first();
    }

    private function findDonationForCallback(array $data): ?Donation
    {
        $requestId = $data['requestId'] ?? $data['request_id'] ?? null;
        $transactionId = $data['transaction_id'] ?? null;
        $reference = $data['reference'] ?? null;
        $orderId = $data['orderId'] ?? $data['order_id'] ?? null;

        return Donation::query()
            ->where('provider', 'ifthenpay')
            ->where(function ($query) use ($transactionId, $requestId, $reference, $orderId) {
                if (!empty($transactionId)) {
                    $query->orWhere('provider_payment_id', $transactionId)
                        ->orWhere('reference', $transactionId);
                }

                if (!empty($requestId)) {
                    $query->orWhere('provider_payment_id', $requestId)
                        ->orWhere('reference', $requestId);
                }

                if (!empty($reference)) {
                    $query->orWhere('reference', $reference)
                        ->orWhere('provider_payment_id', $reference);
                }

                if (!empty($orderId)) {
                    $query->orWhere('donation_number', $orderId);

                    if (is_numeric($orderId)) {
                        $query->orWhere('id', (int) $orderId);
                    }
                }
            })
            ->when(!empty($data['entity']), function ($query) use ($data) {
                $query->where(function ($q) use ($data) {
                    $q->whereNull('entity')->orWhere('entity', $data['entity']);
                });
            })
            ->lockForUpdate()
            ->with(['paymentMethod'])
            ->first();
    }

    private function validatedReceivedAmountCents(int $expectedAmount, array $data, array $context = []): ?int
    {
        if (!array_key_exists('amount', $data) || $data['amount'] === null || $data['amount'] === '') {
            return null;
        }

        $receivedAmountCents = $this->normalizeAmountToCents($data['amount']);

        if ($receivedAmountCents !== $expectedAmount) {
            Log::warning('Ifthenpay callback amount mismatch.', [
                'context' => $context,
                'expected_amount' => $expectedAmount,
                'received_amount' => $receivedAmountCents,
            ]);

            throw ValidationException::withMessages([
                'amount' => 'O valor recebido não corresponde ao valor esperado.',
            ]);
        }

        return $receivedAmountCents;
    }

    private function normalizeAmountToCents(mixed $amount): int
    {
        if (is_int($amount)) {
            return $amount;
        }

        return (int) round(((float) str_replace(',', '.', (string) $amount)) * 100);
    }
}
