<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->foreignId('order_id')
                ->nullable()
                ->after('id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->string('reason', 120)->nullable()->after('amount');
            $table->text('notes')->nullable()->after('reason');

            $table->foreignId('created_by_user_id')
                ->nullable()
                ->after('notes')
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropIndex('ref_status_idx');
            $table->dropIndex('ref_provider_id_idx');

            $table->dropColumn([
                'status',
                'provider_refund_id',
                'payload',
            ]);

            $table->index(['order_id'], 'refunds_order_idx');
            $table->index(['payment_id'], 'refunds_payment_idx');
            $table->index(['created_by_user_id'], 'refunds_created_by_idx');
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropIndex('refunds_order_idx');
            $table->dropIndex('refunds_payment_idx');
            $table->dropIndex('refunds_created_by_idx');

            $table->enum('status', [
                'pending',
                'succeeded',
                'failed',
            ])->default('pending')->after('amount');

            $table->string('provider_refund_id', 120)->nullable()->after('status');
            $table->json('payload')->nullable()->after('provider_refund_id');

            $table->index(['status'], 'ref_status_idx');
            $table->index(['provider_refund_id'], 'ref_provider_id_idx');

            $table->dropConstrainedForeignId('order_id');
            $table->dropConstrainedForeignId('created_by_user_id');
            $table->dropColumn([
                'reason',
                'notes',
            ]);
        });
    }
};
