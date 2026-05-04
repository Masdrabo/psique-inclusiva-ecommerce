<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            $table->string('order_number', 40);

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('customer_id')
                ->nullable()
                ->constrained('customers')
                ->nullOnDelete();

            $table->foreignId('currency_id')
                ->constrained('currencies')
                ->cascadeOnDelete();

            $table->foreignId('status_id')
                ->constrained('order_statuses')
                ->restrictOnDelete();

            // snapshots (moradas no momento da compra)
            $table->json('billing_address')->nullable();
            $table->json('shipping_address')->nullable();

            // totais (cêntimos)
            $table->unsignedBigInteger('subtotal_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('tax_amount')->default(0);
            $table->unsignedBigInteger('shipping_amount')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);

            $table->timestamp('paid_at')->nullable();

            $table->timestamps();

            // Índices / uniques curtos
            $table->unique('order_number', 'ord_num_uq');
            $table->index(['user_id'], 'ord_user_idx');
            $table->index(['customer_id'], 'ord_cust_idx');
            $table->index(['status_id'], 'ord_status_idx');
            $table->index(['created_at'], 'ord_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
