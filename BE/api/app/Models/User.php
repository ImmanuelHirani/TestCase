<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

/**
 * `id` (auto-increment) stays the internal primary key; `uuid` is the public
 * identifier every API response and request uses. See the add_uuid migration
 * for why the two are separate.
 *
 * `uuid` is deliberately absent from #[Fillable]: it is assigned once by the
 * creating hook below and must never be settable from a request body.
 */
#[Fillable(['name', 'email', 'password', 'role', 'department', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            $user->uuid ??= (string) Str::uuid();
        });
    }

    /**
     * Route-model binding resolves {user} by uuid, so a URL never contains
     * the numeric key even on the one endpoint that still takes an id in the
     * path (GET /users/{id}).
     */
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }
}
