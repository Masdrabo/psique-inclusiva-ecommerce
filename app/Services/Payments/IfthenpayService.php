<?php

namespace App\Services\Payments;

use App\Models\Payment;
use App\Models\Donation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class IfthenpayService
{
    private const MULTIBANCO_ENDPOINT = 'https://api.ifthenpay.com/multibanco/reference/init';
    private const MBWAY_ENDPOINT = 'https://api.ifthenpay.com/spg/payment/mbway';
    private const MBWAY_STATUS_ENDPOINT = 'https://api.ifthenpay.com/spg/payment/mbway/status';

    /*
    |--------------------------------------------------------------------------
    | CREATE PAYMENTS
    |--------------------------------------------------------------------------
    */

    public function createMultibancoReference(Payment|Donation $model): array
    {
        if ($this->shouldUseMock()) {
            return $this->mockMultibancoReference($model);
        }

        $mbKey = config('services.ifthenpay.multibanco_key');

        if (!$mbKey) {
            throw new \RuntimeException('Ifthenpay Multibanco key não configurada.');
        }

        $response = Http::timeout(20)
            ->acceptJson()
            ->post(self::MULTIBANCO_ENDPOINT, [
                'mbKey' => $mbKey,
                'orderId' => $this->buildOrderId($model, 25),
                'amount' => $this->formatAmount($model->amount),
                'description' => $this->buildDescription($model),
            ]);

        $response->throw();

        $data = $response->json();

        if ((string) ($data['Status'] ?? '') !== '0') {
            throw new \RuntimeException(
                'Ifthenpay Multibanco error: ' . ($data['Message'] ?? 'Unknown error')
            );
        }

        return [
            'entity' => (string) ($data['Entity'] ?? ''),
            'reference' => (string) ($data['Reference'] ?? ''),
            'expires_at' => $this->parseMultibancoExpiryDate($data['ExpiryDate'] ?? null),
            'transaction_id' => (string) ($data['RequestId'] ?? ''),
            'amount' => $data['Amount'] ?? $this->formatAmount($model->amount),
            'status' => 'pending',
            'raw' => $data,
        ];
    }

    public function createMbwayPayment(Payment|Donation $model, string $phone): array
    {
        if ($this->shouldUseMock()) {
            return $this->mockMbwayPayment($model, $phone);
        }

        $mbwayKey = config('services.ifthenpay.mbway_key');

        if (!$mbwayKey) {
            throw new \RuntimeException('Ifthenpay MB WAY key não configurada.');
        }

        $response = Http::timeout(20)
            ->acceptJson()
            ->post(self::MBWAY_ENDPOINT, [
                'mbWayKey' => $mbwayKey,
                'orderId' => $this->buildOrderId($model, 15),
                'amount' => $this->formatAmount($model->amount),
                'mobileNumber' => $this->formatMbwayPhone($phone),
                'description' => $this->buildDescription($model),
            ]);

        $response->throw();

        $data = $response->json();

        if ((string) ($data['Status'] ?? '') !== '000') {
            throw new \RuntimeException(
                'Ifthenpay MB WAY error: ' . ($data['Message'] ?? 'Unknown error')
            );
        }

        return [
            'request_id' => (string) ($data['RequestId'] ?? ''),
            'transaction_id' => (string) ($data['RequestId'] ?? ''),
            'amount' => $data['Amount'] ?? $this->formatAmount($model->amount),
            'status' => 'pending',
            'raw' => $data,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    public function checkMbwayStatus(string $requestId): array
    {
        if ($this->shouldUseMock()) {
            return [
                'request_id' => $requestId,
                'status' => 'pending',
                'mock' => true,
            ];
        }

        $mbwayKey = config('services.ifthenpay.mbway_key');

        if (!$mbwayKey) {
            throw new \RuntimeException('Ifthenpay MB WAY key não configurada.');
        }

        $response = Http::timeout(20)
            ->acceptJson()
            ->get(self::MBWAY_STATUS_ENDPOINT, [
                'mbWayKey' => $mbwayKey,
                'requestId' => $requestId,
            ]);

        $response->throw();

        return $response->json();
    }

    public function applyMultibancoResponseToPayment(Payment $payment, array $response): Payment
{
    $entity = $response['entity'] ?? $response['entidade'] ?? null;
    $reference = $response['reference'] ?? $response['referencia'] ?? null;
    $expiresAt = $response['expires_at'] ?? $response['deadline'] ?? null;

    if (!$entity || !$reference) {
        throw new \RuntimeException('Resposta Multibanco inválida: entidade ou referência em falta.');
    }

    $payment->update([
        'provider' => 'ifthenpay',
        'entity' => (string) $entity,
        'reference' => (string) $reference,
        'expires_at' => $expiresAt ? \Illuminate\Support\Carbon::parse($expiresAt) : now()->addDays(3),
        'provider_payment_id' => $response['transaction_id'] ?? $response['request_id'] ?? null,
        'payload' => array_merge($payment->payload ?? [], [
            'ifthenpay_create_response' => $response,
        ]),
    ]);

    return $payment->fresh(['method', 'order']);
}

public function applyMbwayResponseToPayment(Payment $payment, array $response, string $phone): Payment
{
    $requestId = $response['request_id'] ?? $response['transaction_id'] ?? null;

    if (!$requestId) {
        throw new \RuntimeException('Resposta MB WAY inválida: request_id em falta.');
    }

    $payment->update([
        'provider' => 'ifthenpay',
        'reference' => (string) $requestId,
        'provider_payment_id' => (string) $requestId,
        'expires_at' => now()->addMinutes(4),
        'payload' => array_merge($payment->payload ?? [], [
            'mbway_phone' => $phone,
            'ifthenpay_create_response' => $response,
        ]),
    ]);

    return $payment->fresh(['method', 'order']);
}

    /*
    |--------------------------------------------------------------------------
    | HELPERS
    |--------------------------------------------------------------------------
    */

    private function shouldUseMock(): bool
    {
        return filter_var(config('services.ifthenpay.mock', true), FILTER_VALIDATE_BOOLEAN);
    }

    private function formatAmount(int $amountInCents): string
    {
        return number_format($amountInCents / 100, 2, '.', '');
    }

    /**
     * 🔥 SUPORTA Payment e Donation
     */
    private function buildOrderId(Payment|Donation $model, int $maxLength): string
    {
        if ($model instanceof Payment) {
            $value = $model->order?->order_number ?: (string) $model->order_id;
        } else {
            $value = $model->donation_number ?: (string) $model->id;
        }

        return Str::limit($value, $maxLength, '');
    }

    private function buildDescription(Payment|Donation $model): string
    {
        if ($model instanceof Payment) {
            return 'Order #' . ($model->order?->order_number ?? $model->order_id);
        }

        return 'Donation #' . ($model->donation_number ?? $model->id);
    }

    private function formatMbwayPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '351') && strlen($digits) === 12) {
            return '351#' . substr($digits, 3);
        }

        if (strlen($digits) === 9) {
            return '351#' . $digits;
        }

        throw new \RuntimeException('Número MB WAY inválido.');
    }

    private function parseMultibancoExpiryDate(?string $expiryDate): Carbon
    {
        if (!$expiryDate) {
            return now()->addDays(3);
        }

        try {
            return Carbon::createFromFormat('d-m-Y', $expiryDate)->endOfDay();
        } catch (\Throwable) {
            return Carbon::parse($expiryDate);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | MOCK
    |--------------------------------------------------------------------------
    */

    private function mockMultibancoReference(Payment|Donation $model): array
    {
        return [
            'entity' => '12345',
            'reference' => str_pad((string) $model->id, 9, '0', STR_PAD_LEFT),
            'amount' => $this->formatAmount($model->amount),
            'expires_at' => now()->addDays(3)->toISOString(),
            'transaction_id' => 'MOCK-MB-' . Str::upper(Str::random(10)),
            'status' => 'pending',
            'mock' => true,
        ];
    }

    private function mockMbwayPayment(Payment|Donation $model, string $phone): array
    {
        return [
            'request_id' => 'MOCK-MBWAY-' . Str::upper(Str::random(10)),
            'transaction_id' => 'MOCK-MBWAY-' . Str::upper(Str::random(10)),
            'amount' => $this->formatAmount($model->amount),
            'phone' => $phone,
            'status' => 'pending',
            'mock' => true,
        ];
    }
}
