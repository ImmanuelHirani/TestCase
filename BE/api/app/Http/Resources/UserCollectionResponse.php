<?php

namespace App\Http\Resources;

use App\Support\FieldPolicy;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Http\Request;

/**
 * The response body shared by users:find and users:search.
 *
 * Shaped so that a browser's Network preview is self-explanatory without
 * consulting the docs alongside it:
 *
 *   {
 *     "operation": "search",              // which custom method produced this
 *     "data":      [ ...records... ],
 *     "page":      { limit, has_more, next_cursor, prev_cursor },
 *     "field_policy": { viewer_role, visible, restricted, note }
 *   }
 *
 * `page` carries no `total` on purpose -- see UserRepository::cursorPaginate.
 */
final class UserCollectionResponse
{
    public function __construct(
        private readonly string $operation,
        private readonly CursorPaginator $paginator,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'operation' => $this->operation,
            'data' => UserResource::collection($this->paginator->items())->toArray($request),
            'page' => [
                'limit' => $this->paginator->perPage(),
                'has_more' => $this->paginator->hasMorePages(),
                // Opaque strings by contract: a client must treat these as
                // "hand this back verbatim to get the next page", never parse
                // or construct one. That keeps the encoding free to change.
                'next_cursor' => $this->paginator->nextCursor()?->encode(),
                'prev_cursor' => $this->paginator->previousCursor()?->encode(),
            ],
            'field_policy' => (new FieldPolicy($request->user()))->toArray(),
        ];
    }
}
