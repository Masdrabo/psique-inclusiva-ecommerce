<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_variant_values', function (Blueprint $table) {
            $table->id();

            $table->foreignId('variant_id')
                ->constrained('product_variants')
                ->cascadeOnDelete();

            $table->foreignId('attribute_id')
                ->constrained('attributes')
                ->cascadeOnDelete();

            $table->foreignId('attribute_value_id')
                ->constrained('attribute_values')
                ->cascadeOnDelete();

            $table->timestamps();

            // Uma variante só pode ter 1 valor por atributo (ex: só 1 "cor")
            $table->unique(['variant_id', 'attribute_id'], 'pvv_var_attr_uq');

            // Ajuda em queries tipo: "todas as variantes com attribute_value X"
            $table->index(['attribute_id', 'attribute_value_id'], 'pvv_attr_val_idx');
            $table->index(['variant_id'], 'pvv_var_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_values');
    }
};
