<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            if (!Schema::hasColumn('refunds', 'idempotency_key')) {
                $table->uuid('idempotency_key')->nullable()->after('created_by_user_id');
                $table->unique('idempotency_key', 'refunds_idempotency_key_uq');
            }
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            if (Schema::hasColumn('refunds', 'idempotency_key')) {
                $table->dropUnique('refunds_idempotency_key_uq');
                $table->dropColumn('idempotency_key');
            }
        });
    }
};
