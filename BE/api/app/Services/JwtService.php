<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

/**
 * Mints and verifies the app's own JWTs.
 *
 * The token never reaches JavaScript: it is set as an HttpOnly cookie by
 * {@see \App\Http\Controllers\Api\AuthController::login} and read back only
 * by {@see \App\Http\Middleware\AuthenticateJwtCookie}. A script running in
 * the page -- including one injected by an XSS bug -- cannot read or exfiltrate
 * it, which is the entire point of choosing a cookie over returning the token
 * in the JSON body for the client to store itself.
 */
class JwtService
{
    public function issue(User $user): string
    {
        $now = time();

        return JWT::encode([
            'sub' => $user->uuid,
            'role' => $user->role->value,
            'iat' => $now,
            'exp' => $now + (config('jwt.ttl_minutes') * 60),
        ], config('jwt.secret'), config('jwt.algo'));
    }

    /**
     * @return object{sub: string, role: string, iat: int, exp: int}|null
     *         null for any failure -- expired, forged signature, malformed --
     *         the caller does not need to distinguish why, only that the
     *         cookie no longer proves who the caller is.
     */
    public function verify(string $token): ?object
    {
        try {
            return JWT::decode($token, new Key(config('jwt.secret'), config('jwt.algo')));
        } catch (Throwable) {
            // Expired, forged signature, malformed base64, invalid JSON,
            // wrong number of segments -- every failure mode means the same
            // thing to the caller: this cookie no longer proves who is
            // asking. A garbage cookie must degrade to "not authenticated",
            // never to an uncaught 500.
            return null;
        }
    }

    public function ttlMinutes(): int
    {
        return config('jwt.ttl_minutes');
    }

    public function cookieName(): string
    {
        return config('jwt.cookie_name');
    }
}
