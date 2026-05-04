<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('refund_id')
                ->constrained('refunds')
                ->cascadeOnDelete();

            $table->foreignId('order_item_id')
                ->constrained('order_items')
                ->cascadeOnDelete();

            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('amount');

            $table->timestamps();

            $table->index(['refund_id'], 'refund_items_refund_idx');
            $table->index(['order_item_id'], 'refund_items_order_item_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_items');
    }
};
