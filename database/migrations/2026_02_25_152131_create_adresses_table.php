<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();

            $table->foreignId('customer_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->enum('type', ['billing', 'shipping'])->default('shipping');

            $table->string('name', 120)->nullable();     // Nome do destinatário
            $table->string('line1', 160);
            $table->string('line2', 160)->nullable();
            $table->string('city', 80);
            $table->string('postal_code', 30);
            $table->string('region', 80)->nullable();    // distrito/estado
            $table->string('country_code', 2)->default('PT'); // ISO2

            $table->boolean('is_default')->default(false);

            $table->timestamps();

            $table->index(['customer_id', 'type']);
            $table->index(['country_code']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('addresses');
    }
};
