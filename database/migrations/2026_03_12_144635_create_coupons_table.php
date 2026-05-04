<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();

            $table->string('code', 64)->unique();
            $table->string('name', 160);

            $table->enum('type', ['fixed_amount', 'percentage']);
            $table->unsignedBigInteger('amount')->nullable(); // cents, para fixed_amount
            $table->decimal('percentage', 5, 2)->nullable(); // ex: 10.00

            $table->unsignedBigInteger('minimum_subtotal_amount')->default(0);

            $table->unsignedInteger('max_total_uses')->nullable();
            $table->unsignedInteger('max_uses_per_user')->nullable();

            $table->unsignedInteger('total_uses')->default(0);

            $table->boolean('is_active')->default(true);

            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();

            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at'], 'coupons_active_dates_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupons');
    }
};
