<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\AttributeTranslation;
use App\Models\Language;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AttributeController extends Controller
{
    public function index(Request $request, string $locale): Response|JsonResponse
    {
        $languages = Language::query()
            ->whereIn('code', ['pt', 'en'])
            ->get()
            ->keyBy('code');

        $attributes = Attribute::query()
            ->with([
                'translations.language',
                'values.translations.language',
            ])
            ->orderBy('code')
            ->get()
            ->map(function (Attribute $attribute) {
                return [
                    'id' => $attribute->id,
                    'code' => $attribute->code,
                    'is_active' => (bool) $attribute->is_active,
                    'translations' => $attribute->translations->map(function ($translation) {
                        return [
                            'id' => $translation->id,
                            'language_id' => $translation->language_id,
                            'language_code' => $translation->language?->code,
                            'name' => $translation->name,
                        ];
                    })->values(),
                    'values_count' => $attribute->values->count(),
                    'values' => $attribute->values->map(function ($value) {
                        return [
                            'id' => $value->id,
                            'attribute_id' => $value->attribute_id,
                            'code' => $value->code,
                            'translations' => $value->translations->map(function ($translation) {
                                return [
                                    'id' => $translation->id,
                                    'language_id' => $translation->language_id,
                                    'language_code' => $translation->language?->code,
                                    'name' => $translation->name,
                                ];
                            })->values(),
                        ];
                    })->values(),
                ];
            })
            ->values();

        if ($request->wantsJson()) {
            return response()->json([
                'attributes' => $attributes,
            ]);
        }

        return Inertia::render('Manager/Products/Index', [
            'attributeManager' => [
                'attributes' => $attributes,
                'languages' => [
                    'pt' => $languages->get('pt')?->id,
                    'en' => $languages->get('en')?->id,
                ],
            ],
        ]);
    }

    public function store(Request $request, string $locale): RedirectResponse|JsonResponse
    {
        $languages = Language::query()
            ->whereIn('code', ['pt', 'en'])
            ->get()
            ->keyBy('code');

        $ptLanguageId = $languages->get('pt')?->id;
        $enLanguageId = $languages->get('en')?->id;

        $data = $request->validate([
            'code' => [
                'required',
                'string',
                'max:60',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('attributes', 'code'),
            ],
            'is_active' => ['nullable', 'boolean'],
            'translations.pt.name' => ['required', 'string', 'max:255'],
            'translations.en.name' => ['required', 'string', 'max:255'],
        ]);

        $attribute = Attribute::query()->create([
            'code' => $data['code'],
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        AttributeTranslation::query()->create([
            'attribute_id' => $attribute->id,
            'language_id' => $ptLanguageId,
            'name' => $data['translations']['pt']['name'],
        ]);

        AttributeTranslation::query()->create([
            'attribute_id' => $attribute->id,
            'language_id' => $enLanguageId,
            'name' => $data['translations']['en']['name'],
        ]);

        $attribute->load(['translations.language', 'values.translations.language']);

        $payload = [
            'id' => $attribute->id,
            'code' => $attribute->code,
            'is_active' => (bool) $attribute->is_active,
            'translations' => $attribute->translations->map(function ($translation) {
                return [
                    'id' => $translation->id,
                    'language_id' => $translation->language_id,
                    'language_code' => $translation->language?->code,
                    'name' => $translation->name,
                ];
            })->values(),
            'values_count' => 0,
            'values' => [],
        ];

        if ($request->wantsJson()) {
            return response()->json([
                'message' => __('ui.attributes.created', ['default' => 'Atributo criado com sucesso.']),
                'attribute' => $payload,
            ], 201);
        }

        return back()->with('success', __('ui.attributes.created', ['default' => 'Atributo criado com sucesso.']));
    }

    public function update(Request $request, string $locale, Attribute $attribute): RedirectResponse|JsonResponse
    {
        $languages = Language::query()
            ->whereIn('code', ['pt', 'en'])
            ->get()
            ->keyBy('code');

        $ptLanguageId = $languages->get('pt')?->id;
        $enLanguageId = $languages->get('en')?->id;

        $data = $request->validate([
            'code' => [
                'required',
                'string',
                'max:60',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('attributes', 'code')->ignore($attribute->id),
            ],
            'is_active' => ['required', 'boolean'],
            'translations.pt.name' => ['required', 'string', 'max:255'],
            'translations.en.name' => ['required', 'string', 'max:255'],
        ]);

        $attribute->update([
            'code' => $data['code'],
            'is_active' => (bool) $data['is_active'],
        ]);

        AttributeTranslation::query()->updateOrCreate(
            [
                'attribute_id' => $attribute->id,
                'language_id' => $ptLanguageId,
            ],
            [
                'name' => $data['translations']['pt']['name'],
            ]
        );

        AttributeTranslation::query()->updateOrCreate(
            [
                'attribute_id' => $attribute->id,
                'language_id' => $enLanguageId,
            ],
            [
                'name' => $data['translations']['en']['name'],
            ]
        );

        $attribute->load(['translations.language', 'values.translations.language']);

        $payload = [
            'id' => $attribute->id,
            'code' => $attribute->code,
            'is_active' => (bool) $attribute->is_active,
            'translations' => $attribute->translations->map(function ($translation) {
                return [
                    'id' => $translation->id,
                    'language_id' => $translation->language_id,
                    'language_code' => $translation->language?->code,
                    'name' => $translation->name,
                ];
            })->values(),
            'values_count' => $attribute->values->count(),
            'values' => $attribute->values->map(function ($value) {
                return [
                    'id' => $value->id,
                    'attribute_id' => $value->attribute_id,
                    'code' => $value->code,
                    'translations' => $value->translations->map(function ($translation) {
                        return [
                            'id' => $translation->id,
                            'language_id' => $translation->language_id,
                            'language_code' => $translation->language?->code,
                            'name' => $translation->name,
                        ];
                    })->values(),
                ];
            })->values(),
        ];

        if ($request->wantsJson()) {
            return response()->json([
                'message' => __('ui.attributes.updated', ['default' => 'Atributo atualizado com sucesso.']),
                'attribute' => $payload,
            ]);
        }

        return back()->with('success', __('ui.attributes.updated', ['default' => 'Atributo atualizado com sucesso.']));
    }

    public function destroy(Request $request, string $locale, Attribute $attribute): RedirectResponse|JsonResponse
    {
        if ($attribute->values()->exists()) {
            $message = __('ui.attributes.delete_blocked_has_values', [
                'default' => 'Não podes apagar este atributo porque ainda tem valores associados.',
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => $message,
                ], 422);
            }

            return back()->withErrors([
                'attribute' => $message,
            ]);
        }

        if ($attribute->variantValues()->exists()) {
            $message = __('ui.attributes.delete_blocked_in_use', [
                'default' => 'Não podes apagar este atributo porque já está a ser usado em variantes.',
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => $message,
                ], 422);
            }

            return back()->withErrors([
                'attribute' => $message,
            ]);
        }

        $attribute->translations()->delete();
        $attribute->delete();

        $message = __('ui.attributes.deleted', ['default' => 'Atributo apagado com sucesso.']);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => $message,
            ]);
        }

        return back()->with('success', $message);
    }
}
