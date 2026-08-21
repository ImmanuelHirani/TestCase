<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every error the API produces is an RFC 9457 Problem Details object. These
 * tests pin down that shape and the header contract around it.
 */
class ExceptionHandlingTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_unknown_endpoint_returns_json_not_html(): void
    {
        $response = $this->getJson('/api/v1/no-such-endpoint');

        $response->assertStatus(404)
            ->assertHeader('content-type', 'application/problem+json')
            ->assertJsonPath('status', 404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_an_unsupported_method_returns_the_envelope_and_an_allow_header(): void
    {
        $this->actingAsJwt(User::factory()->admin()->create());

        $this->putJson('/api/v1/login')
            ->assertStatus(405)
            ->assertJsonPath('code', 'NOT_FOUND')
            // RFC 9110 §15.5.6 (MUST): a 405 response has to name the methods
            // the endpoint actually supports.
            ->assertHeader('Allow', 'POST');
    }

    public function test_every_error_is_a_well_formed_problem_details_object(): void
    {
        $response = $this->postJson('/api/v1/users:find');

        $response->assertStatus(401)
            ->assertJsonStructure(['type', 'title', 'status', 'detail', 'instance', 'code']);

        $this->assertIsString($response->json('type'));
        $this->assertIsString($response->json('title'));
        $this->assertSame(401, $response->json('status'));
        $this->assertIsString($response->json('detail'));
        // instance identifies *this* request, so it has to be this request's path.
        $this->assertSame('/api/v1/users:find', $response->json('instance'));
    }

    public function test_login_is_rate_limited_with_a_retry_after_header(): void
    {
        // throttle:5,1 -- the sixth attempt inside a minute is refused.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'nobody@jasindo.test',
                'password' => 'wrong',
            ])->assertStatus(422);
        }

        $response = $this->postJson('/api/v1/login', [
            'email' => 'nobody@jasindo.test',
            'password' => 'wrong',
        ]);

        $response->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS');

        // Zalando rule 153 (MUST): "Use code 429 with headers for rate
        // limits." Without Retry-After the client has no idea how long to
        // back off.
        $this->assertTrue($response->headers->has('Retry-After'));
        $this->assertTrue($response->headers->has('X-RateLimit-Limit'));
    }

    public function test_unknown_query_parameters_are_rejected(): void
    {
        $this->actingAsJwt(User::factory()->create())
            ->postJson('/api/v1/users:search', ['sroted' => 'name'])
            ->assertStatus(400)
            ->assertJsonPath('code', 'UNSUPPORTED_PARAMETER')
            ->assertJsonPath('status', 400);
    }
}
