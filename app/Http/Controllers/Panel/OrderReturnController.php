<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Mail\ReturnRequestedAdminMail;
use App\Mail\ReturnRequestedMail;
use App\Models\Order;
use App\Services\OrderReturnService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class OrderReturnController extends Controller
{
    public function store(
        string $locale,
        Request $request,
        Order $order,
        OrderReturnService $orderReturnService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $this->authorize('view', $order);

        $order->loadMissing([
            'user:id,name,email',
            'status:id,code,name',
            'shipment:id,order_id,delivered_at',
            'items.returnItems.return',
        ]);

        if (!$this->canCustomerRequestReturn($order)) {
            return back()->withErrors([
                'return' => $this->returnUnavailableMessage($order),
            ])->withInput();
        }

        Log::info('Order return request received.', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'user_id' => $user->id,
            'payload' => $request->all(),
        ]);

        $validator = Validator::make(
            $request->all(),
            [
                'reason' => ['nullable', 'string', 'max:120'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'items' => ['required', 'array', 'min:1'],
                'items.*.order_item_id' => ['required', 'integer'],
                'items.*.qty' => ['required', 'integer', 'min:1'],
                'items.*.reason' => ['nullable', 'string', 'max:120'],
                'items.*.condition' => ['nullable', 'string', 'max:50'],
                'items.*.resolution' => ['nullable', 'string', 'max:50'],
            ],
            [
                'items.required' => 'Seleciona pelo menos um artigo para devolução.',
                'items.min' => 'Seleciona pelo menos um artigo para devolução.',
                'items.*.order_item_id.required' => 'Falta o artigo da devolução.',
                'items.*.order_item_id.integer' => 'O artigo da devolução é inválido.',
                'items.*.qty.required' => 'A quantidade é obrigatória nos artigos selecionados.',
                'items.*.qty.integer' => 'A quantidade tem de ser um número inteiro.',
                'items.*.qty.min' => 'A quantidade mínima é 1.',
                'items.*.reason.max' => 'O motivo do artigo não pode ultrapassar 120 caracteres.',
                'items.*.condition.max' => 'A condição não pode ultrapassar 50 caracteres.',
                'items.*.resolution.max' => 'A resolução não pode ultrapassar 50 caracteres.',
                'reason.max' => 'O motivo não pode ultrapassar 120 caracteres.',
                'notes.max' => 'As notas não podem ultrapassar 2000 caracteres.',
            ]
        );

        if ($validator->fails()) {
            Log::warning('Order return request validation failed.', [
                'order_id' => $order->id,
                'user_id' => $user->id,
                'errors' => $validator->errors()->toArray(),
            ]);

            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        $data['items'] = collect($data['items'] ?? [])
            ->map(function (array $item) {
                return [
                    'order_item_id' => (int) ($item['order_item_id'] ?? 0),
                    'qty' => (int) ($item['qty'] ?? 0),
                    'reason' => isset($item['reason']) && $item['reason'] !== '' ? trim((string) $item['reason']) : null,
                    'condition' => isset($item['condition']) && $item['condition'] !== '' ? trim((string) $item['condition']) : null,
                    'resolution' => isset($item['resolution']) && $item['resolution'] !== '' ? trim((string) $item['resolution']) : null,
                ];
            })
            ->filter(fn (array $item) => $item['order_item_id'] > 0 && $item['qty'] > 0)
            ->values()
            ->all();

        if (count($data['items']) === 0) {
            Log::warning('Order return request contains no valid items after normalization.', [
                'order_id' => $order->id,
                'user_id' => $user->id,
                'raw_payload' => $request->all(),
            ]);

            return back()->withErrors([
                'items' => 'Seleciona pelo menos um artigo com quantidade superior a 0.',
            ])->withInput();
        }

        try {
            $orderReturn = $orderReturnService->createReturn(
                order: $order,
                itemsPayload: $data['items'],
                reason: isset($data['reason']) && $data['reason'] !== '' ? trim((string) $data['reason']) : null,
                notes: isset($data['notes']) && $data['notes'] !== '' ? trim((string) $data['notes']) : null,
                requestedByUserId: $user->id
            );

            Log::info('Order return created successfully.', [
                'order_return_id' => $orderReturn->id ?? null,
                'order_id' => $order->id,
                'user_id' => $user->id,
            ]);
        } catch (ValidationException $e) {
            Log::warning('OrderReturnService validation failed.', [
                'order_id' => $order->id,
                'user_id' => $user->id,
                'errors' => $e->errors(),
            ]);

            return back()->withErrors($e->errors())->withInput();
        } catch (\Throwable $e) {
            Log::error('Unexpected error while creating order return.', [
                'order_id' => $order->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return back()->withErrors([
                'return' => 'Ocorreu um erro ao criar o pedido de devolução.',
            ])->withInput();
        }

        $customerLocale = in_array($locale, config('app.supported_locales', ['pt', 'en']), true)
            ? $locale
            : config('app.fallback_locale', 'pt');

        $adminLocale = config('mail.order_notification_locale', config('app.fallback_locale', 'pt'));
        $adminEmail = config('mail.order_notification_to');

        $orderReturn->loadMissing([
            'order.user',
            'order.currency',
            'items.orderItem.product',
            'requestedBy',
        ]);

        $customerEmail = $order->user?->email ?: $user->email;

        try {
            if (!empty($customerEmail)) {
                Mail::to($customerEmail)->queue(
                    new ReturnRequestedMail($orderReturn, $customerLocale)
                );

                Log::info('Queued customer return email.', [
                    'order_return_id' => $orderReturn->id ?? null,
                    'order_id' => $order->id,
                    'email' => $customerEmail,
                ]);
            } else {
                Log::warning('Customer email is empty. Customer return email was not queued.', [
                    'order_return_id' => $orderReturn->id ?? null,
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue return requested customer email.', [
                'order_return_id' => $orderReturn->id ?? null,
                'order_id' => $order->id,
                'email' => $customerEmail,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            if (!empty($adminEmail)) {
                Mail::to($adminEmail)->queue(
                    new ReturnRequestedAdminMail($orderReturn, $adminLocale)
                );

                Log::info('Queued admin return email.', [
                    'order_return_id' => $orderReturn->id ?? null,
                    'order_id' => $order->id,
                    'email' => $adminEmail,
                ]);
            } else {
                Log::warning('MAIL_ORDER_NOTIFICATION_TO is empty. Admin return email was not queued.', [
                    'order_return_id' => $orderReturn->id ?? null,
                    'order_id' => $order->id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue return requested admin email.', [
                'order_return_id' => $orderReturn->id ?? null,
                'order_id' => $order->id,
                'email' => $adminEmail,
                'error' => $e->getMessage(),
            ]);
        }

        return back()->with('success', $this->msg(
            pt: 'Pedido de devolução criado com sucesso.',
            en: 'Return request created successfully.'
        ));
    }

    private function canCustomerRequestReturn(Order $order): bool
    {
        if (($order->status?->code ?? null) !== 'delivered') {
            return false;
        }

        $windowDays = max(1, (int) config('returns.window_days', 14));
        $deliveredAt = $order->shipment?->delivered_at;

        if (!$deliveredAt) {
            return false;
        }

        $windowEndsAt = $deliveredAt->copy()->addDays($windowDays)->endOfDay();

        if (now()->gt($windowEndsAt)) {
            return false;
        }

        return $order->items->contains(function ($item) {
            $returnedQty = (int) $item->returnItems
                ->filter(fn ($returnItem) => !in_array($returnItem->return?->status, ['rejected', 'cancelled'], true))
                ->sum('qty');

            return max(0, (int) $item->qty - $returnedQty) > 0;
        });
    }

    private function returnUnavailableMessage(Order $order): string
    {
        if (($order->status?->code ?? null) !== 'delivered') {
            return 'Só é possível pedir devolução depois da encomenda ser entregue.';
        }

        $deliveredAt = $order->shipment?->delivered_at;

        if (!$deliveredAt) {
            return 'Ainda não existe uma data de entrega válida para esta encomenda.';
        }

        $windowDays = max(1, (int) config('returns.window_days', 14));
        $windowEndsAt = $deliveredAt->copy()->addDays($windowDays)->endOfDay();

        if (now()->gt($windowEndsAt)) {
            return 'O prazo de devolução desta encomenda expirou.';
        }

        return 'Não existem artigos elegíveis para devolução nesta encomenda.';
    }

    private function msg(string $pt, string $en): string
    {
        return app()->getLocale() === 'en' ? $en : $pt;
    }
}
