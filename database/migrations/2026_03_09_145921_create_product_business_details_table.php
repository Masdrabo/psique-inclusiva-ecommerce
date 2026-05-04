<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_business_details', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete()
                ->unique();

            // QUOTAS
            $table->string('membership_period_unit', 20)->nullable(); // month, year
            $table->unsignedInteger('membership_period_value')->nullable(); // 1, 12, etc
            $table->boolean('membership_renews_manually')->default(true);

            // SERVIÇOS DIGITAIS / FUTURO
            $table->string('delivery_mode', 30)->nullable(); // none, email, url, manual
            $table->string('service_kind', 40)->nullable();
            $table->text('access_instructions')->nullable();

            // FUTURO: sessões, workshops, eventos
            $table->unsignedInteger('capacity')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('location')->nullable();
            $table->string('meeting_url')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_business_details');
    }
};
