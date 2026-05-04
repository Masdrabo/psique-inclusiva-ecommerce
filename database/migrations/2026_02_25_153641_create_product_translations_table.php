<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('product_translations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('language_id')
                ->constrained('languages')
                ->cascadeOnDelete();

            $table->string('name', 190);
            $table->longText('description')->nullable();

            $table->string('meta_title', 160)->nullable();
            $table->string('meta_description', 255)->nullable();

            $table->boolean('is_machine_translated')->default(false);

            $table->timestamps();

            $table->unique(['product_id', 'language_id']);
            $table->index(['language_id']);
            $table->index(['name']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('product_translations');
    }
};
