<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProductVariantAttributeSeeder extends Seeder
{
    public function run(): void
    {
        $languages = DB::table('languages')
            ->whereIn('code', ['pt', 'en'])
            ->get()
            ->keyBy('code');

        $ptId = $languages['pt']->id ?? null;
        $enId = $languages['en']->id ?? null;

        if (!$ptId || !$enId) {
            throw new RuntimeException('As línguas PT e EN têm de existir antes deste seeder.');
        }

        $attributes = [
            [
                'code' => 'color',
                'translations' => [
                    'pt' => 'Cor',
                    'en' => 'Color',
                ],
                'values' => [
                    [
                        'code' => 'blue',
                        'translations' => [
                            'pt' => 'Azul',
                            'en' => 'Blue',
                        ],
                    ],
                    [
                        'code' => 'red',
                        'translations' => [
                            'pt' => 'Vermelho',
                            'en' => 'Red',
                        ],
                    ],
                    [
                        'code' => 'green',
                        'translations' => [
                            'pt' => 'Verde',
                            'en' => 'Green',
                        ],
                    ],
                    [
                        'code' => 'black',
                        'translations' => [
                            'pt' => 'Preto',
                            'en' => 'Black',
                        ],
                    ],
                    [
                        'code' => 'white',
                        'translations' => [
                            'pt' => 'Branco',
                            'en' => 'White',
                        ],
                    ],
                ],
            ],
            [
                'code' => 'size',
                'translations' => [
                    'pt' => 'Tamanho',
                    'en' => 'Size',
                ],
                'values' => [
                    [
                        'code' => 'xs',
                        'translations' => [
                            'pt' => 'XS',
                            'en' => 'XS',
                        ],
                    ],
                    [
                        'code' => 's',
                        'translations' => [
                            'pt' => 'S',
                            'en' => 'S',
                        ],
                    ],
                    [
                        'code' => 'm',
                        'translations' => [
                            'pt' => 'M',
                            'en' => 'M',
                        ],
                    ],
                    [
                        'code' => 'l',
                        'translations' => [
                            'pt' => 'L',
                            'en' => 'L',
                        ],
                    ],
                    [
                        'code' => 'xl',
                        'translations' => [
                            'pt' => 'XL',
                            'en' => 'XL',
                        ],
                    ],
                ],
            ],
        ];

        DB::transaction(function () use ($attributes, $ptId, $enId) {
            foreach ($attributes as $attributeData) {
                $existingAttribute = DB::table('attributes')
                    ->where('code', $attributeData['code'])
                    ->first();

                if ($existingAttribute) {
                    $attributeId = $existingAttribute->id;

                    DB::table('attributes')
                        ->where('id', $attributeId)
                        ->update([
                            'is_active' => true,
                            'updated_at' => now(),
                        ]);
                } else {
                    $attributeId = DB::table('attributes')->insertGetId([
                        'code' => $attributeData['code'],
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $this->upsertAttributeTranslation($attributeId, $ptId, $attributeData['translations']['pt']);
                $this->upsertAttributeTranslation($attributeId, $enId, $attributeData['translations']['en']);

                foreach ($attributeData['values'] as $valueData) {
                    $existingValue = DB::table('attribute_values')
                        ->where('attribute_id', $attributeId)
                        ->where('code', $valueData['code'])
                        ->first();

                    if ($existingValue) {
                        $valueId = $existingValue->id;

                        DB::table('attribute_values')
                            ->where('id', $valueId)
                            ->update([
                                'updated_at' => now(),
                            ]);
                    } else {
                        $valueId = DB::table('attribute_values')->insertGetId([
                            'attribute_id' => $attributeId,
                            'code' => $valueData['code'],
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }

                    $this->upsertAttributeValueTranslation($valueId, $ptId, $valueData['translations']['pt']);
                    $this->upsertAttributeValueTranslation($valueId, $enId, $valueData['translations']['en']);
                }
            }
        });
    }

    private function upsertAttributeTranslation(int $attributeId, int $languageId, string $name): void
    {
        $existing = DB::table('attribute_translations')
            ->where('attribute_id', $attributeId)
            ->where('language_id', $languageId)
            ->first();

        if ($existing) {
            DB::table('attribute_translations')
                ->where('id', $existing->id)
                ->update([
                    'name' => $name,
                    'updated_at' => now(),
                ]);

            return;
        }

        DB::table('attribute_translations')->insert([
            'attribute_id' => $attributeId,
            'language_id' => $languageId,
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function upsertAttributeValueTranslation(int $attributeValueId, int $languageId, string $name): void
    {
        $existing = DB::table('attribute_value_translations')
            ->where('attribute_value_id', $attributeValueId)
            ->where('language_id', $languageId)
            ->first();

        if ($existing) {
            DB::table('attribute_value_translations')
                ->where('id', $existing->id)
                ->update([
                    'name' => $name,
                    'updated_at' => now(),
                ]);

            return;
        }

        DB::table('attribute_value_translations')->insert([
            'attribute_value_id' => $attributeValueId,
            'language_id' => $languageId,
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
