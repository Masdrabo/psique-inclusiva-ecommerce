<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('shipment_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('shipment_id')
                ->constrained('shipments')
                ->cascadeOnDelete();

            $table->foreignId('order_item_id')
                ->constrained('order_items')
                ->cascadeOnDelete();

            $table->unsignedInteger('qty');

            $table->timestamps();

            // 1 linha por item por envio
            $table->unique(['shipment_id', 'order_item_id'], 'shi_ship_item_uq');

            // Índices curtos
            $table->index(['shipment_id'], 'shi_ship_idx');
            $table->index(['order_item_id'], 'shi_item_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_items');
    }
};
