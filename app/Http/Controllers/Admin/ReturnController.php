<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ReturnStatusUpdatedMail;
use App\Models\Order;
use App\Models\OrderReturn;
use App\Services\OrderReturnService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class ReturnController extends Controller
{
    public function store(
        string $locale,
        Request $request,
        Order $order,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.reason' => ['nullable', 'string', 'max:120'],
            'items.*.condition' => ['nullable', 'string', 'max:50'],
            'items.*.resolution' => ['nullable', 'string', 'max:50'],
        ]);

        try {
            $orderReturn = $orderReturnService->createReturn(
                order: $order,
                itemsPayload: $data['items'],
                reason: $data['reason'] ?? null,
                notes: $data['notes'] ?? null,
                requestedByUserId: $request->user()?->id
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $this->queueReturnStatusUpdatedMail($orderReturn, $locale);

        return back()->with('success', __('ui.returns.created_success', [], app()->getLocale()));
    }

    public function approve(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        try {
            $orderReturnService->approveReturn(
                return: $return,
                approvedByUserId: $request->user()?->id,
                notes: $data['notes'] ?? null
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $this->queueReturnStatusUpdatedMail($return->fresh(), $locale);

        return back()->with('success', __('ui.returns.approved_success', [], app()->getLocale()));
    }

    public function reject(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        try {
            $orderReturnService->rejectReturn(
                return: $return,
                approvedByUserId: $request->user()?->id,
                notes: $data['notes'] ?? null
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $this->queueReturnStatusUpdatedMail($return->fresh(), $locale);

        return back()->with('success', __('ui.returns.rejected_success', [], app()->getLocale()));
    }

    public function receive(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.received_qty' => ['required', 'integer', 'min:0'],
            'items.*.restock_qty' => ['required', 'integer', 'min:0'],
        ]);

        try {
            $orderReturnService->receiveReturn(
                return: $return,
                itemsPayload: $data['items'],
                receivedByUserId: $request->user()?->id,
                notes: $data['notes'] ?? null
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $this->queueReturnStatusUpdatedMail($return->fresh(), $locale);

        return back()->with('success', __('ui.returns.received_success', [], app()->getLocale()));
    }

    public function exchangeShip(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.shipped_qty' => ['required', 'integer', 'min:0'],
        ]);

        try {
            $orderReturnService->shipExchange(
                return: $return,
                itemsPayload: $data['items'],
                trackingNumber: $data['tracking_number'] ?? null,
                notes: $data['notes'] ?? null
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return back()->with('success', 'Reenvio da troca registado com sucesso.');
    }

    public function close(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        try {
            $orderReturnService->closeReturn(
                return: $return,
                notes: $data['notes'] ?? null
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $this->queueReturnStatusUpdatedMail($return->fresh(), $locale);

        return back()->with('success', __('ui.returns.closed_success', [], app()->getLocale()));
    }

    private function queueReturnStatusUpdatedMail(OrderReturn $orderReturn, string $locale): void
    {
        try {
            $orderReturn->loadMissing([
                'order.user',
                'order.currency',
                'items.orderItem',
            ]);

            $customer = $orderReturn->order?->user;

            if (!$customer?->email) {
                return;
            }

            $customerLocale = in_array(
                $locale,
                config('app.supported_locales', ['pt', 'en']),
                true
            )
                ? $locale
                : config('app.fallback_locale', 'pt');

            Mail::to($customer->email)->queue(
                new ReturnStatusUpdatedMail($orderReturn, $customerLocale)
            );
        } catch (\Throwable $e) {
            Log::error('Failed to queue return status updated email.', [
                'order_return_id' => $orderReturn->id ?? null,
                'order_id' => $orderReturn->order_id ?? null,
                'status' => $orderReturn->status ?? null,
                'email' => $orderReturn->order?->user?->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function assertReturnBelongsToOrder(Order $order, OrderReturn $return): void
        {
            abort_unless((int) $return->order_id === (int) $order->id, 404);
        }

        public function refund(
        string $locale,
        Request $request,
        Order $order,
        OrderReturn $return,
        OrderReturnService $orderReturnService,
        \App\Services\RefundService $refundService
    ): RedirectResponse {
        $this->assertReturnBelongsToOrder($order, $return);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'idempotency_key' => ['required', 'uuid'],
            'refund_shipping' => ['nullable', 'boolean'],
        ]);

        try {
            $refundPayload = $orderReturnService->buildRefundPayloadFromReturn($return);

            $refund = $refundService->createRefund(
                order: $order,
                itemsPayload: $refundPayload['items'],
                idempotencyKey: $data['idempotency_key'],
                reason: $data['reason'] ?? $return->reason,
                notes: $data['notes'] ?? $return->notes,
                createdByUserId: $request->user()?->id,
                shippingAmount: !empty($data['refund_shipping'])
                    ? (int) ($refundPayload['shipping_amount'] ?? 0)
                    : 0,
                orderReturnId: $return->id
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
                    new \App\Mail\RefundIssuedMail($refund, $customerLocale)
                );
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue refund issued email from return.', [
                'refund_id' => $refund->id,
                'order_id' => $refund->order_id,
                'order_return_id' => $return->id,
                'email' => $customerEmail,
                'error' => $e->getMessage(),
            ]);
        }

        return back()->with('success', __('ui.refunds.created_successfully'));
    }
}
