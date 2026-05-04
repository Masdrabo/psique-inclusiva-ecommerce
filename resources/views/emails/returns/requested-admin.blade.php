@php
    $orderReturn = $orderReturn;
    $order = $orderReturn->order;
    $brandName = config('app.name', 'Psique Inclusiva');

    $heading = app()->getLocale() === 'en'
        ? 'New return / refund request'
        : 'Novo pedido de devolução / reembolso';

    $intro = app()->getLocale() === 'en'
        ? 'A customer submitted a new request related to order :order.'
        : 'Um cliente submeteu um novo pedido relacionado com a encomenda :order.';

    $requestedAtLabel = app()->getLocale() === 'en' ? 'Requested at' : 'Pedido em';
    $customerLabel = app()->getLocale() === 'en' ? 'Customer' : 'Cliente';
    $emailLabel = app()->getLocale() === 'en' ? 'Email' : 'Email';
    $orderLabel = app()->getLocale() === 'en' ? 'Order' : 'Encomenda';
    $returnLabel = app()->getLocale() === 'en' ? 'Return' : 'Devolução';
    $statusLabel = app()->getLocale() === 'en' ? 'Status' : 'Estado';
    $notesLabel = app()->getLocale() === 'en' ? 'Notes' : 'Notas';
    $reasonLabel = app()->getLocale() === 'en' ? 'Reason' : 'Motivo';
    $conditionLabel = app()->getLocale() === 'en' ? 'Condition' : 'Condição';
    $resolutionLabel = app()->getLocale() === 'en' ? 'Resolution' : 'Resolução';
    $itemsLabel = app()->getLocale() === 'en' ? 'Items' : 'Artigos';
@endphp

<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $heading }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; margin:0; padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
                    <tr>
                        <td style="background:#111827; padding:24px 32px;">
                            <div style="font-size:14px; letter-spacing:0.08em; text-transform:uppercase; color:#d1d5db; font-weight:700;">
                                {{ $brandName }}
                            </div>
                            <div style="margin-top:10px; font-size:28px; line-height:1.2; font-weight:700; color:#ffffff;">
                                {{ $heading }}
                            </div>
                            <div style="margin-top:8px; font-size:15px; color:#e5e7eb;">
                                {{ str_replace(':order', $order?->order_number ?? '-', $intro) }}
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px; border-collapse:separate; border-spacing:0;">
                                <tr>
                                    <td style="width:50%; padding:16px; background:#f9fafb; border:1px solid #e5e7eb;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ $returnLabel }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ $orderReturn->return_number }}
                                        </div>
                                    </td>
                                    <td style="width:50%; padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-left:none;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ $orderLabel }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ $order?->order_number ?? '-' }}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-top:none;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ $customerLabel }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ $order?->user?->name ?? '-' }}
                                        </div>
                                        <div style="margin-top:4px; font-size:13px; color:#4b5563;">
                                            {{ $emailLabel }}: {{ $order?->user?->email ?? '-' }}
                                        </div>
                                    </td>
                                    <td style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-top:none; border-left:none;">
                                        <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ $statusLabel }}
                                        </div>
                                        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#111827;">
                                            {{ __('ui.returns.statuses.' . ($orderReturn->status ?? 'requested')) }}
                                        </div>

                                        <div style="margin-top:10px; font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:700;">
                                            {{ $requestedAtLabel }}
                                        </div>
                                        <div style="margin-top:6px; font-size:14px; color:#111827;">
                                            {{ optional($orderReturn->requested_at)->format('Y-m-d H:i:s') ?? optional($orderReturn->created_at)->format('Y-m-d H:i:s') ?? '-' }}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            @if($orderReturn->reason)
                                <p style="margin:0 0 10px; font-size:14px; color:#374151;">
                                    <strong>{{ $reasonLabel }}:</strong> {{ $orderReturn->reason }}
                                </p>
                            @endif

                            @if($orderReturn->notes)
                                <p style="margin:0 0 16px; font-size:14px; color:#374151;">
                                    <strong>{{ $notesLabel }}:</strong> {{ $orderReturn->notes }}
                                </p>
                            @endif

                            <div style="margin:0 0 12px; font-size:18px; font-weight:700; color:#111827;">
                                {{ $itemsLabel }}
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
                                            {{ __('ui.refunds.qty') }}
                                        </th>
                                        <th align="left" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ $reasonLabel }}
                                        </th>
                                        <th align="left" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ $conditionLabel }}
                                        </th>
                                        <th align="left" style="padding:12px; border:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; color:#6b7280;">
                                            {{ $resolutionLabel }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($orderReturn->items as $item)
                                        <tr>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->orderItem?->name ?? '-' }}
                                            </td>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#4b5563;">
                                                {{ $item->orderItem?->sku ?? '-' }}
                                            </td>
                                            <td align="right" style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->qty }}
                                            </td>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->reason ?? '-' }}
                                            </td>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->condition ?? '-' }}
                                            </td>
                                            <td style="padding:12px; border:1px solid #e5e7eb; font-size:14px; color:#111827;">
                                                {{ $item->resolution ?? '-' }}
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
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
