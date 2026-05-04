<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('shipping_method_id')
                ->constrained('shipping_methods')
                ->restrictOnDelete();

            $table->string('tracking_number', 120)->nullable();

            $table->enum('status', [
                'pending',
                'shipped',
                'delivered',
                'returned',
                'cancelled',
            ])->default('pending');

            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->timestamps();

            // Índices curtos
            $table->index(['order_id'], 'shp_order_idx');
            $table->index(['shipping_method_id'], 'shp_method_idx');
            $table->index(['tracking_number'], 'shp_track_idx');
            $table->index(['status'], 'shp_status_idx');
            $table->index(['created_at'], 'shp_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
