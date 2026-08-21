<?php

namespace App\Http\DTOs;

use App\Http\Resources\UserResource;
use App\Models\User;

/**
 * Response DTO for every auth endpoint (login, me).
 *
 * Deliberately excludes the token itself: the token lives only in the
 * HttpOnly cookie the browser attaches automatically, never in a JSON body a
 * script could read. `expires_at` lets the UI show "session expires in..."
 * without needing to decode the cookie it cannot access.
 *
 * @see \App\Http\DTOs\UserPayloadDto for the equivalent on the write side.
 */
final readonly class AuthResponseDto
{
    public function __construct(
        private User $user,
        private int $expiresAt,
    ) {}

    /**
     * @return array{success: true, user: UserResource, expires_at: string}
     */
    public function toArray(): array
    {
        return [
            'success' => true,
            'user' => new UserResource($this->user),
            'expires_at' => gmdate('c', $this->expiresAt),
        ];
    }
}
