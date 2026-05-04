<?php

namespace App\Http\Requests\Manager;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $slug = $this->input('slug');

        $this->merge([
            'slug' => is_string($slug) ? Str::slug(Str::lower($slug)) : $slug,
            'is_active' => $this->has('is_active') ? (bool) $this->input('is_active') : true,
            'remove_image' => $this->has('remove_image') ? (bool) $this->input('remove_image') : false,
        ]);
    }

    public function rules(): array
    {
        /** @var Category|null $category */
        $category = $this->route('category');
        $id = $category?->id;

        $parentRules = ['nullable', 'exists:categories,id'];
        if ($id) {
            $parentRules[] = Rule::notIn([(int) $id]);
        }

        return [
            'slug' => [
                'required',
                'string',
                'max:190',
                Rule::unique('categories', 'slug')->ignore($id),
            ],

            'parent_id' => $parentRules,

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

    public function after(): array
    {
        return [
            function ($validator) {
                /** @var Category|null $category */
                $category = $this->route('category');
                if (!$category) return;

                $parentId = $this->input('parent_id');
                if (!$parentId) return;

                $categoryId = (int) $category->id;
                $parentId   = (int) $parentId;

                if ($parentId === $categoryId) {
                    $validator->errors()->add('parent_id', 'Uma categoria não pode ser parent dela própria.');
                    return;
                }

                $maxDepth = 50;

                try {
                    $sql = "
                        WITH RECURSIVE ancestors AS (
                            SELECT id, parent_id, 0 AS depth
                            FROM categories
                            WHERE id = ?

                            UNION ALL

                            SELECT c.id, c.parent_id, a.depth + 1
                            FROM categories c
                            INNER JOIN ancestors a ON c.id = a.parent_id
                            WHERE a.parent_id IS NOT NULL AND a.depth < ?
                        )
                        SELECT
                            MAX(depth) AS max_depth,
                            SUM(id = ?) AS hits
                        FROM ancestors
                    ";

                    $row = DB::selectOne($sql, [$parentId, $maxDepth, $categoryId]);

                    $hits = (int) ($row->hits ?? 0);
                    $usedDepth = (int) ($row->max_depth ?? 0);

                    if ($hits > 0) {
                        $validator->errors()->add(
                            'parent_id',
                            'Não podes escolher como parent uma categoria descendente.'
                        );
                        return;
                    }

                    if ($usedDepth >= $maxDepth) {
                        $validator->errors()->add(
                            'parent_id',
                            'Hierarquia inválida ou demasiado profunda.'
                        );
                        return;
                    }

                    return;
                } catch (\Throwable $e) {
                    // fallback loop
                }

                $seen = [];
                $hops = 0;

                $current = Category::query()
                    ->select(['id', 'parent_id'])
                    ->find($parentId);

                while ($current) {
                    $hops++;

                    if ($hops > $maxDepth) {
                        $validator->errors()->add('parent_id', 'Hierarquia inválida ou demasiado profunda.');
                        return;
                    }

                    $currentId = (int) $current->id;

                    if (isset($seen[$currentId])) {
                        $validator->errors()->add('parent_id', 'Ciclo detectado na hierarquia.');
                        return;
                    }

                    $seen[$currentId] = true;

                    if ($currentId === $categoryId) {
                        $validator->errors()->add(
                            'parent_id',
                            'Não podes escolher como parent uma categoria descendente.'
                        );
                        return;
                    }

                    if ($current->parent_id === null) return;

                    $current = Category::query()
                        ->select(['id', 'parent_id'])
                        ->find((int) $current->parent_id);
                }
            }
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
