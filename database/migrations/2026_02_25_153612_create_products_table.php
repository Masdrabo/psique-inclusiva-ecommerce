<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->string('sku', 80)->unique();
            $table->string('slug', 190)->unique();

            $table->enum('type', ['simple', 'variable', 'digital'])->default('simple');
            $table->boolean('is_active')->default(true);

            $table->string('barcode', 80)->nullable();
            $table->unsignedInteger('weight_grams')->nullable();

            $table->timestamps();

            $table->index(['is_active']);
            $table->index(['type']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('products');
    }
};
