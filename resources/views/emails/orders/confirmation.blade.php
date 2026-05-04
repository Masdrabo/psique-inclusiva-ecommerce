@php
    $currency = $order->currency;
    $symbol = $currency?->symbol ?? '€';
    $dp = (int) ($currency?->decimal_places ?? 2);

    $money = function ($amount) use ($symbol, $dp) {
        $value = number_format(((int) $amount) / (10 ** $dp), $dp, '.', '');
        return $value . ' ' . $symbol;
    };

    $formatAddress = function ($address) {
        if (!is_array($address)) {
            return '—';
        }

        $parts = array_filter([
            $address['name'] ?? null,
            $address['line1'] ?? null,
            $address['line2'] ?? null,
            trim(($address['postal_code'] ?? '') . ' ' . ($address['city'] ?? '')),
            $address['region'] ?? null,
            $address['country_code'] ?? null,
        ]);

        return implode("\n", $parts);
    };

    $brandName = config('app.name', 'Psique Inclusiva');

    $items = $order->items ?? collect();

    $pricesIncludeTax = collect($items)->contains(function ($item) {
        return (bool) data_get($item, 'meta.price_includes_tax', false);
    });

    $hasShippingAddress = is_array($order->shipping_address) && !empty(array_filter($order->shipping_address));
@endphp

<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('ui.email.order_confirmation_subject', ['order' => $order->order_number]) }}</title>
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
                                {{ __('ui.email.order_confirmation_heading') }}
                            </div>
                            <div style="margin-top:8px; font-size:15px; color:#e5e7eb;">
                                {{ __('ui.email.order_confirmation_intro') }}
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 16px; font-size:15px; color:#374151;">
                                {{ __('ui.email.hello') }}
                                @if($order->customer?->user?->name)
                                    <strong>{{ $order->customer->user->name }}</strong>
                                @endif
                            </p>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px; border-collapse:separate; border-spacing:0;">
                                <tr>
                                    <td style="width:50%; padding:16px; background:#f9fafb; border:1px solid #e5e7eb;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ __('ui.email.order_number') }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ $order->order_number }}
                                        </div>
                                    </td>
                                    <td style="width:50%; padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-left:none;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ __('ui.email.order_status') }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ $order->status?->name ?? $order->status?->code ?? '—' }}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-top:none;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ __('ui.email.order_total') }}
                                        </div>
                                        <div style="margin-top:6px; font-size:22px; font-weight:700; color:#111827;">
                                            {{ $money($order->total_amount) }}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            @if($pricesIncludeTax)
                                <div style="margin:0 0 24px; padding:14px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; font-size:14px; color:#1e3a8a;">
                                    <div style="font-weight:700; margin-bottom:4px;">
                                        {{ __('ui.checkout.tax_included') }}
                                    </div>
                                    <div>
                                        {{ __('ui.checkout.tax_calculated_after_discount') }}
                                    </div>
                                </div>
                            @else
                                <div style="margin:0 0 24px; padding:14px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; font-size:14px; color:#1e3a8a;">
                                    {{ __('ui.checkout.tax_calculated_after_discount') }}
                                </div>
                            @endif

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
                                    @foreach($items as $item)
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

                            <div style="margin:0 0 12px; font-size:18px; font-weight:700; color:#111827;">
                                {{ __('ui.email.summary') }}
                            </div>

                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                                <tr>
                                    <td style="padding:10px 0; font-size:14px; color:#4b5563;">{{ __('ui.email.subtotal') }}</td>
                                    <td align="right" style="padding:10px 0; font-size:14px; color:#111827;">{{ $money($order->subtotal_amount) }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0; font-size:14px; color:#4b5563;">{{ __('ui.email.shipping') }}</td>
                                    <td align="right" style="padding:10px 0; font-size:14px; color:#111827;">{{ $money($order->shipping_amount) }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0; font-size:14px; color:#4b5563;">{{ __('ui.email.tax') }}</td>
                                    <td align="right" style="padding:10px 0; font-size:14px; color:#111827;">{{ $money($order->tax_amount) }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0; font-size:14px; color:#4b5563;">{{ __('ui.email.discount') }}</td>
                                    <td align="right" style="padding:10px 0; font-size:14px; color:#111827;">- {{ $money($order->discount_amount) }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:14px 0 0; border-top:2px solid #e5e7eb; font-size:16px; font-weight:700; color:#111827;">
                                        {{ __('ui.email.total') }}
                                    </td>
                                    <td align="right" style="padding:14px 0 0; border-top:2px solid #e5e7eb; font-size:18px; font-weight:700; color:#111827;">
                                        {{ $money($order->total_amount) }}
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td valign="top" style="width:50%; padding-right:10px;">
                                        <div style="font-size:16px; font-weight:700; color:#111827; margin-bottom:10px;">
                                            {{ __('ui.email.billing_address') }}
                                        </div>
                                        <div style="white-space:pre-wrap; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; font-size:14px; color:#374151;">{{ $formatAddress($order->billing_address) }}</div>
                                    </td>
                                    <td valign="top" style="width:50%; padding-left:10px;">
                                        <div style="font-size:16px; font-weight:700; color:#111827; margin-bottom:10px;">
                                            {{ __('ui.email.shipping_address') }}
                                        </div>
                                        <div style="white-space:pre-wrap; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; font-size:14px; color:#374151;">{{ $hasShippingAddress ? $formatAddress($order->shipping_address) : __('ui.checkout.no_shipping_required_short') }}</div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:24px 0 0; font-size:14px; color:#4b5563;">
                                {{ __('ui.email.order_confirmation_outro') }}
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
