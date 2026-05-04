<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('order_statuses', function (Blueprint $table) {
            $table->id();

            $table->string('code', 40);
            $table->string('name', 80);

            $table->timestamps();

            $table->unique('code', 'os_code_uq');
            $table->index('name', 'os_name_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_statuses');
    }
};
