<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="utf-8">

    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            color: #111827;
            font-size: 13px;
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }

        .page {
            padding: 42px;
        }

        .header {
            border-bottom: 2px solid #059669;
            padding-bottom: 18px;
            margin-bottom: 28px;
        }

        .brand {
            font-size: 22px;
            font-weight: bold;
            color: #064e3b;
        }

        .subtitle {
            color: #6b7280;
            margin-top: 4px;
        }

        .title {
            font-size: 26px;
            font-weight: bold;
            margin: 28px 0 8px;
        }

        .badge {
            display: inline-block;
            background: #dcfce7;
            color: #166534;
            padding: 6px 12px;
            border-radius: 999px;
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 20px;
        }

        .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 18px;
            margin-bottom: 18px;
        }

        .row {
            margin-bottom: 10px;
        }

        .label {
            color: #6b7280;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .04em;
            margin-bottom: 2px;
        }

        .value {
            font-size: 15px;
            font-weight: bold;
        }

        .amount {
            font-size: 24px;
            color: #047857;
            font-weight: bold;
        }

        .note {
            margin-top: 28px;
            padding: 14px;
            background: #f9fafb;
            border: 1px dashed #d1d5db;
            border-radius: 10px;
            color: #374151;
            font-size: 12px;
        }

        .footer {
            position: fixed;
            bottom: 28px;
            left: 42px;
            right: 42px;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
            color: #6b7280;
            font-size: 10px;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="header">
            <div class="brand">Psique Inclusiva Online</div>
            <div class="subtitle">Comprovativo de pagamento de donativo</div>
        </div>

        <div class="badge">Pago</div>

        <div class="title">Comprovativo de Donativo</div>

        <div class="card">
            <div class="row">
                <div class="label">Número do donativo</div>
                <div class="value">{{ $donation->donation_number }}</div>
            </div>

            <div class="row">
                <div class="label">Valor</div>
                <div class="amount">{{ number_format($donation->amount / 100, 2, ',', '.') }} €</div>
            </div>

            <div class="row">
                <div class="label">Método de pagamento</div>
                <div class="value">
                    {{ $donation->paymentMethod?->name ?? 'N/A' }}
                </div>
            </div>

            <div class="row">
                <div class="label">Data de pagamento</div>
                <div class="value">
                    {{ optional($donation->paid_at)->format('d/m/Y H:i') }}
                </div>
            </div>
        </div>

        <div class="card">
            <div class="row">
                <div class="label">Doador</div>
                <div class="value">
                    {{ $donation->donor_name ?: 'Não indicado' }}
                </div>
            </div>

            <div class="row">
                <div class="label">Email</div>
                <div class="value">
                    {{ $donation->donor_email ?: 'Não indicado' }}
                </div>
            </div>

            <div class="row">
                <div class="label">Referência / Pedido</div>
                <div class="value">
                    {{ $donation->provider_payment_id ?: $donation->reference ?: 'N/A' }}
                </div>
            </div>
        </div>

        <div class="note">
            Este documento é um comprovativo de pagamento de donativo.
            Não constitui recibo fiscal nem documento certificado para efeitos fiscais.
        </div>

        <div class="footer">
            Documento gerado automaticamente em {{ now()->format('d/m/Y H:i') }}.
        </div>
    </div>
</body>
</html>
