<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->index()->after('password');
            $table->string('department')->nullable()->after('role');
            $table->string('phone', 30)->nullable()->after('department');
        });

        // Search hits name and email on every keystroke, so both are indexed.
        Schema::table('users', function (Blueprint $table) {
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['name']);
            $table->dropColumn(['role', 'department', 'phone']);
        });
    }
};
