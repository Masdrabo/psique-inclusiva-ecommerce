<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('return_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('return_id')
                ->constrained('returns')
                ->cascadeOnDelete();

            $table->foreignId('order_item_id')
                ->constrained('order_items')
                ->cascadeOnDelete();

            $table->unsignedInteger('qty');
            $table->unsignedInteger('received_qty')->default(0);
            $table->unsignedInteger('restock_qty')->default(0);

            $table->string('reason', 120)->nullable();
            $table->string('condition', 50)->nullable();
            $table->string('resolution', 50)->nullable();

            $table->timestamps();

            $table->index(['return_id'], 'return_items_return_idx');
            $table->index(['order_item_id'], 'return_items_order_item_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_items');
    }
};
