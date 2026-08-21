<?php

use App\Exceptions\PreconditionFailedException;
use App\Exceptions\UnsupportedQueryParameterException;
use App\Http\Middleware\AuthenticateJwtCookie;
use App\Http\Middleware\EnsureUserHasRole;
use App\Support\ProblemType;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Global exception handling.
 *
 * Every failure the API can produce leaves as one envelope, following
 * RFC 9457 (Problem Details for HTTP APIs) -- the format Zalando's, and
 * Spring Boot's and ASP.NET's *default*, error shape, understood by generic
 * tooling (API gateways, monitoring, client generators) without a custom
 * client for this API specifically:
 *
 *   {
 *     "type":     "https://api.jasindo.test/problems/validation-error",
 *     "title":    "The submitted data is invalid.",   // stable, not localised
 *     "status":   422,                                 // must match the HTTP status
 *     "detail":   "...",                                // this occurrence
 *     "instance": "/api/v1/users",                       // this request
 *     "code":     "VALIDATION_ERROR",  // extension: machine-matchable, RFC 9457 §3.2 allows
 *     "errors":   { "email": ["..."] } // extension: per-field messages
 *   }
 *
 * Content-Type is application/problem+json, also per the RFC -- distinct
 * from a normal application/json success body, so a client (or a proxy) can
 * tell the two apart without inspecting the status code first.
 *
 * `code` and `errors` are the RFC's "extension members" (explicitly allowed,
 * §3.2): the frontend keeps switching on the stable `code` string rather
 * than parsing `title`/`detail` text, while still getting a response shape
 * generic tooling already understands.
 *
 * Returning null falls through to Laravel's own handling, which is what keeps
 * the normal web routes rendering as HTML.
 */
if (! function_exists('apiExceptionResponse')) {
function apiExceptionResponse(Throwable $e, Request $request): ?JsonResponse
{
    if (! $request->is('api/*') && ! $request->expectsJson()) {
        return null;
    }

    $debug = (bool) config('app.debug');

    [$type, $code, $title, $detail, $status, $errors] = match (true) {
        $e instanceof ValidationException => [
            ProblemType::VALIDATION_ERROR, 'VALIDATION_ERROR',
            'The submitted data is invalid.', 'One or more fields failed validation.', 422, $e->errors(),
        ],
        $e instanceof AuthenticationException => [
            ProblemType::UNAUTHENTICATED, 'UNAUTHENTICATED',
            'Authentication required.', 'You must be signed in to do that.', 401, [],
        ],
        $e instanceof UnsupportedQueryParameterException => [
            ProblemType::UNSUPPORTED_PARAMETER, 'UNSUPPORTED_PARAMETER',
            'Unsupported parameter.', $e->getMessage(), 400, [],
        ],
        $e instanceof PreconditionFailedException => [
            ProblemType::PRECONDITION_FAILED, 'PRECONDITION_FAILED',
            'The resource has changed.', $e->getMessage(), 412, [],
        ],
        $e instanceof AuthorizationException => [
            ProblemType::FORBIDDEN, 'FORBIDDEN',
            'Access denied.', $e->getMessage() ?: 'You do not have permission to do that.', 403, [],
        ],
        $e instanceof ModelNotFoundException => [
            ProblemType::NOT_FOUND, 'NOT_FOUND',
            'Resource not found.', 'The requested record does not exist.', 404, [],
        ],
        $e instanceof NotFoundHttpException => [
            ProblemType::NOT_FOUND, 'NOT_FOUND',
            'Resource not found.', 'The requested endpoint does not exist.', 404, [],
        ],
        // The driver message names tables and columns, so it is only exposed in debug.
        $e instanceof QueryException => [
            ProblemType::DATABASE_ERROR, 'DB_ERROR',
            'Database error.', $debug ? $e->getMessage() : 'A database error occurred.', 500, [],
        ],
        // Every remaining HttpExceptionInterface (403/405/429/...): title and
        // code are derived from the status code so nothing falls through
        // unlabelled, and the exception's own headers -- Allow on a 405,
        // Retry-After and RateLimit-* on a 429 -- are preserved below rather
        // than lost when we rebuild the response.
        $e instanceof HttpExceptionInterface => (function () use ($e) {
            $status = $e->getStatusCode();
            [$type, $code, $title] = problemForStatus($status);

            return [$type, $code, $title, $e->getMessage() ?: $title, $status, []];
        })(),
        default => [
            ProblemType::SERVER_ERROR, 'SERVER_ERROR',
            'Unexpected error.', $debug ? $e->getMessage() : 'An unexpected error occurred.', 500, [],
        ],
    };

    $payload = [
        'type' => $type,
        'title' => $title,
        'status' => $status,
        'detail' => $detail,
        'instance' => '/'.ltrim($request->getRequestUri(), '/'),
        'code' => $code,
    ];

    if ($errors !== []) {
        $payload['errors'] = $errors;
    }

    $response = response()->json($payload, $status)
        ->header('Content-Type', 'application/problem+json');

    // Preserve any headers the exception itself carries -- Retry-After and
    // RateLimit-* on a throttled request, Allow on a 405 -- which Laravel's
    // own unhandled-exception path would have kept, but rebuilding the
    // response from scratch above would otherwise silently drop.
    if ($e instanceof HttpExceptionInterface) {
        foreach ($e->getHeaders() as $name => $value) {
            $response->headers->set($name, $value);
        }
    }

    return $response;
}
}

/**
 * @return array{0: string, 1: string, 2: string}  [type, code, title]
 */
if (! function_exists('problemForStatus')) {
function problemForStatus(int $status): array
{
    return match ($status) {
        403 => [ProblemType::FORBIDDEN, 'FORBIDDEN', 'Access denied.'],
        405 => [ProblemType::METHOD_NOT_ALLOWED, 'NOT_FOUND', 'Method not allowed.'],
        429 => [ProblemType::TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', 'Too many requests.'],
        412 => [ProblemType::PRECONDITION_FAILED, 'PRECONDITION_FAILED', 'Precondition failed.'],
        default => [ProblemType::SERVER_ERROR, 'SERVER_ERROR', 'Request failed.'],
    };
}
}

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'jwt.cookie' => AuthenticateJwtCookie::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(fn (Throwable $e, Request $request) => apiExceptionResponse($e, $request));
    })->create();
