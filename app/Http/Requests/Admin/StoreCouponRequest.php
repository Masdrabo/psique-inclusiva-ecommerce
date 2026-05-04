<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user() && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:64', 'uppercase', 'alpha_dash', Rule::unique('coupons', 'code')],
            'name' => ['required', 'string', 'max:160'],

            'type' => ['required', Rule::in(['fixed_amount', 'percentage'])],

            'amount' => ['nullable', 'numeric', 'min:0'],
            'percentage' => ['nullable', 'numeric', 'gt:0', 'lte:100'],

            'minimum_subtotal_amount' => ['nullable', 'numeric', 'min:0'],

            'max_total_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_user' => ['nullable', 'integer', 'min:1'],

            'is_active' => ['nullable', 'boolean'],

            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ];
    }

    public function after(): array
    {
        return [
            function ($validator) {
                $type = $this->input('type');

                if ($type === 'fixed_amount' && !$this->filled('amount')) {
                    $validator->errors()->add('amount', __('ui.coupons.validation.amount_required'));
                }

                if ($type === 'percentage' && !$this->filled('percentage')) {
                    $validator->errors()->add('percentage', __('ui.coupons.validation.percentage_required'));
                }
            },
        ];
    }
}
