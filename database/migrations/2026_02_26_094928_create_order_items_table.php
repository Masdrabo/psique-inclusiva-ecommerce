<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();

            $table->foreignId('variant_id')
                ->nullable()
                ->constrained('product_variants')
                ->nullOnDelete();

            // snapshots (não mudam mesmo que o produto mude)
            $table->string('name', 190);
            $table->string('sku', 80);

            $table->unsignedInteger('qty');

            // valores em cêntimos
            $table->unsignedBigInteger('unit_amount');
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('tax_amount')->default(0);
            $table->unsignedBigInteger('total_amount');

            $table->json('meta')->nullable();

            $table->timestamps();

            // Índices curtos
            $table->index(['order_id'], 'oi_order_idx');
            $table->index(['product_id'], 'oi_prod_idx');
            $table->index(['variant_id'], 'oi_var_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
