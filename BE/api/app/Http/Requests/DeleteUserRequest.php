<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The delete target arrives in the body, not the URL, so it needs validating
 * the same way any other input would be.
 */
class DeleteUserRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid', Rule::exists('users', 'uuid')],
        ];
    }
}
