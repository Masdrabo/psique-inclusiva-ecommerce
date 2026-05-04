<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Order $order;
    public string $localeCode;

    public function __construct(Order $order, string $localeCode = 'pt')
    {
        $this->order = $order;
        $this->localeCode = $localeCode;

        $this->onQueue('emails');
    }

    public function build(): static
    {
        app()->setLocale($this->localeCode);

        $this->order->loadMissing([
            'status',
            'currency',
            'items',
            'customer.user',
            'payment.method',
            'shipment.method',
            'refunds.items.orderItem',
        ]);

        $statusLabel = __('ui.statuses.' . ($this->order->status?->code ?? 'unknown'));

        return $this->subject(
            __('ui.email.order_status_updated_subject', [
                'order' => $this->order->order_number,
                'status' => $statusLabel,
            ])
        )->view('emails.orders.status-updated');
    }
}
