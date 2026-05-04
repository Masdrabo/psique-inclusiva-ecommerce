<?php

namespace App\Mail;

use App\Models\OrderReturn;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReturnRequestedAdminMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public OrderReturn $orderReturn;
    public string $localeCode;

    public function __construct(OrderReturn $orderReturn, string $localeCode = 'pt')
    {
        $this->orderReturn = $orderReturn;
        $this->localeCode = $localeCode;

        $this->onQueue('emails');
    }

    public function build(): static
    {
        app()->setLocale($this->localeCode);

        $subject = $this->localeCode === 'en'
            ? 'New return request ' . $this->orderReturn->return_number . ' for order ' . ($this->orderReturn->order?->order_number ?? '-')
            : 'Novo pedido de devolução ' . $this->orderReturn->return_number . ' da encomenda ' . ($this->orderReturn->order?->order_number ?? '-');

        return $this->subject($subject)
            ->view('emails.returns.requested-admin');
    }
}
