<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reads the HttpOnly JWT cookie, verifies it, and sets the request's
 * authenticated user -- the cookie-based equivalent of `auth:sanctum`.
 *
 * Controllers are unaffected: they still just call $request->user(). Nothing
 * downstream needs to know the token travels as a cookie rather than a
 * bearer header.
 */
class AuthenticateJwtCookie
{
    public function __construct(private readonly JwtService $jwt) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie($this->jwt->cookieName());

        if ($token === null) {
            throw new AuthenticationException('You must be signed in to do that.');
        }

        $payload = $this->jwt->verify($token);

        if ($payload === null) {
            throw new AuthenticationException('Your session has expired. Please sign in again.');
        }

        // The subject is checked for shape before it is used as a query value,
        // not out of tidiness but because `uuid` is a Postgres uuid column: a
        // subject that is not a uuid literal makes the driver raise a cast
        // error, and an unusable cookie would surface as a 500 instead of a
        // 401. That is not hypothetical -- tokens minted before the subject
        // moved from the primary key to the uuid carry a bare integer, and a
        // browser holding one must simply be asked to sign in again.
        $subject = is_string($payload->sub ?? null) ? $payload->sub : '';

        $user = Str::isUuid($subject)
            ? User::where('uuid', $subject)->first()
            : null;

        if ($user === null) {
            throw new AuthenticationException('Your session is no longer valid.');
        }

        Auth::setUser($user);

        return $next($request);
    }
}
