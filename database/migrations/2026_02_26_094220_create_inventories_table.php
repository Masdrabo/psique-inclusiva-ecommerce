<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('variant_id')
                ->nullable()
                ->constrained('product_variants')
                ->cascadeOnDelete();

            $table->integer('qty_on_hand')->default(0);
            $table->integer('qty_reserved')->default(0);

            $table->timestamps();

            // Índices / uniques curtos
            $table->index(['warehouse_id'], 'inv_wh_idx');
            $table->index(['product_id'], 'inv_prod_idx');
            $table->index(['variant_id'], 'inv_var_idx');

            // 1 linha de stock por armazém por item
            $table->unique(['warehouse_id', 'product_id'], 'inv_wh_prod_uq');
            $table->unique(['warehouse_id', 'variant_id'], 'inv_wh_var_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
