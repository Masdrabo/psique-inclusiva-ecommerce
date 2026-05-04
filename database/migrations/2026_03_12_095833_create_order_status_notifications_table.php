<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_status_notifications', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('status_id')
                ->constrained('order_statuses')
                ->restrictOnDelete();

            $table->string('channel', 50);
            $table->string('recipient', 190)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(
                ['order_id', 'status_id', 'channel'],
                'osn_order_status_channel_unique'
            );

            $table->index(['order_id', 'created_at'], 'osn_order_created_idx');
            $table->index(['status_id'], 'osn_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_notifications');
    }
};
