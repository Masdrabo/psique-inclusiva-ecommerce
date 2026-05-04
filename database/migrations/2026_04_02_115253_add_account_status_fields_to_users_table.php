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
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 20)
                ->default('active')
                ->after('role');

            $table->timestamp('suspended_until')
                ->nullable()
                ->after('status');

            $table->timestamp('banned_at')
                ->nullable()
                ->after('suspended_until');

            $table->text('ban_reason')
                ->nullable()
                ->after('banned_at');

            $table->foreignId('banned_by')
                ->nullable()
                ->after('ban_reason')
                ->constrained('users')
                ->nullOnDelete();

            $table->index('status', 'users_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('banned_by');
            $table->dropIndex('users_status_idx');

            $table->dropColumn([
                'status',
                'suspended_until',
                'banned_at',
                'ban_reason',
            ]);
        });
    }
};
