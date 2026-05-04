<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();

            $table->string('name', 120);
            $table->boolean('is_default')->default(false);

            $table->timestamps();

            $table->index(['is_default'], 'wh_default_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouses');
    }
};
