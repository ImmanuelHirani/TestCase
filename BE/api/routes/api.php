<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
 * URL-path versioning (/api/v1/...).
 *
 * Microsoft's Azure guidelines argue against a version segment in the path;
 * Zalando's argue for avoiding versioning at all where possible, preferring
 * additive, backward-compatible changes. Both are defensible, but every
 * major guideline agrees on the one thing that matters here: an explicit,
 * documented versioning decision has to exist from day one, not get bolted
 * on after the first breaking change forces the question. Path versioning is
 * the most legible choice for a project this size, and matches what most
 * public APIs (GitHub, Stripe et al.) actually ship.
 *
 * Within it, the user collection uses Google-style custom methods
 * (AIP-136 -- `resource:verb`) so that each operation is identifiable from
 * the URL alone in a Network tab, access log or trace. See UserController's
 * class docblock for the reasoning and the trade-off.
 */
Route::prefix('v1')->group(function () {
    // Public. Rate-limited so the login form cannot be used to brute force.
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    Route::middleware('jwt.cookie')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Dashboard aggregates. Readable by any authenticated user.
        Route::get('/stats', [StatsController::class, 'index']);

        // Reading is open to any authenticated user.
        //
        // :find and :search are POST because their parameters travel in the
        // request body rather than the URL -- see UserController's docblock
        // for why (search terms staying out of logs and history, no query
        // string length ceiling, structured filters). GET /users/{id} stays
        // a plain safe read.
        Route::post('/users:find', [UserController::class, 'find']);
        Route::post('/users:search', [UserController::class, 'search']);
        // whereUuid is not decoration. The route key is the `uuid` column, so
        // without this constraint /users/999999 reaches Postgres as
        // `where uuid = '999999'`, which is not a castable uuid literal -- the
        // driver raises SQLSTATE 22P02 and the client gets a 500 for what is
        // plainly a 404. Constraining the segment means a malformed id never
        // matches the route at all, and the not-found envelope comes back
        // from routing before any query runs.
        Route::get('/users/{user}', [UserController::class, 'show'])
            ->whereUuid('user')
            ->name('users.show');

        // ...writing is admin-only.
        //
        // All three are POST with the target id (where there is one) in the
        // body, so no record identifier ever appears in a request line -- and
        // so every write reads as one consistent `users:verb` in a trace.
        Route::middleware('role:admin')->group(function () {
            Route::post('/users:create', [UserController::class, 'create']);
            Route::post('/users:update', [UserController::class, 'update']);
            Route::post('/users:delete', [UserController::class, 'destroy']);
        });
    });
});
