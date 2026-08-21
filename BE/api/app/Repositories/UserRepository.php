<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;

class UserRepository
{
    private const MAX_LIMIT = 100;

    /**
     * Columns TanStack Table is allowed to sort by. A whitelist, not a
     * pass-through of whatever column name the client sends -- the sort
     * field ends up directly in an `orderBy`, so an unchecked value here
     * would be a column-name injection vector.
     */
    private const SORTABLE_COLUMNS = ['name', 'email', 'department', 'role', 'created_at'];

    /**
     * Applied after the requested sort, and used alone when the request does
     * not name one.
     *
     * It has to be a column that is both unique and safe to publish. Unique,
     * because a cursor is built from the ordered columns and needs exactly
     * one row to resume from. Safe to publish, because the cursor is handed
     * to the client -- Laravel base64-encodes the ordered values into it, so
     * whatever appears in the ORDER BY appears, decodable, in the browser.
     * Ordering by the numeric primary key would therefore have re-published
     * the very identifier UserResource and the uuid migration exist to keep
     * private. `uuid` is already public, so it costs nothing.
     */
    private const TIE_BREAK_COLUMN = 'uuid';

    /**
     * Search + filter + sort, cursor-paginated.
     *
     * Cursor rather than offset, per Zalando rule 160 (SHOULD: "Prefer
     * cursor-based pagination, avoid offset-based pagination"). Two concrete
     * reasons it matters beyond following the rule:
     *
     *   - Correctness. With OFFSET, a row inserted or deleted while someone
     *     is paging shifts every subsequent row by one, so they silently skip
     *     or re-see records. A cursor points at "the row after this specific
     *     one", so concurrent writes cannot shift the window.
     *   - Cost. OFFSET 10000 makes Postgres walk and discard 10 000 rows on
     *     every request; a keyset cursor seeks straight to the position via
     *     the index, and stays flat no matter how deep the page is.
     *
     * The trade-off is real and worth stating: cursors cannot jump to an
     * arbitrary page number, and deliberately do not carry a total count
     * (Zalando rule 254, Microsoft "YOU SHOULD NOT return a count") because
     * producing one costs a second full scan. The dashboard's totals come
     * from /stats, which aggregates properly, instead.
     *
     * Every value goes through Eloquent's parameter binding -- no string
     * concatenation into SQL anywhere, so the search box cannot be injected.
     */
    public function cursorPaginate(
        ?string $search,
        ?string $role,
        int $limit,
        ?string $sort = null,
        string $direction = 'asc',
        ?string $cursor = null,
    ): CursorPaginator {
        $sort = in_array($sort, self::SORTABLE_COLUMNS, true) ? $sort : null;
        $direction = $direction === 'desc' ? 'desc' : 'asc';

        return User::query()
            ->when($search, fn (Builder $query, string $term) => $query->where(
                function (Builder $inner) use ($term) {
                    // Postgres ILIKE: case-insensitive without lowering the column,
                    // so the index on name still gets considered.
                    $inner->where('name', 'ILIKE', '%'.$term.'%')
                        ->orWhere('email', 'ILIKE', '%'.$term.'%');

                    // "Search by name or ID". The ID a user can actually see is
                    // the UUID -- the numeric primary key never leaves the
                    // server -- so that is what a term gets matched against.
                    // Prefix-matched rather than exact: nobody types 36
                    // characters by hand, but pasting the first block of a UUID
                    // copied out of the table is a realistic thing to do.
                    if (preg_match('/^[0-9a-f]{4,8}(-[0-9a-f-]*)?$/i', $term) === 1) {
                        $inner->orWhere('uuid', 'ILIKE', $term.'%');
                    }
                }
            ))
            ->when($role, fn (Builder $query, string $value) => $query->where('role', $value))
            ->when($sort, fn (Builder $query, string $column) => $query->orderBy($column, $direction))
            // Always applied. When a sort was requested this is the tie-break
            // that makes the ordering total (several people can share a
            // department); when none was, it is the whole ordering.
            ->orderBy(self::TIE_BREAK_COLUMN, $direction)
            ->cursorPaginate(min($limit, self::MAX_LIMIT), ['*'], 'cursor', $cursor)
            ->withQueryString();
    }
}
