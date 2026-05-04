<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderConfirmationMail extends Mailable implements ShouldQueue
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
            'customer.user',
            'items',
            'payment.method',
            'shipment.method',
        ]);

        return $this->subject(
            __('ui.email.order_confirmation_subject', [
                'order' => $this->order->order_number,
            ])
        )->view('emails.orders.confirmation');
    }
}
