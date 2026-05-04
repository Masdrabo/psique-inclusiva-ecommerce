<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('returns', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('return_number', 40)->unique('returns_number_uq');

            $table->enum('status', [
                'requested',
                'approved',
                'rejected',
                'received',
                'closed',
                'cancelled',
            ])->default('requested');

            $table->foreignId('requested_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('approved_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('received_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('reason', 120)->nullable();
            $table->text('notes')->nullable();

            $table->timestamp('requested_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();

            $table->index(['order_id'], 'returns_order_idx');
            $table->index(['user_id'], 'returns_user_idx');
            $table->index(['status'], 'returns_status_idx');
            $table->index(['requested_by_user_id'], 'returns_requested_by_idx');
            $table->index(['approved_by_user_id'], 'returns_approved_by_idx');
            $table->index(['received_by_user_id'], 'returns_received_by_idx');
            $table->index(['created_at'], 'returns_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('returns');
    }
};
