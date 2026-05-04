<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->unsignedTinyInteger('rating');
            $table->string('title', 160)->nullable();
            $table->text('body')->nullable();

            $table->boolean('is_verified_purchase')->default(false);
            $table->boolean('is_visible')->default(true);

            $table->timestamps();

            $table->unique(['product_id', 'user_id'], 'product_reviews_product_user_unique');
            $table->index(['product_id', 'is_visible', 'created_at'], 'product_reviews_product_visible_created_idx');
            $table->index(['user_id'], 'product_reviews_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
    }
};
