<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('combination_key', 255)
                ->nullable()
                ->after('barcode');

            $table->unique(['product_id', 'combination_key'], 'pv_prod_comb_key_uq');
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropUnique('pv_prod_comb_key_uq');
            $table->dropColumn('combination_key');
        });
    }
};
