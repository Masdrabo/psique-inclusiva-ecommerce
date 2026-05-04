<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 40)->nullable()->after('status');
            $table->string('entity', 40)->nullable()->after('provider');
            $table->string('reference', 120)->nullable()->after('entity');
            $table->timestamp('expires_at')->nullable()->after('reference');

            $table->index(['provider'], 'pay_provider_idx');
            $table->index(['entity', 'reference'], 'pay_entity_reference_idx');
            $table->index(['expires_at'], 'pay_expires_idx');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('pay_provider_idx');
            $table->dropIndex('pay_entity_reference_idx');
            $table->dropIndex('pay_expires_idx');

            $table->dropColumn([
                'provider',
                'entity',
                'reference',
                'expires_at',
            ]);
        });
    }
};
