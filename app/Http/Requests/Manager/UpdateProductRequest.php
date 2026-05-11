<?php

namespace App\Http\Requests\Manager;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $slug = $this->input('slug');
        $ptName = $this->input('translations.pt.name');
        $businessType = $this->input('business_type') ?: 'physical';
        $type = $this->input('type') ?: 'simple';

        /** bloqueio: produto que já nasceu/está como variável e tem variantes não volta a simple */
        /** @var Product|null $product */
        $product = $this->route('product');
        if ($product && $product->type === 'variable' && $type === 'simple') {
            $product->loadMissing('variants');

            if ($product->variants->count() > 0) {
                $type = 'variable';
            }
        }

        if ((!is_string($slug) || trim($slug) === '') && is_string($ptName) && trim($ptName) !== '') {
            $slug = Str::slug(Str::lower($ptName));
        }

        $variants = $this->input('variants', []);
        if (!is_array($variants)) {
            $variants = [];
        }

        $normalizedVariants = collect($variants)
            ->map(function ($variant) {
                if (!is_array($variant)) {
                    return [];
                }

                $attributeValueIds = $variant['attribute_value_ids'] ?? [];
                if (!is_array($attributeValueIds)) {
                    $attributeValueIds = [];
                }

                return [
                    'id' => isset($variant['id']) && $variant['id'] !== '' ? (int) $variant['id'] : null,
                    'sku' => isset($variant['sku']) ? trim((string) $variant['sku']) : null,
                    'barcode' => isset($variant['barcode']) && $variant['barcode'] !== ''
                        ? trim((string) $variant['barcode'])
                        : null,
                    'is_active' => array_key_exists('is_active', $variant)
                        ? filter_var($variant['is_active'], FILTER_VALIDATE_BOOLEAN)
                        : true,
                    'attribute_value_ids' => collect($attributeValueIds)
                        ->filter(fn ($id) => $id !== null && $id !== '')
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values()
                        ->all(),
                    'price' => array_key_exists('price', $variant) && $variant['price'] !== ''
                        ? str_replace(',', '.', (string) $variant['price'])
                        : null,
                    'compare_at_price' => array_key_exists('compare_at_price', $variant) && $variant['compare_at_price'] !== ''
                        ? str_replace(',', '.', (string) $variant['compare_at_price'])
                        : null,
                    'stock_qty' => array_key_exists('stock_qty', $variant) && $variant['stock_qty'] !== ''
                        ? (int) $variant['stock_qty']
                        : 0,
                ];
            })
            ->values()
            ->all();

        if ($type !== 'variable') {
            $normalizedVariants = [];
        }

        $normalized = [
            'slug' => is_string($slug) ? Str::slug(Str::lower($slug)) : $slug,
            'is_active' => $this->has('is_active')
                ? filter_var($this->input('is_active'), FILTER_VALIDATE_BOOLEAN)
                : true,
            'type' => $type,
            'business_type' => $businessType,
            'tax_rate' => $this->filled('tax_rate')
                ? str_replace(',', '.', (string) $this->input('tax_rate'))
                : '23.00',
            'price_includes_tax' => $this->has('price_includes_tax')
                ? filter_var($this->input('price_includes_tax'), FILTER_VALIDATE_BOOLEAN)
                : true,
            'requires_shipping' => $this->has('requires_shipping')
                ? filter_var($this->input('requires_shipping'), FILTER_VALIDATE_BOOLEAN)
                : ($businessType === 'physical'),
            'manages_inventory' => $this->has('manages_inventory')
                ? filter_var($this->input('manages_inventory'), FILTER_VALIDATE_BOOLEAN)
                : ($businessType === 'physical'),
            'allow_quantity' => $this->has('allow_quantity')
                ? filter_var($this->input('allow_quantity'), FILTER_VALIDATE_BOOLEAN)
                : ($businessType !== 'membership_fee'),
            'requires_customer_notes' => $this->has('requires_customer_notes')
                ? filter_var($this->input('requires_customer_notes'), FILTER_VALIDATE_BOOLEAN)
                : false,
            'price' => $this->filled('price')
                ? str_replace(',', '.', (string) $this->input('price'))
                : null,
            'compare_at_price' => $this->filled('compare_at_price')
                ? str_replace(',', '.', (string) $this->input('compare_at_price'))
                : null,
            'stock_qty' => $this->filled('stock_qty')
                ? (int) $this->input('stock_qty')
                : null,
            'variants' => $normalizedVariants,
        ];

        if ($businessType === 'membership_fee' && !$this->filled('max_per_order')) {
            $normalized['max_per_order'] = 1;
        }

        $businessDetail = $this->input('business_detail', []);
        if (!is_array($businessDetail)) {
            $businessDetail = [];
        }

        $normalized['business_detail'] = [
            'membership_period_unit' => $businessDetail['membership_period_unit'] ?? null,
            'membership_period_value' => isset($businessDetail['membership_period_value']) && $businessDetail['membership_period_value'] !== ''
                ? (int) $businessDetail['membership_period_value']
                : null,
            'membership_renews_manually' => array_key_exists('membership_renews_manually', $businessDetail)
                ? filter_var($businessDetail['membership_renews_manually'], FILTER_VALIDATE_BOOLEAN)
                : true,

            'delivery_mode' => $businessDetail['delivery_mode'] ?? null,
            'service_kind' => $businessDetail['service_kind'] ?? null,
            'access_instructions' => $businessDetail['access_instructions'] ?? null,

            'capacity' => isset($businessDetail['capacity']) && $businessDetail['capacity'] !== ''
                ? (int) $businessDetail['capacity']
                : null,
            'starts_at' => $businessDetail['starts_at'] ?? null,
            'ends_at' => $businessDetail['ends_at'] ?? null,
            'location' => $businessDetail['location'] ?? null,
            'meeting_url' => $businessDetail['meeting_url'] ?? null,
        ];

        $this->merge($normalized);
    }

    public function rules(): array
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $id = $product?->id;
        $isVariable = $this->input('type') === 'variable';

        return [
            'sku' => [
                'required',
                'string',
                'max:64',
                Rule::unique('products', 'sku')->ignore($id),
            ],

            'slug' => [
                'required',
                'string',
                'max:190',
                Rule::unique('products', 'slug')->ignore($id),
            ],

            'type' => ['required', 'in:simple,variable'],
            'business_type' => ['required', 'in:physical,membership_fee,digital_service'],
            'is_active' => ['sometimes', 'boolean'],

            'tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'price_includes_tax' => ['required', 'boolean'],

            'requires_shipping' => ['required', 'boolean'],
            'manages_inventory' => ['required', 'boolean'],
            'allow_quantity' => ['required', 'boolean'],
            'requires_customer_notes' => ['required', 'boolean'],

            'max_per_order' => ['nullable', 'integer', 'min:1'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after_or_equal:available_from'],

            'barcode' => ['nullable', 'string', 'max:128'],
            'weight_grams' => ['nullable', 'integer', 'min:0'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],

            'categories' => ['nullable', 'array'],
            'categories.*' => ['integer', 'exists:categories,id'],

            'price' => ['nullable', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0', 'gte:price'],

            'variants' => [
                Rule::requiredIf($isVariable),
                'array',
            ],
            'variants.*.id' => [
                'nullable',
                'integer',
                'exists:product_variants,id',
            ],
            'variants.*.sku' => [
                Rule::requiredIf($isVariable),
                'string',
                'max:64',
            ],
            'variants.*.barcode' => ['nullable', 'string', 'max:128'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.attribute_value_ids' => [
                Rule::requiredIf($isVariable),
                'array',
            ],
            'variants.*.attribute_value_ids.*' => ['integer', 'exists:attribute_values,id'],
            'variants.*.price' => [
                Rule::requiredIf($isVariable),
                'numeric',
                'min:0',
            ],
            'variants.*.compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.stock_qty' => ['nullable', 'integer', 'min:0'],

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

            'business_detail' => ['nullable', 'array'],

            'business_detail.membership_period_unit' => ['nullable', 'in:month,year'],
            'business_detail.membership_period_value' => ['nullable', 'integer', 'min:1'],
            'business_detail.membership_renews_manually' => ['nullable', 'boolean'],

            'business_detail.delivery_mode' => ['nullable', 'in:none,email,url,manual'],
            'business_detail.service_kind' => ['nullable', 'string', 'max:40'],
            'business_detail.access_instructions' => ['nullable', 'string'],

            'business_detail.capacity' => ['nullable', 'integer', 'min:1'],
            'business_detail.starts_at' => ['nullable', 'date'],
            'business_detail.ends_at' => ['nullable', 'date', 'after_or_equal:business_detail.starts_at'],
            'business_detail.location' => ['nullable', 'string', 'max:255'],
            'business_detail.meeting_url' => ['nullable', 'url', 'max:255'],
        ];
    }

    public function attributes(): array
    {
        return [
            'sku' => __('ui.common.sku'),
            'slug' => __('ui.common.slug'),
            'type' => __('ui.common.type'),
            'price' => __('ui.common.price'),
            'compare_at_price' => __('ui.common.compare_at_price'),
            'stock_qty' => __('ui.common.stock'),
            'barcode' => __('ui.common.barcode'),
            'weight_grams' => __('ui.common.weight_grams'),
            'tax_rate' => __('ui.manager.tax_rate'),
            'price_includes_tax' => __('ui.manager.price_includes_tax'),
            'business_detail.membership_period_unit' => __('ui.manager.membership_period_unit'),
            'business_detail.membership_period_value' => __('ui.manager.membership_period_value'),
            'variants' => __('ui.manager.variants'),
            'variants.*.sku' => __('ui.manager.variant_sku'),
            'variants.*.price' => __('ui.common.price'),
            'variants.*.compare_at_price' => __('ui.common.compare_at_price'),
            'variants.*.stock_qty' => __('ui.common.stock'),
            'variants.*.attribute_value_ids' => __('ui.manager.variant_attribute_values'),
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $businessType = $this->input('business_type');
            $type = $this->input('type');

            /** erro visível quando tentam forçar variable -> simple */
            /** @var Product|null $product */
            $product = $this->route('product');
            if ($product && $product->type === 'variable' && $type === 'simple') {
                $product->loadMissing('variants');

                if ($product->variants->count() > 0) {
                    $validator->errors()->add(
                        'type',
                        __('ui.manager.variable_to_simple_not_allowed')
                    );
                }
            }

            if ($businessType === 'physical') {
                if (!$this->boolean('requires_shipping')) {
                    $validator->errors()->add('requires_shipping', __('ui.manager.physical_requires_shipping'));
                }

                if (!$this->boolean('manages_inventory')) {
                    $validator->errors()->add('manages_inventory', __('ui.manager.physical_requires_inventory'));
                }

                if (!$this->filled('weight_grams')) {
                    $validator->errors()->add('weight_grams', __('ui.manager.physical_weight_required'));
                }
            }

            if ($businessType === 'membership_fee') {
                if ($this->boolean('requires_shipping')) {
                    $validator->errors()->add('requires_shipping', __('ui.manager.membership_no_shipping'));
                }

                if ($this->boolean('manages_inventory')) {
                    $validator->errors()->add('manages_inventory', __('ui.manager.membership_no_inventory'));
                }

                if ($this->boolean('allow_quantity')) {
                    $validator->errors()->add('allow_quantity', __('ui.manager.membership_no_free_quantity'));
                }

                if ((int) ($this->input('max_per_order') ?? 0) !== 1) {
                    $validator->errors()->add('max_per_order', __('ui.manager.membership_max_per_order_one'));
                }

                if (!$this->filled('business_detail.membership_period_unit')) {
                    $validator->errors()->add('business_detail.membership_period_unit', __('ui.manager.membership_period_unit_required'));
                }

                if (!$this->filled('business_detail.membership_period_value')) {
                    $validator->errors()->add('business_detail.membership_period_value', __('ui.manager.membership_period_value_required'));
                }
            }

            if ($businessType === 'digital_service') {
                if ($this->boolean('requires_shipping')) {
                    $validator->errors()->add('requires_shipping', __('ui.manager.digital_service_no_shipping'));
                }

                if ($this->boolean('manages_inventory')) {
                    $validator->errors()->add('manages_inventory', __('ui.manager.digital_service_no_inventory'));
                }
            }

            if ($type === 'simple') {
                if (!$this->filled('price')) {
                    $validator->errors()->add('price', __('ui.manager.simple_price_required'));
                }

                if (
                    !$this->boolean('manages_inventory')
                    && $this->filled('stock_qty')
                    && (int) $this->input('stock_qty') > 0
                ) {
                    $validator->errors()->add('stock_qty', __('ui.manager.stock_not_allowed_without_inventory'));
                }
            }

            if ($type === 'variable') {
                $variants = $this->input('variants', []);

                if (!is_array($variants) || count($variants) === 0) {
                    $validator->errors()->add('variants', __('ui.manager.variable_requires_variants'));
                }

                if ($this->filled('price')) {
                    $validator->errors()->add('price', __('ui.manager.variable_parent_price_not_used'));
                }

                if ($this->filled('compare_at_price')) {
                    $validator->errors()->add('compare_at_price', __('ui.manager.variable_parent_compare_at_price_not_used'));
                }

                if ($this->filled('stock_qty') && (int) $this->input('stock_qty') > 0) {
                    $validator->errors()->add('stock_qty', __('ui.manager.variable_parent_stock_not_used'));
                }

                if (is_array($variants)) {
                    $seenCombinations = [];

                    foreach ($variants as $index => $variant) {
                        $attributeValueIds = collect($variant['attribute_value_ids'] ?? [])
                            ->filter(fn ($id) => $id !== null && $id !== '')
                            ->map(fn ($id) => (int) $id)
                            ->sort()
                            ->values()
                            ->all();

                        if (empty($attributeValueIds)) {
                            continue;
                        }

                        $combinationKey = implode('|', $attributeValueIds);

                        if (in_array($combinationKey, $seenCombinations, true)) {
                            $validator->errors()->add(
                                "variants.{$index}.attribute_value_ids",
                                __('ui.manager.duplicate_variant_combination')
                            );
                        }

                        $seenCombinations[] = $combinationKey;

                        $compareAt = $variant['compare_at_price'] ?? null;
                        $price = $variant['price'] ?? null;

                        if (
                            $compareAt !== null
                            && $compareAt !== ''
                            && $price !== null
                            && $price !== ''
                            && (float) $compareAt < (float) $price
                        ) {
                            $validator->errors()->add(
                                "variants.{$index}.compare_at_price",
                                __('ui.manager.variant_compare_at_price_gte_price')
                            );
                        }

                        if (
                            !$this->boolean('manages_inventory')
                            && isset($variant['stock_qty'])
                            && (int) $variant['stock_qty'] > 0
                        ) {
                            $validator->errors()->add(
                                "variants.{$index}.stock_qty",
                                __('ui.manager.stock_not_allowed_without_inventory')
                            );
                        }
                    }
                }
            }
        });
    }
}
