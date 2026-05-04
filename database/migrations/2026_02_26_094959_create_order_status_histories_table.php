<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('status_id')
                ->constrained('order_statuses')
                ->restrictOnDelete();

            $table->foreignId('changed_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->text('notes')->nullable();

            $table->timestamps();

            // Índices curtos
            $table->index(['order_id', 'created_at'], 'osh_ord_created_idx');
            $table->index(['status_id'], 'osh_status_idx');
            $table->index(['changed_by_user_id'], 'osh_changed_by_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_histories');
    }
};
