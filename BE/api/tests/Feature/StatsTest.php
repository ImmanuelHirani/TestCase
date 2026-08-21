<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_stats_require_authentication(): void
    {
        $this->getJson('/api/v1/stats')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_a_non_admin_may_read_the_dashboard(): void
    {
        $this->actingAsJwt(User::factory()->create())
            ->getJson('/api/v1/stats')
            ->assertOk();
    }

    public function test_totals_match_the_underlying_rows(): void
    {
        User::factory()->admin()->create(['department' => 'Klaim']);
        User::factory()->count(4)->create(['department' => 'Klaim']);
        User::factory()->count(2)->create(['department' => 'Aktuaria']);

        $response = $this->actingAsJwt(User::factory()->admin()->create(['department' => 'Klaim']))
            ->getJson('/api/v1/stats')
            ->assertOk();

        $response->assertJsonPath('data.total_users', 8)
            ->assertJsonPath('data.total_admins', 2)
            ->assertJsonPath('data.total_standard', 6)
            ->assertJsonPath('data.total_departments', 2);
    }

    public function test_departments_come_back_largest_first(): void
    {
        User::factory()->count(2)->create(['department' => 'Aktuaria']);
        User::factory()->count(5)->create(['department' => 'Klaim']);

        $response = $this->actingAsJwt(User::factory()->create(['department' => 'Klaim']))
            ->getJson('/api/v1/stats')
            ->assertOk();

        $departments = $response->json('data.by_department');

        $this->assertSame('Klaim', $departments[0]['department']);
        $this->assertSame(6, $departments[0]['total']);
        $this->assertSame('Aktuaria', $departments[1]['department']);
    }

    public function test_recent_users_are_the_five_newest_and_hide_passwords(): void
    {
        User::factory()->count(9)->create();

        $response = $this->actingAsJwt(User::factory()->create())
            ->getJson('/api/v1/stats')
            ->assertOk();

        $recent = $response->json('data.recent_users');

        $this->assertCount(5, $recent);

        // Newest first. Deliberately not asserted by comparing the returned
        // ids: those are random UUIDs now, and the fact that they carry no
        // ordering information is the point of using them. So the expected
        // order is taken from the database by its internal key and the
        // published uuids are matched against it.
        $expected = User::query()->orderByDesc('id')->take(5)->pluck('uuid')->all();
        $this->assertSame($expected, array_column($recent, 'id'));

        $this->assertArrayNotHasKey('password', $recent[0]);
    }
}
