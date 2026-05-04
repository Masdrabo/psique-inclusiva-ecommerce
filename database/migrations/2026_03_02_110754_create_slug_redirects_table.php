<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('slug_redirects', function (Blueprint $table) {
            $table->id();

            // morph (Category, Product, etc.)
            $table->string('redirectable_type');
            $table->unsignedBigInteger('redirectable_id');

            $table->string('old_slug', 190);
            $table->string('new_slug', 190);

            $table->unsignedSmallInteger('http_code')->default(301);

            // quem alterou (opcional)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['redirectable_type', 'redirectable_id'], 'slug_redirects_redirectable_idx');
            $table->index(['redirectable_type', 'old_slug'], 'slug_redirects_lookup_idx');

            // evita duplicar redirects do mesmo tipo+old_slug
            $table->unique(['redirectable_type', 'old_slug'], 'slug_redirects_unique_old');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('slug_redirects');
    }
};
