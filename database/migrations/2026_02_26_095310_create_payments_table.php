<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('payment_method_id')
                ->constrained('payment_methods')
                ->restrictOnDelete();

            $table->unsignedBigInteger('amount'); // cêntimos

            $table->enum('status', [
                'pending',
                'authorized',
                'paid',
                'failed',
                'cancelled',
                'refunded',
            ])->default('pending');

            $table->string('provider_payment_id', 120)->nullable();
            $table->json('payload')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            // Índices curtos
            $table->index(['order_id'], 'pay_order_idx');
            $table->index(['payment_method_id'], 'pay_method_idx');
            $table->index(['status'], 'pay_status_idx');
            $table->index(['provider_payment_id'], 'pay_provider_id_idx');
            $table->index(['created_at'], 'pay_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
