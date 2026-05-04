<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('tax_rate', 5, 2)
                ->default(23.00)
                ->after('weight_grams');

            $table->boolean('price_includes_tax')
                ->default(true)
                ->after('tax_rate');

            $table->index('tax_rate', 'products_tax_rate_idx');
            $table->index('price_includes_tax', 'products_price_includes_tax_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_tax_rate_idx');
            $table->dropIndex('products_price_includes_tax_idx');

            $table->dropColumn([
                'tax_rate',
                'price_includes_tax',
            ]);
        });
    }
};
