<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cart_items', function (Blueprint $table) {
            $table->unsignedBigInteger('variant_key')->default(0)->after('variant_id');
        });

        DB::table('cart_items')->update([
            'variant_key' => DB::raw('COALESCE(variant_id, 0)'),
        ]);

        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropUnique('ci_cart_prod_uq');
            $table->dropUnique('ci_cart_var_uq');

            $table->index(['variant_key'], 'ci_variant_key_idx');
            $table->unique(['cart_id', 'product_id', 'variant_key'], 'ci_cart_prod_variant_key_uq');
        });
    }

    public function down(): void
    {
        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropUnique('ci_cart_prod_variant_key_uq');
            $table->dropIndex('ci_variant_key_idx');

            $table->unique(['cart_id', 'product_id'], 'ci_cart_prod_uq');
            $table->unique(['cart_id', 'variant_id'], 'ci_cart_var_uq');

            $table->dropColumn('variant_key');
        });
    }
};
