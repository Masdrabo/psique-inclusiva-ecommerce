<?php

namespace App\Mail;

use App\Models\Refund;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RefundIssuedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Refund $refund;
    public string $localeCode;

    public function __construct(Refund $refund, string $localeCode = 'pt')
    {
        $this->refund = $refund;
        $this->localeCode = $localeCode;

        $this->onQueue('emails');
    }

    public function build(): static
    {
        app()->setLocale($this->localeCode);

        $this->refund->loadMissing([
            'order.currency',
            'order.customer.user',
            'items.orderItem',
        ]);

        return $this->subject(
            __('ui.email.refund_issued_subject', [
                'order' => $this->refund->order?->order_number,
            ])
        )->view('emails.orders.refund-issued');
    }
}
