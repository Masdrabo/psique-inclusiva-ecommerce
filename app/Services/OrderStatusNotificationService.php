<?php

namespace App\Services;

use App\Mail\OrderStatusUpdatedMail;
use App\Models\Order;
use App\Models\OrderStatusNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OrderStatusNotificationService
{
    private const CUSTOMER_NOTIFIABLE_STATUSES = [
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
    ];

    private const CHANNEL_CUSTOMER_EMAIL = 'email_customer';

    public function sendForTransition(Order $order, string $fromCode, string $toCode): void
    {
        if (!config('mail.order_status_notifications_enabled', true)) {
            return;
        }

        if ($fromCode === $toCode) {
            return;
        }

        $order->loadMissing([
            'status',
            'currency',
            'items',
            'customer.user',
            'payment.method',
            'shipment.method',
        ]);

        $this->sendCustomerStatusMail($order, $toCode);
    }

    private function sendCustomerStatusMail(Order $order, string $toCode): void
    {
        if (!in_array($toCode, self::CUSTOMER_NOTIFIABLE_STATUSES, true)) {
            return;
        }

        $customerEmail = $order->user?->email;
        $statusId = $order->status_id;

        if (!$customerEmail || !$statusId) {
            return;
        }

        $locale = $this->resolveLocaleForCustomer($order);

        try {
            DB::transaction(function () use ($order, $statusId, $customerEmail, $locale) {
                $notification = OrderStatusNotification::query()->firstOrCreate(
                    [
                        'order_id' => $order->id,
                        'status_id' => $statusId,
                        'channel' => self::CHANNEL_CUSTOMER_EMAIL,
                    ],
                    [
                        'recipient' => $customerEmail,
                        'sent_at' => null,
                        'meta' => [
                            'locale' => $locale,
                        ],
                    ]
                );

                if ($notification->sent_at) {
                    return;
                }

                Mail::to($customerEmail)->queue(
                    new OrderStatusUpdatedMail($order, $locale)
                );

                $notification->update([
                    'recipient' => $customerEmail,
                    'sent_at' => now(),
                    'meta' => array_merge($notification->meta ?? [], [
                        'locale' => $locale,
                    ]),
                ]);
            });
        } catch (\Throwable $e) {
            Log::error('Failed to queue order status updated email for customer.', [
                'order_id' => $order->id,
                'status_code' => $toCode,
                'status_id' => $statusId,
                'email' => $customerEmail,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function resolveLocaleForCustomer(Order $order): string
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallback = config('app.fallback_locale', 'pt');

        $candidate = $order->user?->locale
            ?? $order->customer?->user?->locale
            ?? app()->getLocale();

        return in_array($candidate, $supported, true) ? $candidate : $fallback;
    }
}
