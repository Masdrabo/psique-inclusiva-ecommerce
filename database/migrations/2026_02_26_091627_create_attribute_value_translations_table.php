<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attribute_value_translations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('attribute_value_id')
                ->constrained('attribute_values')
                ->cascadeOnDelete();

            $table->foreignId('language_id')
                ->constrained('languages')
                ->cascadeOnDelete();

            $table->string('name', 120);

            $table->timestamps();

            // Nomes curtos (corrige o erro que tiveste)
            $table->unique(['attribute_value_id', 'language_id'], 'attr_val_tr_val_lang_uq');
            $table->index(['language_id'], 'attr_val_tr_lang_idx');
            $table->index(['attribute_value_id'], 'attr_val_tr_val_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attribute_value_translations');
    }
};
