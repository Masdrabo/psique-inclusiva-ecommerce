<?php

namespace App\Mail;

use App\Models\OrderReturn;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReturnRequestedMail extends Mailable implements ShouldQueue
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

        return $this->locale($this->localeCode)
            ->subject(
                __('ui.email.return_requested_subject', [
                    'return' => $this->orderReturn->return_number,
                    'order' => $this->orderReturn->order?->order_number,
                ])
            )
            ->view('emails.returns.requested');
    }
}
