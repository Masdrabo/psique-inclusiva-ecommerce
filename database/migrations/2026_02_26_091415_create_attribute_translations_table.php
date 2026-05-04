<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attribute_translations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('attribute_id')
                ->constrained('attributes')
                ->cascadeOnDelete();

            $table->foreignId('language_id')
                ->constrained('languages')
                ->cascadeOnDelete();

            $table->string('name', 120);

            $table->timestamps();

            // Nomes curtos (MySQL limit 64 chars)
            $table->unique(['attribute_id', 'language_id'], 'attr_tr_attr_lang_uq');
            $table->index(['language_id'], 'attr_tr_lang_idx');
            $table->index(['attribute_id'], 'attr_tr_attr_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attribute_translations');
    }
};
