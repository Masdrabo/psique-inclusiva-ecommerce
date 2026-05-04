<?php

namespace App\Http\Requests\Manager;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $slug = $this->input('slug');
        $ptName = $this->input('translations.pt.name');

        if ((!is_string($slug) || trim($slug) === '') && is_string($ptName) && trim($ptName) !== '') {
            $slug = Str::slug(Str::lower($ptName));
        }

        $this->merge([
            'slug' => is_string($slug) ? Str::slug(Str::lower($slug)) : $slug,
            'is_active' => $this->has('is_active') ? (bool) $this->input('is_active') : true,
            'remove_image' => $this->has('remove_image') ? (bool) $this->input('remove_image') : false,
        ]);
    }

    public function rules(): array
    {
        return [
            'slug' => ['required', 'string', 'max:190', 'unique:categories,slug'],

            'parent_id' => ['nullable', 'exists:categories,id'],

            'is_active' => ['sometimes', 'boolean'],

            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'remove_image' => ['sometimes', 'boolean'],

            'translations' => ['required', 'array'],

            'translations.pt' => ['required', 'array'],
            'translations.en' => ['required', 'array'],

            'translations.pt.name' => ['required', 'string', 'max:160'],
            'translations.en.name' => ['required', 'string', 'max:160'],

            'translations.pt.description' => ['nullable', 'string'],
            'translations.en.description' => ['nullable', 'string'],

            'translations.pt.meta_title' => ['nullable', 'string', 'max:160'],
            'translations.en.meta_title' => ['nullable', 'string', 'max:160'],

            'translations.pt.meta_description' => ['nullable', 'string', 'max:255'],
            'translations.en.meta_description' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'slug.required' => __('ui.validation.slug_required'),
            'slug.unique' => __('ui.validation.slug_unique'),
            'slug.max' => __('ui.validation.slug_max'),

            'translations.required' => __('ui.validation.translations_required'),

            'translations.pt.required' => __('ui.validation.pt_required'),
            'translations.en.required' => __('ui.validation.en_required'),

            'translations.pt.name.required' => __('ui.validation.pt_name_required'),
            'translations.en.name.required' => __('ui.validation.en_name_required'),
        ];
    }
}
