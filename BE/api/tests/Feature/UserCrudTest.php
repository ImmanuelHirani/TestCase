<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCrudTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    private function plainUser(): User
    {
        return User::factory()->create();
    }

    // --- Read -------------------------------------------------------------

    public function test_any_authenticated_user_can_list_users(): void
    {
        User::factory()->count(4)->create();

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find')
            ->assertOk()
            ->assertJsonPath('operation', 'find')
            ->assertJsonStructure([
                'operation',
                'data' => [['id', 'name', 'email', 'role', 'department', 'phone']],
                'page' => ['limit', 'has_more', 'next_cursor', 'prev_cursor'],
                'field_policy' => ['viewer_role', 'visible', 'restricted', 'note'],
            ]);
    }

    public function test_cursor_pagination_walks_forward_without_repeating_rows(): void
    {
        User::factory()->count(24)->create();

        $first = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find', ['limit' => 10])
            ->assertOk()
            ->assertJsonPath('page.limit', 10)
            ->assertJsonPath('page.has_more', true)
            ->assertJsonPath('page.prev_cursor', null)
            ->assertJsonCount(10, 'data');

        $cursor = $first->json('page.next_cursor');
        $this->assertNotNull($cursor);

        $second = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find', ['limit' => 10, 'cursor' => $cursor])
            ->assertOk()
            ->assertJsonCount(10, 'data');

        $firstIds = array_column($first->json('data'), 'id');
        $secondIds = array_column($second->json('data'), 'id');

        // The whole point of a cursor: page two continues past page one
        // rather than re-listing rows an offset would have shifted over.
        $this->assertSame([], array_intersect($firstIds, $secondIds));
    }

    public function test_the_last_cursor_page_reports_no_more(): void
    {
        // 4 rows + the acting admin = 5, so a limit of 10 is the only page.
        User::factory()->count(4)->create();

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find', ['limit' => 10])
            ->assertOk()
            ->assertJsonPath('page.has_more', false)
            ->assertJsonPath('page.next_cursor', null);
    }

    public function test_a_cursor_page_carries_no_total_count(): void
    {
        User::factory()->count(4)->create();

        $page = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find')
            ->assertOk()
            ->json('page');

        // Deliberate: producing a total costs a second full scan, which is
        // exactly what cursor pagination exists to avoid. The dashboard's
        // counts come from /stats instead.
        $this->assertArrayNotHasKey('total', $page);
    }

    public function test_limit_is_capped(): void
    {
        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find', ['limit' => 5000])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_find_rejects_filter_parameters(): void
    {
        // Filters belong on :search -- sending them to :find is a mistake
        // worth surfacing, not silently ignoring.
        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find', ['search' => 'budi'])
            ->assertStatus(400)
            ->assertJsonPath('code', 'UNSUPPORTED_PARAMETER');
    }

    public function test_search_reports_its_own_operation_name(): void
    {
        User::factory()->create(['name' => 'Budi Santoso']);

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:search', ['search' => 'budi'])
            ->assertOk()
            ->assertJsonPath('operation', 'search');
    }

    public function test_search_matches_a_name_case_insensitively(): void
    {
        User::factory()->create(['name' => 'Budi Santoso']);
        User::factory()->create(['name' => 'Siti Rahayu']);

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:search', ['search' => 'budi'])
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Budi Santoso');
    }

    public function test_search_matches_an_exact_id(): void
    {
        $target = User::factory()->create(['name' => 'Findable Person']);
        User::factory()->count(3)->create();

        $response = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:search', ['search' => $target->uuid])
            ->assertOk();

        $this->assertContains($target->uuid, array_column($response->json('data'), 'id'));
    }

    public function test_search_does_not_execute_injected_sql(): void
    {
        User::factory()->count(3)->create();

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:search', ['search' => "'; DROP TABLE users; --"])
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // The table is still there, which is the whole point.
        $this->assertGreaterThan(0, User::count());
    }

    public function test_role_filter_narrows_the_result(): void
    {
        User::factory()->count(3)->create();
        $admin = $this->admin();

        $response = $this->actingAsJwt($admin)
            ->postJson('/api/v1/users:search', ['role' => 'admin'])
            ->assertOk();

        $this->assertSame(['admin'], array_unique(array_column($response->json('data'), 'role')));
    }

    public function test_a_missing_user_returns_the_not_found_envelope(): void
    {
        // Well-formed uuid, no such row.
        $this->actingAsJwt($this->admin())
            ->getJson('/api/v1/users/00000000-0000-4000-8000-000000000000')
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_a_malformed_id_is_a_not_found_not_a_server_error(): void
    {
        // The route key is a uuid column, so an id that is not a uuid cannot
        // even be compared against it -- Postgres rejects the cast and the
        // request would surface as a 500. The route constraint stops the
        // segment from matching at all, which is the honest answer: there is
        // no such resource.
        $this->actingAsJwt($this->admin())
            ->getJson('/api/v1/users/999999')
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_show_returns_an_etag(): void
    {
        $target = User::factory()->create();

        $response = $this->actingAsJwt($this->admin())
            ->getJson("/api/v1/users/{$target->uuid}")
            ->assertOk();

        $this->assertTrue($response->headers->has('ETag'));
        $this->assertSame('W/"'.$target->uuid.'-'.$target->updated_at->timestamp.'"', $response->headers->get('ETag'));
    }

    // --- Field-level authorisation ---------------------------------------

    public function test_a_non_admin_does_not_receive_the_phone_field(): void
    {
        User::factory()->create(['phone' => '081200000000']);

        $response = $this->actingAsJwt($this->plainUser())
            ->postJson('/api/v1/users:find')
            ->assertOk();

        foreach ($response->json('data') as $record) {
            // Omitted entirely, not returned as null -- Microsoft's guideline
            // is "DO NOT send JSON fields with a null value from the service
            // to the client".
            $this->assertArrayNotHasKey('phone', $record);
        }

        $response->assertJsonPath('field_policy.viewer_role', 'user')
            ->assertJsonPath('field_policy.restricted', ['phone']);
    }

    public function test_an_admin_receives_the_phone_field(): void
    {
        User::factory()->create(['phone' => '081200000000']);

        $response = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:find')
            ->assertOk()
            ->assertJsonPath('field_policy.viewer_role', 'admin')
            ->assertJsonPath('field_policy.restricted', []);

        foreach ($response->json('data') as $record) {
            $this->assertArrayHasKey('phone', $record);
        }
    }

    public function test_the_field_policy_is_published_on_a_single_read_too(): void
    {
        $target = User::factory()->create(['phone' => '081200000000']);

        $this->actingAsJwt($this->plainUser())
            ->getJson("/api/v1/users/{$target->uuid}")
            ->assertOk()
            ->assertJsonPath('operation', 'get')
            ->assertJsonPath('field_policy.restricted', ['phone'])
            ->assertJsonMissingPath('data.phone');
    }

    // --- Write, and who is allowed to ------------------------------------

    public function test_an_admin_can_create_a_user(): void
    {
        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:create', [
                'name' => 'Siti Rahayu',
                'email' => 'siti@jasindo.test',
                'password' => 'password123',
                'role' => 'user',
                'department' => 'Underwriting',
                'phone' => '081234567890',
            ])
            ->assertCreated()
            ->assertJsonPath('data.email', 'siti@jasindo.test');

        $this->assertDatabaseHas('users', ['email' => 'siti@jasindo.test']);
    }

    public function test_create_returns_a_location_header_pointing_at_the_new_user(): void
    {
        $response = $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:create', [
                'name' => 'Location Header Check',
                'email' => 'location.check@jasindo.test',
                'password' => 'password123',
                'role' => 'user',
            ])
            ->assertCreated();

        $newId = $response->json('data.id');

        // RFC 9110 §10.2.2: 201 Created MUST identify the created resource.
        $this->assertStringEndsWith("/api/v1/users/{$newId}", $response->headers->get('Location'));
    }

    public function test_a_non_admin_cannot_create_a_user(): void
    {
        $this->actingAsJwt($this->plainUser())
            ->postJson('/api/v1/users:create', [
                'name' => 'Should Not Exist',
                'email' => 'nope@jasindo.test',
                'password' => 'password123',
                'role' => 'user',
            ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');

        $this->assertDatabaseMissing('users', ['email' => 'nope@jasindo.test']);
    }

    public function test_invalid_input_returns_per_field_errors(): void
    {
        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:create', [
                'name' => 'X',
                'email' => 'not-an-email',
                'password' => '123',
                'role' => 'superuser',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['errors' => ['name', 'email', 'password', 'role']]);
    }

    public function test_a_duplicate_email_is_rejected(): void
    {
        User::factory()->create(['email' => 'taken@jasindo.test']);

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:create', [
                'name' => 'Someone Else',
                'email' => 'taken@jasindo.test',
                'password' => 'password123',
                'role' => 'user',
            ])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['email']]);
    }

    public function test_an_admin_can_update_a_user(): void
    {
        $target = User::factory()->create(['name' => 'Old Name']);

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'New Name',
                'email' => $target->email,
                'password' => '',
                'role' => 'admin',
                'department' => 'Aktuaria',
                'phone' => '081200000000',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.role', 'admin');
    }

    public function test_update_with_a_stale_if_match_is_rejected(): void
    {
        $target = User::factory()->create(['name' => 'Original']);
        $staleETag = 'W/"'.$target->uuid.'-1"'; // a timestamp that is not this row's

        $this->actingAsJwt($this->admin())
            ->withHeader('If-Match', $staleETag)
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'Should Not Apply',
                'email' => $target->email,
                'password' => '',
                'role' => 'user',
            ])
            ->assertStatus(412)
            ->assertJsonPath('code', 'PRECONDITION_FAILED');

        // The write must not have gone through -- that is the entire point.
        $this->assertSame('Original', $target->fresh()->name);
    }

    public function test_update_with_the_current_if_match_succeeds(): void
    {
        $target = User::factory()->create();
        $currentETag = 'W/"'.$target->uuid.'-'.$target->updated_at->timestamp.'"';

        $this->actingAsJwt($this->admin())
            ->withHeader('If-Match', $currentETag)
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'Updated With Match',
                'email' => $target->email,
                'password' => '',
                'role' => 'user',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated With Match');
    }

    public function test_update_without_if_match_still_works(): void
    {
        // Backward compatible: If-Match is optional, not required.
        $target = User::factory()->create();

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'No Precondition Sent',
                'email' => $target->email,
                'password' => '',
                'role' => 'user',
            ])
            ->assertOk();
    }

    public function test_an_empty_password_on_update_leaves_it_unchanged(): void
    {
        $target = User::factory()->create();
        $originalHash = $target->password;

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'Renamed',
                'email' => $target->email,
                'password' => '',
                'role' => 'user',
            ])
            ->assertOk();

        $this->assertSame($originalHash, $target->fresh()->password);
    }

    public function test_the_id_in_the_body_addresses_a_row_but_cannot_rewrite_one(): void
    {
        // Now that `id` arrives as a body field it sits alongside the writable
        // columns, so it has to be stripped before update() -- otherwise a
        // request body could reassign a record's primary key.
        $target = User::factory()->create(['name' => 'Original']);
        $originalId = $target->id;
        $originalUuid = $target->uuid;

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:update', [
                'id' => $target->uuid,
                'name' => 'Renamed',
                'email' => $target->email,
                'password' => '',
                'role' => 'user',
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $originalUuid)
            ->assertJsonPath('data.name', 'Renamed');

        $this->assertDatabaseHas('users', ['id' => $originalId, 'name' => 'Renamed']);
    }

    public function test_an_unknown_id_in_the_body_is_a_validation_error(): void
    {
        // The client sent one body, so it gets one response describing what is
        // wrong with that body -- a field error on `id`, not a bare 404.
        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:delete', ['id' => '00000000-0000-4000-8000-000000000000'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['errors' => ['id']]);
    }

    public function test_an_admin_can_delete_a_user(): void
    {
        $target = User::factory()->create();

        $this->actingAsJwt($this->admin())
            ->postJson('/api/v1/users:delete', ['id' => $target->uuid])
            ->assertOk()
            // A 200 with a small confirmation body rather than a bare 204:
            // a 204 shows up in a Network trace as an empty row that says
            // nothing about what was removed.
            ->assertJsonPath('operation', 'delete')
            ->assertJsonPath('data.id', $target->uuid)
            ->assertJsonPath('data.deleted', true);

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_an_admin_cannot_delete_their_own_account(): void
    {
        $admin = $this->admin();

        $this->actingAsJwt($admin)
            ->postJson('/api/v1/users:delete', ['id' => $admin->uuid])
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_a_non_admin_cannot_delete(): void
    {
        $target = User::factory()->create();

        $this->actingAsJwt($this->plainUser())
            ->postJson('/api/v1/users:delete', ['id' => $target->uuid])
            ->assertStatus(403);

        $this->assertDatabaseHas('users', ['id' => $target->id]);
    }

    public function test_the_role_cast_exposes_the_enum(): void
    {
        $this->assertSame(Role::Admin, $this->admin()->role);
    }
}
