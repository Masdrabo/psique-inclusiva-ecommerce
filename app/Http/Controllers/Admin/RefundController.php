<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\RefundIssuedMail;
use App\Models\Order;
use App\Services\RefundService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class RefundController extends Controller
{
    public function store(
        string $locale,
        Request $request,
        Order $order,
        RefundService $refundService
    ): RedirectResponse {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['required', 'uuid'],

            'items' => ['nullable', 'array'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],

            'shipping_amount' => ['nullable', 'integer', 'min:0'],
        ]);

        $items = collect($data['items'] ?? [])
            ->filter(function ($row) {
                return !empty($row['order_item_id']) && (int) ($row['qty'] ?? 0) > 0;
            })
            ->values()
            ->all();

        $shippingAmount = (int) ($data['shipping_amount'] ?? 0);

        if (empty($items) && $shippingAmount <= 0) {
            return back()->withErrors([
                'refund' => __('ui.refunds.errors.invalid_item'),
            ]);
        }

        try {
            $refund = $refundService->createRefund(
                order: $order,
                itemsPayload: $items,
                idempotencyKey: $data['idempotency_key'],
                reason: $data['reason'] ?? null,
                notes: $data['notes'] ?? null,
                createdByUserId: $request->user()?->id,
                shippingAmount: $shippingAmount
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $refund->loadMissing([
            'order.status',
            'order.currency',
            'order.customer.user',
            'order.payment.method',
            'items.orderItem',
        ]);

        $customerEmail = $refund->order?->customer?->user?->email;
        $customerLocale = $refund->order?->customer?->user?->locale
            ?? $locale
            ?? config('app.fallback_locale', 'pt');

        if (!in_array($customerLocale, config('app.supported_locales', ['pt', 'en']), true)) {
            $customerLocale = config('app.fallback_locale', 'pt');
        }

        try {
            if ($customerEmail) {
                Mail::to($customerEmail)->queue(
                    new RefundIssuedMail($refund, $customerLocale)
                );
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue refund issued email.', [
                'refund_id' => $refund->id,
                'order_id' => $refund->order_id,
                'email' => $customerEmail,
                'error' => $e->getMessage(),
            ]);
        }

        return back()->with('success', __('ui.refunds.created_successfully'));
    }
}
