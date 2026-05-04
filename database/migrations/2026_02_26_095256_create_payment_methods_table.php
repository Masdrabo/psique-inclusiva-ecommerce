<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();

            $table->string('code', 40);   // stripe, paypal, mbway, multibanco...
            $table->string('name', 80);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique('code', 'pm_code_uq');
            $table->index(['is_active'], 'pm_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_methods');
    }
};
