<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\DTOs\AuthResponseDto;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

#[OA\Info(
    version: '2.0.0',
    title: 'Jasindo User Management API',
    description: 'CRUD API for the Jasindo front end coding test. Auth via a JWT carried in an HttpOnly, SameSite=Lax cookie -- Swagger\'s "Try it out" cannot authenticate directly because the cookie is invisible to JavaScript by design; log in from the app itself, then Swagger inherits the cookie on same-origin requests.',
)]
#[OA\Server(url: 'http://localhost:8001/api/v1', description: 'Local development')]
#[OA\SecurityScheme(
    securityScheme: 'cookieAuth',
    type: 'apiKey',
    in: 'cookie',
    name: 'jasindo_token',
    description: 'HttpOnly JWT cookie set by POST /login. Never readable from JavaScript.',
)]
class AuthController extends Controller
{
    public function __construct(private readonly JwtService $jwt) {}

    #[OA\Post(
        path: '/login',
        summary: 'Exchange credentials for a session cookie',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@jasindo.test'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Authenticated. Sets the jasindo_token HttpOnly cookie.'),
            new OA\Response(response: 422, description: 'Invalid credentials or missing fields'),
            new OA\Response(response: 429, description: 'Too many login attempts'),
        ],
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        // Same error for "no such user" and "wrong password" so the endpoint
        // cannot be used to enumerate which emails exist.
        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        return $this->respondWithSession($user);
    }

    #[OA\Post(
        path: '/logout',
        summary: 'Clear the session cookie',
        tags: ['Auth'],
        security: [['cookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Cookie cleared'),
            new OA\Response(response: 401, description: 'Not authenticated'),
        ],
    )]
    public function logout(Request $request): JsonResponse
    {
        return response()
            ->json(['success' => true, 'message' => 'Logged out.'])
            ->withCookie(Cookie::forget($this->jwt->cookieName()));
    }

    #[OA\Get(
        path: '/me',
        summary: 'Current authenticated user, and silently renews the session',
        tags: ['Auth'],
        security: [['cookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'The authenticated user'),
            new OA\Response(response: 401, description: 'Not authenticated'),
        ],
    )]
    public function me(Request $request): JsonResponse
    {
        // Called on every app boot to hydrate the SPA's auth state, since the
        // cookie itself is unreadable from JavaScript. Re-issuing the cookie
        // here means an active user's session keeps sliding forward instead
        // of hard-expiring mid-use.
        return $this->respondWithSession($request->user());
    }

    private function respondWithSession(User $user): JsonResponse
    {
        $token = $this->jwt->issue($user);
        $expiresAt = time() + ($this->jwt->ttlMinutes() * 60);

        $cookie = Cookie::make(
            name: $this->jwt->cookieName(),
            value: $token,
            minutes: $this->jwt->ttlMinutes(),
            path: '/',
            domain: null,
            secure: app()->environment('production'),
            httpOnly: true,
            // 'lax' rather than 'strict': the cookie belongs to the API's own
            // origin (localhost:8001) and every frontend -- host and every
            // microfrontend, each its own origin -- calls that same API, so
            // the request is cross-origin but same-site. Lax still sends the
            // cookie there; 'strict' would silently drop it on every request
            // that did not originate as a top-level navigation to :8001.
            sameSite: 'lax',
        );

        return response()
            ->json((new AuthResponseDto($user, $expiresAt))->toArray())
            ->withCookie($cookie);
    }
}
