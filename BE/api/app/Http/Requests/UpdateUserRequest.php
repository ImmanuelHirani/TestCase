<?php

namespace App\Http\Requests;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // The target now arrives in the body rather than the URL, so the
        // "email is unique except for this row" rule reads it from there.
        // `exists` is validated alongside it, which means a bad id comes back
        // as a 422 field error on `id` rather than a bare 404 -- the client
        // sent one body, so it gets one validation response describing
        // everything wrong with it.
        $userId = $this->input('id');

        return [
            'id' => ['required', 'uuid', Rule::exists('users', 'uuid')],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            // ignore() compares against the `id` column by default; the second
            // argument repoints it at `uuid`. Without it the rule would look
            // for a row whose numeric id equals a UUID string, match nothing,
            // and reject the user's own unchanged email as "already taken".
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId, 'uuid')],
            // Optional on update: an empty password field means "leave it alone".
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
            'role' => ['required', Rule::in(Role::values())],
            'department' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+\-\s()]+$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.regex' => 'The phone number may only contain digits, spaces, +, -, and parentheses.',
        ];
    }
}
