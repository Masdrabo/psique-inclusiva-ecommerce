<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();

            $table->string('code', 40);  // ctt, dhl, pickup, etc.
            $table->string('name', 80);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique('code', 'sm_code_uq');
            $table->index(['is_active'], 'sm_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_methods');
    }
};
