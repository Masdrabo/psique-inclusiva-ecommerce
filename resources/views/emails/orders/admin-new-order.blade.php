@php
    $currency = $order->currency;
    $symbol = $currency?->symbol ?? '€';
    $dp = (int) ($currency?->decimal_places ?? 2);

    $money = function ($amount) use ($symbol, $dp) {
        $value = number_format(((int) $amount) / (10 ** $dp), $dp, '.', '');
        return $value . ' ' . $symbol;
    };

    $brandName = config('app.name', 'Psique Inclusiva');
@endphp

<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('ui.email.admin_new_order_subject', ['order' => $order->order_number]) }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; margin:0; padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
                    <tr>
                        <td style="background:#111827; padding:24px 32px;">
                            <div style="font-size:14px; letter-spacing:0.08em; text-transform:uppercase; color:#d1d5db; font-weight:700;">
                                {{ $brandName }}
                            </div>
                            <div style="margin-top:10px; font-size:28px; line-height:1.2; font-weight:700; color:#ffffff;">
                                {{ __('ui.email.admin_new_order_heading') }}
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                                <tr>
                                    <td style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ __('ui.email.order_number') }}
                                        </div>
                                        <div style="margin-top:6px; font-size:18px; font-weight:700; color:#111827;">
                                            {{ $order->order_number }}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                                <tr>
                                    <td style="width:50%; padding:12px 0; font-size:14px; color:#4b5563;">
                                        <strong>{{ __('ui.email.order_status') }}</strong>
                                    </td>
                                    <td align="right" style="width:50%; padding:12px 0; font-size:14px; color:#111827;">
                                        {{ $order->status?->name ?? $order->status?->code ?? '—' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:12px 0; font-size:14px; color:#4b5563;">
                                        <strong>{{ __('ui.email.order_total') }}</strong>
                                    </td>
                                    <td align="right" style="padding:12px 0; font-size:14px; color:#111827;">
                                        {{ $money($order->total_amount) }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:12px 0; font-size:14px; color:#4b5563;">
                                        <strong>{{ __('ui.email.customer_name') }}</strong>
                                    </td>
                                    <td align="right" style="padding:12px 0; font-size:14px; color:#111827;">
                                        {{ $order->customer?->user?->name ?? '—' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:12px 0; font-size:14px; color:#4b5563;">
                                        <strong>{{ __('ui.email.customer_email') }}</strong>
                                    </td>
                                    <td align="right" style="padding:12px 0; font-size:14px; color:#111827;">
                                        {{ $order->customer?->user?->email ?? '—' }}
                                    </td>
                                </tr>
                            </table>

                            <div style="margin:0 0 12px; font-size:18px; font-weight:700; color:#111827;">
                                {{ __('ui.email.items') }}
                            </div>

                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                                <thead>
                                    <tr style="background:#f9fafb;">
                                        <th align="left" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ __('ui.email.item') }}
                                        </th>
                                        <th align="left" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            SKU
                                        </th>
                                        <th align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ __('ui.email.qty') }}
                                        </th>
                                        <th align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ __('ui.email.unit_price') }}
                                        </th>
                                        <th align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ __('ui.email.line_total') }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($order->items as $item)
                                        <tr>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->name }}
                                            </td>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#4b5563;">
                                                {{ $item->sku }}
                                            </td>
                                            <td align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->qty }}
                                            </td>
                                            <td align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $money($item->unit_amount) }}
                                            </td>
                                            <td align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:14px; font-weight:700; color:#111827;">
                                                {{ $money($item->total_amount) }}
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>

                            <p style="margin:24px 0 0; font-size:14px; color:#4b5563;">
                                {{ __('ui.email.admin_new_order_outro') }}
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
                            <div style="font-size:12px; color:#6b7280;">
                                {{ $brandName }}
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
