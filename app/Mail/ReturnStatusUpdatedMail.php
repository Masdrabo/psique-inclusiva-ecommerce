<?php

namespace App\Mail;

use App\Models\OrderReturn;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReturnStatusUpdatedMail extends Mailable implements ShouldQueue
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

        $this->orderReturn->loadMissing([
            'order.user',
            'order.currency',
            'items.orderItem',
        ]);

        return $this->subject(
            __('ui.email.return_status_updated_subject', [
                'return' => $this->orderReturn->return_number,
                'status' => __('ui.returns.statuses.' . ($this->orderReturn->status ?? 'requested')),
            ])
        )->view('emails.returns.status-updated');
    }
}
