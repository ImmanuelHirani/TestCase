<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Adds a public, opaque identifier alongside the existing primary key.
 *
 * The auto-increment `id` stays as the internal key -- it is a fast, compact
 * integer for indexes and foreign keys, and there is no reason to give that
 * up. What changes is that it stops being the identifier the *outside world*
 * sees: every API response, URL and request body now carries `uuid` instead.
 *
 * Why that matters beyond aesthetics: a sequential id is guessable and
 * countable. Anyone holding `/users/41` can try `/users/42`, and watching the
 * ids issued over a week tells them how many users the company added. A
 * random v4 UUID leaks neither.
 *
 * Deliberately v4 (random) rather than Laravel's orderedUuid() (v7-style,
 * time-sortable). Ordered UUIDs index better, but they encode creation time
 * and preserve creation order -- which is exactly the inference this column
 * exists to prevent.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Three steps rather than one: the column has to exist and be filled
        // for every existing row before a NOT NULL + UNIQUE constraint can be
        // applied without the migration failing on live data.
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('uuid')->nullable()->after('id');
        });

        foreach (DB::table('users')->whereNull('uuid')->pluck('id') as $id) {
            DB::table('users')->where('id', $id)->update(['uuid' => (string) Str::uuid()]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->uuid('uuid')->nullable(false)->unique()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['uuid']);
            $table->dropColumn('uuid');
        });
    }
};
