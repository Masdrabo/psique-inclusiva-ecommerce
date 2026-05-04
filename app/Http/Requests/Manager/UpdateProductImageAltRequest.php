<?php

namespace App\Http\Requests\Manager;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductImageAltRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'translations' => ['required', 'array'],
            'translations.pt' => ['required', 'array'],
            'translations.en' => ['required', 'array'],

            'translations.pt.alt' => ['nullable', 'string', 'max:255'],
            'translations.en.alt' => ['nullable', 'string', 'max:255'],
        ];
    }
}
