<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDonationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // público
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:1', 'max:10000'],
            'payment_method_code' => ['required', 'in:ifthenpay_mb,ifthenpay_mbway'],

            'donor_name' => ['nullable', 'string', 'max:120'],
            'donor_email' => ['nullable', 'email', 'max:190'],
            'donor_phone' => ['nullable', 'string', 'max:40'],

            // obrigatório para MB WAY
            'phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Indica um montante.',
            'amount.min' => 'Montante mínimo é 1€.',
            'payment_method_code.required' => 'Escolhe método de pagamento.',
        ];
    }
}
