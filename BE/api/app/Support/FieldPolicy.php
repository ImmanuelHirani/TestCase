<?php

namespace App\Support;

use App\Models\User;

/**
 * Which fields of a user record the *caller* is allowed to see.
 *
 * Field-level authorisation, as opposed to the endpoint-level authorisation
 * the `role` middleware already does: a non-admin may legitimately list
 * colleagues, but has no business reading their personal phone numbers.
 *
 * The policy is also published in the response body (see
 * UserCollectionResponse) rather than silently applied. Two reasons:
 *
 *   1. A client that sees `phone` missing can tell "you're not allowed" apart
 *      from "this user has no phone number on file" -- otherwise both look
 *      identical and a UI would show a blank field either way.
 *   2. Microsoft's guideline is "DO NOT send JSON fields with a null value
 *      from the service to the client" -- omit instead. Omission alone is
 *      ambiguous, so the policy block is what removes the ambiguity.
 */
final class FieldPolicy
{
    /** Every field UserResource can emit, in response order. */
    private const ALL_FIELDS = [
        'id', 'name', 'email', 'role', 'department', 'phone', 'created_at', 'updated_at',
    ];

    /** Fields only an admin may read. */
    private const ADMIN_ONLY_FIELDS = ['phone'];

    public function __construct(private readonly ?User $viewer) {}

    public function isAdmin(): bool
    {
        return $this->viewer?->isAdmin() ?? false;
    }

    /** @return string[] */
    public function visibleFields(): array
    {
        return $this->isAdmin()
            ? self::ALL_FIELDS
            : array_values(array_diff(self::ALL_FIELDS, self::ADMIN_ONLY_FIELDS));
    }

    /** @return string[] */
    public function restrictedFields(): array
    {
        return $this->isAdmin() ? [] : self::ADMIN_ONLY_FIELDS;
    }

    public function allows(string $field): bool
    {
        return in_array($field, $this->visibleFields(), true);
    }

    /**
     * The self-documenting block published alongside the data, so the
     * contract is legible from the response itself (and from a browser's
     * Network preview) without cross-referencing the docs.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $restricted = $this->restrictedFields();

        return [
            'viewer_role' => $this->viewer?->role->value ?? 'anonymous',
            'visible' => $this->visibleFields(),
            'restricted' => $restricted,
            'note' => $restricted === []
                ? 'Admin viewer: all fields returned.'
                : 'Restricted fields are omitted from each record, not returned as null. '
                    .'Sign in as an admin to see them.',
        ];
    }
}
