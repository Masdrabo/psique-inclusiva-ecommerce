<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipping_zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipping_method_id')->constrained()->cascadeOnDelete();
            $table->string('shipping_profile')->default('standard');
            $table->unsignedInteger('min_weight_grams')->default(0);
            $table->unsignedInteger('max_weight_grams')->nullable();
            $table->unsignedInteger('price_cents');
            $table->unsignedInteger('estimated_days_min')->nullable();
            $table->unsignedInteger('estimated_days_max')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['shipping_zone_id', 'shipping_method_id'], 'shipping_rates_zone_method_idx');

            $table->unique(
                [
                    'shipping_zone_id',
                    'shipping_method_id',
                    'shipping_profile',
                    'min_weight_grams',
                    'max_weight_grams',
                ],
                'shipping_rates_unique_band'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_rates');
    }
};
