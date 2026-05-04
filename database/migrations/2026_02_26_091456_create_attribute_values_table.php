<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attribute_values', function (Blueprint $table) {
            $table->id();

            $table->foreignId('attribute_id')
                ->constrained('attributes')
                ->cascadeOnDelete();

            $table->string('code', 80); // ex: blue, red, l, xl

            $table->timestamps();

            // Evita duplicados por atributo (ex: "blue" só 1x dentro do atributo "color")
            $table->unique(['attribute_id', 'code'], 'attr_vals_attr_code_uq');
            $table->index(['attribute_id'], 'attr_vals_attr_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attribute_values');
    }
};
