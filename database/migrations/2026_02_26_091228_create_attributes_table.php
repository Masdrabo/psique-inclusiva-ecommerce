<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attributes', function (Blueprint $table) {
            $table->id();

            $table->string('code', 60);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            // Nome curto para evitar problemas e manter consistência
            $table->unique('code', 'attrs_code_uq');
            $table->index('is_active', 'attrs_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attributes');
    }
};
