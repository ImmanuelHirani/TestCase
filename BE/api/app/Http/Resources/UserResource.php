<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\FieldPolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 *
 * Explicit whitelist: password and remember_token can never leak, even if
 * someone later adds a sensitive column to the table.
 *
 * On top of that whitelist, FieldPolicy applies *per-viewer* restrictions --
 * a non-admin does not receive `phone` at all. Restricted fields are omitted
 * rather than nulled (Microsoft: "DO NOT send JSON fields with a null value
 * from the service to the client"), and the accompanying field_policy block
 * in the collection response says which ones were dropped and why.
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $policy = new FieldPolicy($request->user());

        $fields = [
            // The public identifier is the UUID. The auto-increment primary
            // key is never serialised -- a sequential id is guessable and
            // countable (hold /users/41, try 42; watch the ids over a week and
            // you know the hiring rate), and this resource is the single
            // choke point where that could otherwise leak.
            'id' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'department' => $this->department,
            'phone' => $this->phone,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        return array_filter(
            $fields,
            fn (string $field) => $policy->allows($field),
            ARRAY_FILTER_USE_KEY,
        );
    }
}
