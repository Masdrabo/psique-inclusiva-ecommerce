<?php

namespace App\Services;

use App\Models\AttributeValue;
use App\Models\Currency;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductVariant;
use App\Models\ProductVariantValue;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductVariantService
{
    public function sync(
        Product $product,
        array $payload,
        Currency $currency,
        InventoryService $inventoryService
    ): void {
        if (!$product->isVariable()) {
            $this->deleteAllVariantsForSimpleProduct($product);
            return;
        }

        $variants = collect($payload['variants'] ?? []);

        if ($variants->isEmpty()) {
            throw ValidationException::withMessages([
                'variants' => __('ui.manager.variable_requires_variants'),
            ]);
        }

        DB::transaction(function () use ($product, $variants, $currency, $inventoryService) {
            $keptVariantIds = [];

            foreach ($variants->values() as $index => $variantData) {
                $normalized = $this->normalizeVariantPayload($variantData, $index);

                $this->ensureSkuIsUnique(
                    sku: $normalized['sku'],
                    currentVariantId: $normalized['id']
                );

                $pairs = $this->resolveAttributePairs(
                    attributeValueIds: $normalized['attribute_value_ids'],
                    variantIndex: $index
                );

                $combinationKey = $this->buildCombinationKey($pairs);

                $this->ensureCombinationIsUniqueForProduct(
                    product: $product,
                    combinationKey: $combinationKey,
                    currentVariantId: $normalized['id']
                );

                $variant = $this->resolveVariantModel($product, $normalized['id']);

                $variant->fill([
                    'sku' => $normalized['sku'],
                    'barcode' => $normalized['barcode'],
                    'is_active' => $normalized['is_active'],
                    'combination_key' => $combinationKey,
                ]);

                $variant->product()->associate($product);
                $variant->save();

                $keptVariantIds[] = $variant->id;

                $this->syncVariantValues($variant, $pairs);
                $this->syncVariantPrice($variant, $currency, $normalized);
                $this->syncVariantInventory($product, $variant, $inventoryService, $normalized);
            }

            $this->deleteMissingVariants($product, $keptVariantIds);

            $product->refresh();
            $product->load('variants');
            $product->syncActiveFromInventory();
        });
    }

    public function buildCombinationKey(Collection $pairs): string
    {
        return $pairs
            ->sortBy('attribute_id')
            ->map(function (array $pair) {
                return $pair['attribute_id'] . ':' . $pair['attribute_value_id'];
            })
            ->implode('|');
    }

    protected function normalizeVariantPayload(array $variantData, int $index): array
    {
        $attributeValueIds = collect($variantData['attribute_value_ids'] ?? [])
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($attributeValueIds)) {
            throw ValidationException::withMessages([
                "variants.{$index}.attribute_value_ids" => __('validation.required'),
            ]);
        }

        $sku = trim((string) Arr::get($variantData, 'sku', ''));

        if ($sku === '') {
            throw ValidationException::withMessages([
                "variants.{$index}.sku" => __('validation.required'),
            ]);
        }

        return [
            'id' => Arr::get($variantData, 'id'),
            'sku' => $sku,
            'barcode' => Arr::get($variantData, 'barcode'),
            'is_active' => filter_var(Arr::get($variantData, 'is_active', true), FILTER_VALIDATE_BOOLEAN),
            'attribute_value_ids' => $attributeValueIds,
            'price' => Arr::get($variantData, 'price'),
            'compare_at_price' => Arr::get($variantData, 'compare_at_price'),
            'stock_qty' => (int) Arr::get($variantData, 'stock_qty', 0),
        ];
    }

    protected function resolveAttributePairs(array $attributeValueIds, int $variantIndex): Collection
    {
        $values = AttributeValue::query()
            ->select(['id', 'attribute_id'])
            ->whereIn('id', $attributeValueIds)
            ->get();

        if ($values->count() !== count($attributeValueIds)) {
            throw ValidationException::withMessages([
                "variants.{$variantIndex}.attribute_value_ids" => __('ui.manager.variant_attribute_values_invalid'),
            ]);
        }

        $duplicateAttribute = $values
            ->groupBy('attribute_id')
            ->first(fn (Collection $group) => $group->count() > 1);

        if ($duplicateAttribute) {
            throw ValidationException::withMessages([
                "variants.{$variantIndex}.attribute_value_ids" => __('ui.manager.variant_duplicate_attribute'),
            ]);
        }

        return $values
            ->map(function (AttributeValue $value) {
                return [
                    'attribute_id' => (int) $value->attribute_id,
                    'attribute_value_id' => (int) $value->id,
                ];
            })
            ->values();
    }

    protected function resolveVariantModel(Product $product, mixed $variantId): ProductVariant
    {
        if (!$variantId) {
            return new ProductVariant();
        }

        $variant = ProductVariant::query()
            ->where('product_id', $product->id)
            ->find($variantId);

        if (!$variant) {
            throw ValidationException::withMessages([
                'variants' => __('ui.manager.variant_not_found_for_product'),
            ]);
        }

        return $variant;
    }

    protected function ensureSkuIsUnique(string $sku, mixed $currentVariantId = null): void
    {
        $exists = ProductVariant::query()
            ->where('sku', $sku)
            ->when($currentVariantId, fn ($query) => $query->where('id', '!=', $currentVariantId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'variants' => __('validation.unique', ['attribute' => 'SKU']),
            ]);
        }
    }

    protected function ensureCombinationIsUniqueForProduct(
        Product $product,
        string $combinationKey,
        mixed $currentVariantId = null
    ): void {
        $exists = ProductVariant::query()
            ->where('product_id', $product->id)
            ->where('combination_key', $combinationKey)
            ->when($currentVariantId, fn ($query) => $query->where('id', '!=', $currentVariantId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'variants' => __('ui.manager.duplicate_variant_combination'),
            ]);
        }
    }

    protected function syncVariantValues(ProductVariant $variant, Collection $pairs): void
    {
        $variant->values()->delete();

        foreach ($pairs as $pair) {
            ProductVariantValue::create([
                'variant_id' => $variant->id,
                'attribute_id' => $pair['attribute_id'],
                'attribute_value_id' => $pair['attribute_value_id'],
            ]);
        }
    }

    protected function syncVariantPrice(ProductVariant $variant, Currency $currency, array $variantData): void
    {
        ProductPrice::updateOrCreate(
            [
                'currency_id' => $currency->id,
                'product_id' => null,
                'variant_id' => $variant->id,
            ],
            [
                'amount' => $this->toMinorUnits((string) ($variantData['price'] ?? '0'), (int) $currency->decimal_places),
                'compare_at_amount' => filled($variantData['compare_at_price'] ?? null)
                    ? $this->toMinorUnits((string) $variantData['compare_at_price'], (int) $currency->decimal_places)
                    : null,
            ]
        );
    }

    protected function syncVariantInventory(
        Product $product,
        ProductVariant $variant,
        InventoryService $inventoryService,
        array $variantData
    ): void {
        if (!$product->managesInventory()) {
            return;
        }

        $inventoryService->setVariantStock(
            $variant,
            max(0, (int) ($variantData['stock_qty'] ?? 0))
        );
    }

    protected function deleteMissingVariants(Product $product, array $keptVariantIds): void
    {
        $variantsToDelete = ProductVariant::query()
            ->where('product_id', $product->id)
            ->when(
                !empty($keptVariantIds),
                fn ($query) => $query->whereNotIn('id', $keptVariantIds)
            )
            ->get();

        foreach ($variantsToDelete as $variant) {
            ProductPrice::query()
                ->where('variant_id', $variant->id)
                ->delete();

            $variant->values()->delete();
            $variant->inventories()->delete();
            $variant->delete();
        }
    }

    protected function deleteAllVariantsForSimpleProduct(Product $product): void
    {
        $variants = ProductVariant::query()
            ->where('product_id', $product->id)
            ->get();

        foreach ($variants as $variant) {
            ProductPrice::query()
                ->where('variant_id', $variant->id)
                ->delete();

            $variant->values()->delete();
            $variant->inventories()->delete();
            $variant->delete();
        }
    }

    protected function toMinorUnits(string $value, int $decimalPlaces = 2): int
    {
        $value = trim((string) $value);

        if ($value === '') {
            return 0;
        }

        $value = str_replace(',', '.', $value);

        [$intPart, $decPart] = array_pad(explode('.', $value, 2), 2, '');
        $intPart = preg_replace('/\D+/', '', $intPart) ?: '0';
        $decPart = preg_replace('/\D+/', '', $decPart) ?: '';

        if (strlen($decPart) > $decimalPlaces) {
            $decPart = substr($decPart, 0, $decimalPlaces);
        }

        $decPart = str_pad($decPart, $decimalPlaces, '0');

        return (int) ($intPart . $decPart);
    }
}
