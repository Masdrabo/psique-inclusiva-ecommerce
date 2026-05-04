<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE payments
            MODIFY COLUMN status ENUM(
                'pending',
                'authorized',
                'paid',
                'failed',
                'cancelled',
                'partially_refunded',
                'refunded'
            ) NOT NULL DEFAULT 'pending'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE payments
            MODIFY COLUMN status ENUM(
                'pending',
                'authorized',
                'paid',
                'failed',
                'cancelled',
                'refunded'
            ) NOT NULL DEFAULT 'pending'
        ");
    }
};
