<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('cart_id')
                ->constrained('carts')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('variant_id')
                ->nullable()
                ->constrained('product_variants')
                ->cascadeOnDelete();

            $table->unsignedInteger('qty')->default(1);

            // snapshot opcional (recomendado)
            $table->unsignedBigInteger('unit_amount')->nullable(); // cêntimos
            $table->json('meta')->nullable();

            $table->timestamps();

            // Índices curtos (MySQL safe)
            $table->index(['cart_id'], 'ci_cart_idx');
            $table->index(['product_id'], 'ci_prod_idx');
            $table->index(['variant_id'], 'ci_var_idx');

            // Evita duplicar o mesmo item no carrinho (depende se é produto simples ou variante)
            $table->unique(['cart_id', 'product_id'], 'ci_cart_prod_uq');
            $table->unique(['cart_id', 'variant_id'], 'ci_cart_var_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_items');
    }
};
