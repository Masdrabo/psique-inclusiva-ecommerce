<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('return_items', function (Blueprint $table) {
            $table->unsignedInteger('exchange_shipped_qty')->default(0)->after('restock_qty');
            $table->string('exchange_tracking_number', 120)->nullable()->after('exchange_shipped_qty');
            $table->timestamp('exchange_shipped_at')->nullable()->after('exchange_tracking_number');
            $table->text('exchange_notes')->nullable()->after('exchange_shipped_at');

            $table->index(['exchange_shipped_at'], 'return_items_exchange_shipped_at_idx');
        });
    }

    public function down(): void
    {
        Schema::table('return_items', function (Blueprint $table) {
            $table->dropIndex('return_items_exchange_shipped_at_idx');
            $table->dropColumn([
                'exchange_shipped_qty',
                'exchange_tracking_number',
                'exchange_shipped_at',
                'exchange_notes',
            ]);
        });
    }
};
