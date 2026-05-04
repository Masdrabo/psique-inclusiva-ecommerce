<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('donations', function (Blueprint $table) {
            $table->id();

            $table->string('donation_number', 40)->unique();
            $table->uuid('public_token')->unique();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('currency_id')
                ->nullable()
                ->constrained('currencies')
                ->nullOnDelete();

            $table->foreignId('payment_method_id')
                ->nullable()
                ->constrained('payment_methods')
                ->nullOnDelete();

            $table->unsignedBigInteger('amount'); // cêntimos

            $table->enum('status', [
                'pending',
                'paid',
                'failed',
                'cancelled',
            ])->default('pending');

            // dados opcionais do doador
            $table->string('donor_name', 120)->nullable();
            $table->string('donor_email', 190)->nullable();
            $table->string('donor_phone', 40)->nullable();

            // dados provider
            $table->string('provider', 60)->nullable(); // ifthenpay
            $table->string('entity', 40)->nullable();
            $table->string('reference', 120)->nullable();
            $table->string('provider_payment_id', 120)->nullable();
            $table->timestamp('expires_at')->nullable();

            $table->json('payload')->nullable();

            $table->timestamp('paid_at')->nullable();

            $table->timestamps();

            $table->index(['user_id'], 'don_user_idx');
            $table->index(['currency_id'], 'don_currency_idx');
            $table->index(['payment_method_id'], 'don_method_idx');
            $table->index(['status'], 'don_status_idx');
            $table->index(['provider'], 'don_provider_idx');
            $table->index(['reference'], 'don_reference_idx');
            $table->index(['provider_payment_id'], 'don_provider_payment_idx');
            $table->index(['created_at'], 'don_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('donations');
    }
};
