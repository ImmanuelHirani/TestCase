<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\JwtService;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_token_whose_subject_predates_the_uuid_switch_is_a_401(): void
    {
        // The token's subject used to be the primary key and is now the uuid.
        // Any browser still holding an older cookie sends an integer subject,
        // which cannot be compared against a Postgres uuid column at all --
        // unguarded, the driver raises a cast error and an unusable cookie
        // surfaces as a 500. It has to degrade to "sign in again" instead.
        $stale = JWT::encode([
            'sub' => 1,
            'role' => 'admin',
            'iat' => time(),
            'exp' => time() + 3600,
        ], config('jwt.secret'), config('jwt.algo'));

        $this->withCredentials()
            ->withUnencryptedCookie(config('jwt.cookie_name'), $stale)
            ->getJson('/api/v1/me')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_valid_credentials_set_the_session_cookie(): void
    {
        $user = User::factory()->create(['email' => 'someone@jasindo.test']);

        $response = $this->postJson('/api/v1/login', [
            'email' => 'someone@jasindo.test',
            'password' => 'password',
        ]);

        $jwt = $this->app->make(JwtService::class);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->uuid)
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role'], 'expires_at'])
            // The token itself is never in the JSON body -- only the cookie
            // carries it, and it must be HttpOnly so a script cannot read it.
            ->assertJsonMissingPath('token')
            ->assertCookie($jwt->cookieName());

        $cookie = $response->headers->getCookies()[0];
        $this->assertTrue($cookie->isHttpOnly());
    }

    public function test_the_password_is_never_returned(): void
    {
        User::factory()->create(['email' => 'someone@jasindo.test']);

        $response = $this->postJson('/api/v1/login', [
            'email' => 'someone@jasindo.test',
            'password' => 'password',
        ]);

        $this->assertArrayNotHasKey('password', $response->json('user'));
    }

    public function test_a_wrong_password_returns_the_validation_envelope(): void
    {
        User::factory()->create(['email' => 'someone@jasindo.test']);

        $this->postJson('/api/v1/login', [
            'email' => 'someone@jasindo.test',
            'password' => 'not-the-password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['errors' => ['email']]);
    }

    public function test_an_unknown_email_fails_identically_to_a_wrong_password(): void
    {
        // Identical responses are what stop the endpoint being used to work out
        // which email addresses have accounts.
        $this->postJson('/api/v1/login', [
            'email' => 'nobody@jasindo.test',
            'password' => 'whatever',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');
    }

    public function test_missing_fields_are_rejected(): void
    {
        $this->postJson('/api/v1/login', [])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['errors' => ['email', 'password']]);
    }

    public function test_protected_endpoints_reject_anonymous_callers(): void
    {
        $this->postJson('/api/v1/users:find')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_a_forged_cookie_is_rejected(): void
    {
        $jwt = $this->app->make(JwtService::class);

        $this->withCredentials()->withUnencryptedCookie($jwt->cookieName(), 'not-a-real-token.at.all')
            ->postJson('/api/v1/users:find')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_logout_clears_the_cookie(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAsJwt($user)->postJson('/api/v1/logout');

        $response->assertOk();

        $jwt = $this->app->make(JwtService::class);
        $cookie = collect($response->headers->getCookies())
            ->first(fn ($c) => $c->getName() === $jwt->cookieName());

        // "Cleared" means an expiry in the past, so the browser drops it --
        // there is no server-side token to revoke since the JWT is stateless.
        $this->assertNotNull($cookie);
        $this->assertLessThan(time(), $cookie->getExpiresTime());
    }

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create();

        $this->actingAsJwt($user)
            ->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->uuid);
    }
}
