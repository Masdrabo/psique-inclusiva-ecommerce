<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function getDefaultWarehouse(): Warehouse
    {
        $warehouse = Warehouse::query()
            ->where('is_default', true)
            ->first();

        if ($warehouse) {
            return $warehouse;
        }

        Warehouse::query()->update(['is_default' => false]);

        return Warehouse::create([
            'name' => 'Main Warehouse',
            'is_default' => true,
        ]);
    }

    public function ensureInventoryRow(Product $product): Inventory
    {
        if (!$product->managesInventory()) {
            throw ValidationException::withMessages([
                'inventory' => __('ui.inventory.errors.product_not_inventory_managed', [
                    'sku' => $product->sku,
                ]),
            ]);
        }

        $warehouse = $this->getDefaultWarehouse();

        return Inventory::query()->firstOrCreate(
            [
                'warehouse_id' => $warehouse->id,
                'product_id' => $product->id,
                'variant_id' => null,
            ],
            [
                'qty_on_hand' => 0,
                'qty_reserved' => 0,
            ]
        );
    }

    public function ensureVariantInventoryRow(ProductVariant $variant): Inventory
    {
        $product = $variant->product;

        if (!$product || !$product->managesInventory()) {
            throw ValidationException::withMessages([
                'inventory' => __('ui.inventory.errors.product_not_inventory_managed', [
                    'sku' => $variant->sku ?: ($product?->sku ?? ''),
                ]),
            ]);
        }

        $warehouse = $this->getDefaultWarehouse();

        return Inventory::query()->firstOrCreate(
            [
                'warehouse_id' => $warehouse->id,
                'product_id' => null,
                'variant_id' => $variant->id,
            ],
            [
                'qty_on_hand' => 0,
                'qty_reserved' => 0,
            ]
        );
    }

    public function setProductStock(Product $product, int $qtyOnHand): ?Inventory
    {
        if (!$product->managesInventory()) {
            return null;
        }

        $inventory = $this->ensureInventoryRow($product);

        $inventory->update([
            'qty_on_hand' => max(0, $qtyOnHand),
        ]);

        $product->refresh();
        $product->load('inventories');
        $product->syncActiveFromInventory();

        return $inventory->fresh();
    }

    public function setVariantStock(ProductVariant $variant, int $qtyOnHand): ?Inventory
    {
        $product = $variant->product;

        if (!$product || !$product->managesInventory()) {
            return null;
        }

        $inventory = $this->ensureVariantInventoryRow($variant);

        $inventory->update([
            'qty_on_hand' => max(0, $qtyOnHand),
        ]);

        $variant->refresh();
        $variant->load('inventories', 'product');
        $variant->syncActiveFromInventory();

        $product->refresh();
        $product->load('variants');
        $product->syncActiveFromInventory();

        return $inventory->fresh();
    }

    public function availableForProduct(Product $product): ?int
    {
        if (!$product->managesInventory()) {
            return null;
        }

        return $product->availableStock();
    }

    public function availableForVariant(ProductVariant $variant): ?int
    {
        $product = $variant->product;

        if (!$product || !$product->managesInventory()) {
            return null;
        }

        return $variant->availableStock();
    }

    public function decrementStock(Product $product, int $qty): void
    {
        if (!$product->managesInventory()) {
            return;
        }

        $qty = max(0, $qty);

        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($product, $qty) {
            $inventory = Inventory::query()
                ->where('product_id', $product->id)
                ->whereNull('variant_id')
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                throw ValidationException::withMessages([
                    'inventory' => __('ui.inventory.errors.inventory_missing', [
                        'sku' => $product->sku,
                    ]),
                ]);
            }

            $available = max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);

            if ($available < $qty) {
                throw ValidationException::withMessages([
                    'inventory' => __('ui.inventory.errors.insufficient_stock', [
                        'sku' => $product->sku,
                    ]),
                ]);
            }

            $inventory->update([
                'qty_on_hand' => (int) $inventory->qty_on_hand - $qty,
            ]);

            $product->refresh();
            $product->load('inventories');
            $product->syncActiveFromInventory();
        });
    }

    public function decrementVariantStock(ProductVariant $variant, int $qty): void
    {
        $product = $variant->product;

        if (!$product || !$product->managesInventory()) {
            return;
        }

        $qty = max(0, $qty);

        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($variant, $product, $qty) {
            $inventory = Inventory::query()
                ->whereNull('product_id')
                ->where('variant_id', $variant->id)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                throw ValidationException::withMessages([
                    'inventory' => __('ui.inventory.errors.inventory_missing', [
                        'sku' => $variant->sku ?: $product->sku,
                    ]),
                ]);
            }

            $available = max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);

            if ($available < $qty) {
                throw ValidationException::withMessages([
                    'inventory' => __('ui.inventory.errors.insufficient_stock', [
                        'sku' => $variant->sku ?: $product->sku,
                    ]),
                ]);
            }

            $inventory->update([
                'qty_on_hand' => (int) $inventory->qty_on_hand - $qty,
            ]);

            $variant->refresh();
            $variant->load('inventories', 'product');
            $variant->syncActiveFromInventory();

            $product->refresh();
            $product->load('variants');
            $product->syncActiveFromInventory();
        });
    }

    public function increaseStock(Product $product, int $qty): void
    {
        if (!$product->managesInventory()) {
            return;
        }

        $qty = max(0, $qty);

        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($product, $qty) {
            $inventory = Inventory::query()
                ->where('product_id', $product->id)
                ->whereNull('variant_id')
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                $inventory = $this->ensureInventoryRow($product);
                $inventory->refresh();
            }

            $inventory->update([
                'qty_on_hand' => (int) $inventory->qty_on_hand + $qty,
            ]);

            $product->refresh();
            $product->load('inventories');
            $product->syncActiveFromInventory();
        });
    }

    public function increaseVariantStock(ProductVariant $variant, int $qty): void
    {
        $product = $variant->product;

        if (!$product || !$product->managesInventory()) {
            return;
        }

        $qty = max(0, $qty);

        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($variant, $product, $qty) {
            $inventory = Inventory::query()
                ->whereNull('product_id')
                ->where('variant_id', $variant->id)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                $inventory = $this->ensureVariantInventoryRow($variant);
                $inventory->refresh();
            }

            $inventory->update([
                'qty_on_hand' => (int) $inventory->qty_on_hand + $qty,
            ]);

            $variant->refresh();
            $variant->load('inventories', 'product');
            $variant->syncActiveFromInventory();

            $product->refresh();
            $product->load('variants');
            $product->syncActiveFromInventory();
        });
    }
}
