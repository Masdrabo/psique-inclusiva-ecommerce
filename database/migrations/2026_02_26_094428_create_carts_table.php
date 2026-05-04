<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('guest_token', 64)->nullable(); // cookie/localStorage

            $table->foreignId('currency_id')
                ->constrained('currencies')
                ->cascadeOnDelete();

            $table->enum('status', ['active', 'converted'])->default('active');

            $table->timestamps();

            // Índices curtos
            $table->index(['user_id', 'status'], 'carts_user_status_idx');
            $table->index(['guest_token', 'status'], 'carts_guest_status_idx');
            $table->index(['currency_id'], 'carts_curr_idx');

            // Não obrigatoriamente único, mas se QUISERES 1 carrinho ativo por user:
            // $table->unique(['user_id', 'status'], 'carts_user_status_uq');
            // (Eu deixei como index para permitir histórico/mais flexível)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carts');
    }
};
