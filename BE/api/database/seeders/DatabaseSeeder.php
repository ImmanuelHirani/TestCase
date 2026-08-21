<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Two known accounts to demo the role split, plus enough noise rows
     * that search and pagination have something real to work against.
     */
    public function run(): void
    {
        User::factory()->admin()->create([
            'name' => 'Admin Jasindo',
            'email' => 'admin@jasindo.test',
            'department' => 'Teknologi Informasi',
        ]);

        User::factory()->create([
            'name' => 'Budi Santoso',
            'email' => 'user@jasindo.test',
            'role' => Role::User,
            'department' => 'Klaim',
        ]);

        User::factory()->count(58)->create();
    }
}
