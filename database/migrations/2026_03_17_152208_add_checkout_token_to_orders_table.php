<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('checkout_token')
                ->nullable()
                ->after('coupon_code');

            $table->unique('checkout_token', 'ord_checkout_token_uq');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('ord_checkout_token_uq');
            $table->dropColumn('checkout_token');
        });
    }
};
