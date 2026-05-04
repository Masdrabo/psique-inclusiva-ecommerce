<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table) {
            $table->id();

            $table->foreignId('currency_id')
                ->constrained('currencies')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('variant_id')
                ->nullable()
                ->constrained('product_variants')
                ->cascadeOnDelete();

            // Valores sempre em cêntimos
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('compare_at_amount')->nullable();

            $table->timestamps();

            // Índices curtos (evita erro 64 chars MySQL)
            $table->index(['currency_id'], 'pp_curr_idx');

            // Apenas 1 preço por moeda por produto
            $table->unique(['currency_id', 'product_id'], 'pp_curr_prod_uq');

            // Apenas 1 preço por moeda por variante
            $table->unique(['currency_id', 'variant_id'], 'pp_curr_var_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_prices');
    }
};
