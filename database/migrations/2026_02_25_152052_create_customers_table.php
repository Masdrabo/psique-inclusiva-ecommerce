<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('phone', 30)->nullable();
            $table->string('vat_number', 30)->nullable();   // NIF/VAT
            $table->string('company_name', 120)->nullable();

            $table->timestamps();

            $table->index(['user_id']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('customers');
    }
};
