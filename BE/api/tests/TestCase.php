<?php

namespace Tests;

use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * The app authenticates via an HttpOnly JWT cookie, not a session or a
     * bearer header, so the framework's own `actingAs()` (which sets the user
     * on a guard the request never consults) does not apply here. This mints
     * a real token through the same service the app uses in production and
     * attaches it the same way the browser would -- as a cookie -- so tests
     * exercise the actual verification path instead of bypassing it.
     */
    protected function actingAsJwt(User $user): static
    {
        $jwt = $this->app->make(JwtService::class);

        // withUnencryptedCookie, not withCookie: the test client's plain
        // withCookie() silently encrypts the value, assuming EncryptCookies
        // will decrypt it -- but that middleware is deliberately absent from
        // the api group (see AuthenticateJwtCookie), so an encrypted cookie
        // here would arrive at the app as ciphertext, not a JWT.
        //
        // withCredentials() matters too: *Json() helpers only attach cookies
        // at all when this is set -- it mirrors axios's withCredentials flag,
        // which the real frontend sets for exactly the same reason (cookies
        // are cross-origin here, host/remotes vs. the API).
        return $this->withCredentials()
            ->withUnencryptedCookie($jwt->cookieName(), $jwt->issue($user));
    }
}
