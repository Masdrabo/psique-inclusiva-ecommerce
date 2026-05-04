<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('category_translations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('category_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('language_id')
                ->constrained('languages')
                ->cascadeOnDelete();

            $table->string('name', 160);
            $table->text('description')->nullable();

            $table->string('meta_title', 160)->nullable();
            $table->string('meta_description', 255)->nullable();

            $table->timestamps();

            $table->unique(['category_id', 'language_id']);
            $table->index(['language_id']);
            $table->index(['name']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('category_translations');
    }
};
