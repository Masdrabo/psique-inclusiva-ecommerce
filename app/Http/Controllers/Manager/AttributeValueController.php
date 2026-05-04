<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\AttributeValueTranslation;
use App\Models\Language;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttributeValueController extends Controller
{
    public function store(Request $request, string $locale, Attribute $attribute): RedirectResponse|JsonResponse
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
                Rule::unique('attribute_values', 'code')->where(function ($query) use ($attribute) {
                    return $query->where('attribute_id', $attribute->id);
                }),
            ],
            'translations.pt.name' => ['required', 'string', 'max:255'],
            'translations.en.name' => ['required', 'string', 'max:255'],
        ]);

        $value = AttributeValue::query()->create([
            'attribute_id' => $attribute->id,
            'code' => $data['code'],
        ]);

        AttributeValueTranslation::query()->create([
            'attribute_value_id' => $value->id,
            'language_id' => $ptLanguageId,
            'name' => $data['translations']['pt']['name'],
        ]);

        AttributeValueTranslation::query()->create([
            'attribute_value_id' => $value->id,
            'language_id' => $enLanguageId,
            'name' => $data['translations']['en']['name'],
        ]);

        $value->load('translations.language');

        $payload = [
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

        if ($request->wantsJson()) {
            return response()->json([
                'message' => __('ui.attributes.values.created', ['default' => 'Valor criado com sucesso.']),
                'value' => $payload,
            ], 201);
        }

        return back()->with('success', __('ui.attributes.values.created', ['default' => 'Valor criado com sucesso.']));
    }

    public function update(
        Request $request,
        string $locale,
        Attribute $attribute,
        AttributeValue $value
    ): RedirectResponse|JsonResponse {
        if ((int) $value->attribute_id !== (int) $attribute->id) {
            abort(404);
        }

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
                Rule::unique('attribute_values', 'code')
                    ->where(function ($query) use ($attribute) {
                        return $query->where('attribute_id', $attribute->id);
                    })
                    ->ignore($value->id),
            ],
            'translations.pt.name' => ['required', 'string', 'max:255'],
            'translations.en.name' => ['required', 'string', 'max:255'],
        ]);

        $value->update([
            'code' => $data['code'],
        ]);

        AttributeValueTranslation::query()->updateOrCreate(
            [
                'attribute_value_id' => $value->id,
                'language_id' => $ptLanguageId,
            ],
            [
                'name' => $data['translations']['pt']['name'],
            ]
        );

        AttributeValueTranslation::query()->updateOrCreate(
            [
                'attribute_value_id' => $value->id,
                'language_id' => $enLanguageId,
            ],
            [
                'name' => $data['translations']['en']['name'],
            ]
        );

        $value->load('translations.language');

        $payload = [
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

        if ($request->wantsJson()) {
            return response()->json([
                'message' => __('ui.attributes.values.updated', ['default' => 'Valor atualizado com sucesso.']),
                'value' => $payload,
            ]);
        }

        return back()->with('success', __('ui.attributes.values.updated', ['default' => 'Valor atualizado com sucesso.']));
    }

    public function destroy(
        Request $request,
        string $locale,
        Attribute $attribute,
        AttributeValue $value
    ): RedirectResponse|JsonResponse {
        if ((int) $value->attribute_id !== (int) $attribute->id) {
            abort(404);
        }

        if ($value->variantValues()->exists()) {
            $message = __('ui.attributes.values.delete_blocked_in_use', [
                'default' => 'Não podes apagar este valor porque já está a ser usado em variantes.',
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => $message,
                ], 422);
            }

            return back()->withErrors([
                'attribute_value' => $message,
            ]);
        }

        $value->translations()->delete();
        $value->delete();

        $message = __('ui.attributes.values.deleted', ['default' => 'Valor apagado com sucesso.']);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => $message,
            ]);
        }

        return back()->with('success', $message);
    }
}
