<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();

            $table->foreignId('payment_id')
                ->constrained('payments')
                ->cascadeOnDelete();

            $table->unsignedBigInteger('amount'); // cêntimos

            $table->enum('status', [
                'pending',
                'succeeded',
                'failed',
            ])->default('pending');

            $table->string('provider_refund_id', 120)->nullable();
            $table->json('payload')->nullable();

            $table->timestamps();

            // Índices curtos
            $table->index(['payment_id'], 'ref_pay_idx');
            $table->index(['status'], 'ref_status_idx');
            $table->index(['provider_refund_id'], 'ref_provider_id_idx');
            $table->index(['created_at'], 'ref_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
