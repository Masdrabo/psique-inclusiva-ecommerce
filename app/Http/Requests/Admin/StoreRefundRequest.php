<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user() && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],

            'items' => ['nullable', 'array'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],

            'shipping_amount' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $items = collect($this->input('items', []))
                ->filter(function ($row) {
                    return !empty($row['order_item_id']) && (int) ($row['qty'] ?? 0) > 0;
                });

            $shippingAmount = (int) $this->input('shipping_amount', 0);

            if ($items->isEmpty() && $shippingAmount <= 0) {
                $validator->errors()->add(
                    'refund',
                    __('ui.refunds.errors.invalid_item')
                );
            }
        });
    }
}
