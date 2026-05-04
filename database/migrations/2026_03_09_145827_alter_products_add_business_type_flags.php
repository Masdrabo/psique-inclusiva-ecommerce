<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('business_type', 40)
                ->default('physical')
                ->after('type');

            $table->boolean('requires_shipping')
                ->default(true)
                ->after('business_type');

            $table->boolean('manages_inventory')
                ->default(true)
                ->after('requires_shipping');

            $table->boolean('allow_quantity')
                ->default(true)
                ->after('manages_inventory');

            $table->boolean('requires_customer_notes')
                ->default(false)
                ->after('allow_quantity');

            $table->unsignedInteger('max_per_order')
                ->nullable()
                ->after('requires_customer_notes');

            $table->timestamp('available_from')
                ->nullable()
                ->after('max_per_order');

            $table->timestamp('available_until')
                ->nullable()
                ->after('available_from');

            $table->index('business_type', 'products_business_type_idx');
            $table->index('requires_shipping', 'products_requires_shipping_idx');
            $table->index('manages_inventory', 'products_manages_inventory_idx');
        });

        DB::table('products')->update([
            'business_type' => 'physical',
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
        ]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_business_type_idx');
            $table->dropIndex('products_requires_shipping_idx');
            $table->dropIndex('products_manages_inventory_idx');

            $table->dropColumn([
                'business_type',
                'requires_shipping',
                'manages_inventory',
                'allow_quantity',
                'requires_customer_notes',
                'max_per_order',
                'available_from',
                'available_until',
            ]);
        });
    }
};
