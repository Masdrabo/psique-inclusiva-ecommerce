<?php

namespace Database\Seeders;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class InventoryBackfillSeeder extends Seeder
{
    public function run(): void
    {
        $warehouse = Warehouse::query()->where('is_default', true)->first();

        if (!$warehouse) {
            Warehouse::query()->update(['is_default' => false]);

            $warehouse = Warehouse::create([
                'name' => 'Main Warehouse',
                'is_default' => true,
            ]);
        }

        Product::query()->chunkById(100, function ($products) use ($warehouse) {
            foreach ($products as $product) {
                Inventory::query()->firstOrCreate(
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

                $product->load('inventories');
                $product->syncActiveFromInventory();
            }
        });
    }
}
