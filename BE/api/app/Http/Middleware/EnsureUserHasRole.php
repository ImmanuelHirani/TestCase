<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Role gate for write endpoints: `->middleware('role:admin')`.
 *
 * It throws rather than returning a response, so the shape of the 403 body is
 * decided in exactly one place -- the global exception handler.
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null || ! in_array($user->role->value, $roles, true)) {
            throw new AccessDeniedHttpException(
                'This action requires one of the following roles: '.implode(', ', $roles).'.'
            );
        }

        return $next($request);
    }
}
