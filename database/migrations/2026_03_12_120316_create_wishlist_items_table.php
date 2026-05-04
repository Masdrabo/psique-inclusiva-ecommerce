<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wishlist_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->unique(['user_id', 'product_id'], 'wishlist_user_product_unique');
            $table->index(['user_id', 'created_at'], 'wishlist_user_created_idx');
            $table->index(['product_id'], 'wishlist_product_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wishlist_items');
    }
};
