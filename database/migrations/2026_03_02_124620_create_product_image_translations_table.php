<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_image_translations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_image_id')
                ->constrained('product_images')
                ->cascadeOnDelete();

            $table->foreignId('language_id')
                ->constrained('languages')
                ->cascadeOnDelete();

            $table->string('alt', 255)->nullable();

            $table->timestamps();

            $table->unique(['product_image_id', 'language_id'], 'product_image_translations_unique');
            $table->index(['language_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_image_translations');
    }
};
