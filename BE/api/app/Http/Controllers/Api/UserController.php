<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PreconditionFailedException;
use App\Exceptions\UnsupportedQueryParameterException;
use App\Http\Controllers\Controller;
use App\Http\Requests\DeleteUserRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserCollectionResponse;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Repositories\UserRepository;
use App\Support\ETag;
use App\Support\FieldPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Users.
 *
 * Reads are split into two custom methods rather than one overloaded list
 * endpoint, and both take their parameters in a JSON **request body** rather
 * than a query string:
 *
 *   POST /users:find     browse -- paging only, no filters
 *   POST /users:search   query  -- search term and/or role filter
 *
 * Two decisions here, each with a reason.
 *
 * 1. Custom methods (Google AIP-136: a colon-separated verb). Intent is
 *    legible from the URL alone -- in a Network tab, an access log, an APM
 *    trace -- without decoding anything. It also lets the two be treated
 *    differently where it matters: `search` runs ILIKE scans and is the
 *    expensive one to rate-limit or cache separately from a plain browse.
 *
 * 2. POST with a body, not GET with a query string. AIP-136 makes POST the
 *    default for custom methods, and the same shape is what Elasticsearch
 *    (`POST /_search`), Azure AI Search and Google Cloud Asset Inventory all
 *    ship. The practical reasons:
 *
 *      - Search terms stop leaking. A query string lands in server access
 *        logs, browser history, and `Referer` headers on any outbound link.
 *        A body does not. When the filter is an employee's name, that
 *        difference is a privacy property, not a style preference.
 *      - No length ceiling. Query strings get truncated by proxies somewhere
 *        around 2 KB; a filter set that grows (date ranges, multi-select
 *        departments) has room in a body.
 *      - Structured filters stay structured. Nested/array criteria are
 *        natural in JSON and awkward-to-ambiguous in `?a[]=x&a[]=y`.
 *
 *    The cost, stated plainly: POST responses are not HTTP-cacheable and POST
 *    is not a "safe" method in HTTP's sense, so this trades shared-cache
 *    friendliness for the above. For an authenticated admin dashboard whose
 *    responses are per-viewer (see FieldPolicy) and therefore uncacheable by
 *    a shared cache anyway, that trade costs nothing real -- and react-query
 *    still caches client-side on the request body.
 *
 * The standard REST read (GET /users/{id}) is deliberately left alone: it is
 * a plain, safe, cacheable resource fetch and has no reason to change.
 */
#[OA\Tag(name: 'Users', description: 'Cursor-paginated find/search, plus create, update and delete')]
class UserController extends Controller
{
    /** Body fields users:find understands. Anything else is rejected. */
    private const ALLOWED_FIND_PARAMS = ['limit', 'cursor', 'sort', 'direction'];

    /** users:search additionally accepts the filter fields. */
    private const ALLOWED_SEARCH_PARAMS = ['limit', 'cursor', 'sort', 'direction', 'search', 'role'];

    public function __construct(private readonly UserRepository $users) {}

    #[OA\Post(
        path: '/users:find',
        summary: 'Browse users (cursor-paginated, unfiltered)',
        description: 'Plain listing. Parameters go in the JSON body, not the URL. Accepts paging and sorting only -- passing `search` or `role` here is rejected with 400; use /users:search for those.',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'limit', type: 'integer', default: 10, maximum: 100),
                    new OA\Property(property: 'cursor', type: 'string', nullable: true, description: 'Opaque cursor from a previous response\'s page.next_cursor. Do not construct or parse.'),
                    new OA\Property(property: 'sort', type: 'string', nullable: true, enum: ['name', 'email', 'department', 'role', 'created_at'], description: 'Omit for the server\'s default ordering. `id` is deliberately not sortable: the published id is a random uuid, so ordering by it would sort rows by nothing a reader can see.'),
                    new OA\Property(property: 'direction', type: 'string', enum: ['asc', 'desc'], default: 'asc'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'A cursor page of users, with the caller\'s field policy'),
            new OA\Response(response: 400, description: 'An unsupported body field was supplied'),
            new OA\Response(response: 401, description: 'Not authenticated'),
        ],
    )]
    public function find(Request $request): JsonResponse
    {
        $this->rejectUnsupportedParams($request, self::ALLOWED_FIND_PARAMS);

        $validated = $request->validate($this->pagingRules());

        $page = $this->users->cursorPaginate(
            search: null,
            role: null,
            limit: (int) ($validated['limit'] ?? 10),
            sort: $validated['sort'] ?? null,
            direction: $validated['direction'] ?? 'asc',
            cursor: $validated['cursor'] ?? null,
        );

        return response()->json((new UserCollectionResponse('find', $page))->toArray($request));
    }

    #[OA\Post(
        path: '/users:search',
        summary: 'Search and filter users (cursor-paginated)',
        description: 'Same page shape as :find, plus the `search` term and `role` filter. Criteria go in the JSON body so they never land in a URL, an access log or browser history.',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'search', type: 'string', nullable: true, description: 'Matches name or email (case-insensitive, partial), or the leading characters of a user UUID', example: 'budi'),
                    new OA\Property(property: 'role', type: 'string', nullable: true, enum: ['admin', 'user']),
                    new OA\Property(property: 'limit', type: 'integer', default: 10, maximum: 100),
                    new OA\Property(property: 'cursor', type: 'string', nullable: true),
                    new OA\Property(property: 'sort', type: 'string', nullable: true, enum: ['name', 'email', 'department', 'role', 'created_at'], description: 'Omit for the server\'s default ordering. `id` is deliberately not sortable: the published id is a random uuid, so ordering by it would sort rows by nothing a reader can see.'),
                    new OA\Property(property: 'direction', type: 'string', enum: ['asc', 'desc'], default: 'asc'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'A cursor page of matching users'),
            new OA\Response(response: 400, description: 'An unsupported body field was supplied'),
            new OA\Response(response: 401, description: 'Not authenticated'),
        ],
    )]
    public function search(Request $request): JsonResponse
    {
        $this->rejectUnsupportedParams($request, self::ALLOWED_SEARCH_PARAMS);

        $validated = $request->validate($this->pagingRules() + [
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'in:admin,user'],
        ]);

        $page = $this->users->cursorPaginate(
            search: $validated['search'] ?? null,
            role: $validated['role'] ?? null,
            limit: (int) ($validated['limit'] ?? 10),
            sort: $validated['sort'] ?? null,
            direction: $validated['direction'] ?? 'asc',
            cursor: $validated['cursor'] ?? null,
        );

        return response()->json((new UserCollectionResponse('search', $page))->toArray($request));
    }

    #[OA\Get(
        path: '/users/{id}',
        summary: 'Fetch a single user',
        description: 'Standard REST read, deliberately not a custom method. Carries an ETag for use as If-Match on a later update.',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        parameters: [new OA\Parameter(
            name: 'id',
            in: 'path',
            required: true,
            description: 'The public UUID from the `id` field of a find/search result. The internal primary key is not accepted here and is never published.',
            schema: new OA\Schema(type: 'string', format: 'uuid'),
        )],
        responses: [
            new OA\Response(response: 200, description: 'The user, plus the caller\'s field policy'),
            new OA\Response(response: 404, description: 'No user with that ID'),
        ],
    )]
    public function show(Request $request, User $user): JsonResponse
    {
        return response()
            ->json([
                'operation' => 'get',
                'data' => (new UserResource($user))->toArray($request),
                'field_policy' => (new FieldPolicy($request->user()))->toArray(),
            ])
            ->header('ETag', ETag::forUser($user));
    }

    #[OA\Post(
        path: '/users:create',
        summary: 'Create a user (admin only)',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'role'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Siti Rahayu'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'siti@jasindo.test'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', minLength: 8),
                    new OA\Property(property: 'role', type: 'string', enum: ['admin', 'user']),
                    new OA\Property(property: 'department', type: 'string', nullable: true, example: 'Underwriting'),
                    new OA\Property(property: 'phone', type: 'string', nullable: true, example: '081234567890'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Created. Location header points at the new resource.'),
            new OA\Response(response: 403, description: 'Caller is not an admin'),
            new OA\Response(response: 422, description: 'Validation failed'),
        ],
    )]
    public function create(StoreUserRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        // RFC 9110 §10.2.2 / every guideline reviewed here: 201 Created MUST
        // point at the new resource via Location. Built from the named route
        // rather than a hand-built string, so it can't drift from the actual
        // show endpoint (or its /v1 prefix) if either ever changes.
        return response()
            ->json([
                'operation' => 'create',
                'data' => (new UserResource($user))->toArray($request),
            ], 201)
            ->header('Location', route('users.show', $user))
            ->header('ETag', ETag::forUser($user));
    }

    #[OA\Post(
        path: '/users:update',
        summary: 'Update a user (admin only)',
        description: 'The target `id` travels in the body, not the URL, so no record identifier is exposed in the request line. Optionally send If-Match with the ETag from a prior read: a mismatch means someone else changed the record first and returns 412 instead of silently overwriting their change.',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'If-Match', in: 'header', required: false, schema: new OA\Schema(type: 'string')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['id', 'name', 'email', 'role'],
                properties: [
                    new OA\Property(property: 'id', type: 'string', format: 'uuid', example: '8f14e45f-ceea-4d4b-9d2e-3b7a1c05f9a2', description: 'The target user\'s public UUID.'),
                    new OA\Property(property: 'name', type: 'string', example: 'Siti Rahayu'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', nullable: true, description: 'Blank or omitted keeps the current password.'),
                    new OA\Property(property: 'role', type: 'string', enum: ['admin', 'user']),
                    new OA\Property(property: 'department', type: 'string', nullable: true),
                    new OA\Property(property: 'phone', type: 'string', nullable: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Updated'),
            new OA\Response(response: 403, description: 'Caller is not an admin'),
            new OA\Response(response: 412, description: 'If-Match did not match the resource\'s current ETag'),
            new OA\Response(response: 422, description: 'Validation failed, or no user with that id'),
        ],
    )]
    public function update(UpdateUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        // `id` addresses the row; it is not a column anyone may write. Pulling
        // it out before update() is what stops a body from reassigning a
        // record's primary key.
        $user = User::where('uuid', $data['id'])->firstOrFail();
        unset($data['id']);

        // Optimistic concurrency: two admins editing the same user is exactly
        // the case this guards. Skipped when the client sends no If-Match, so
        // this stays backward compatible with a caller that never fetched an
        // ETag to begin with.
        $ifMatch = $request->header('If-Match');
        if ($ifMatch !== null && $ifMatch !== ETag::forUser($user)) {
            throw new PreconditionFailedException(ETag::forUser($user));
        }

        // Blank password field means "keep the existing one".
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        $user->update($data);
        $user = $user->fresh();

        return response()
            ->json([
                'operation' => 'update',
                'data' => (new UserResource($user))->toArray($request),
            ])
            ->header('ETag', ETag::forUser($user));
    }

    #[OA\Post(
        path: '/users:delete',
        summary: 'Delete a user (admin only)',
        description: 'The target `id` travels in the body, not the URL. Returns 200 with a small confirmation body rather than a bare 204, so the deletion is visible and attributable in a Network trace.',
        tags: ['Users'],
        security: [['cookieAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['id'],
                properties: [new OA\Property(property: 'id', type: 'string', format: 'uuid', example: '8f14e45f-ceea-4d4b-9d2e-3b7a1c05f9a2')],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Deleted'),
            new OA\Response(response: 403, description: 'Caller is not an admin, or is deleting themselves'),
            new OA\Response(response: 422, description: 'No user with that id'),
        ],
    )]
    public function destroy(DeleteUserRequest $request): JsonResponse
    {
        $user = User::where('uuid', $request->validated()['id'])->firstOrFail();

        // Deleting your own account mid-session would strand the client
        // holding a token for a row that no longer exists.
        if ($request->user()->is($user)) {
            throw new AccessDeniedHttpException('You cannot delete your own account.');
        }

        $deletedId = $user->uuid;
        $deletedName = $user->name;
        $user->delete();

        // 204 No Content would be the textbook choice, but a 204 shows up in
        // a Network trace as an empty row that says nothing about what was
        // removed. A small 200 body makes the operation self-describing at
        // the point where someone is actually looking at it.
        return response()->json([
            'operation' => 'delete',
            'data' => [
                'id' => $deletedId,
                'name' => $deletedName,
                'deleted' => true,
            ],
        ]);
    }

    /**
     * Microsoft Azure API guidelines (MUST): "DO return an error if the
     * client specifies any parameter not supported." A typo like
     * `"drection": "desc"` would otherwise fail silently -- the client
     * believes it sorted descending and nothing in the response says it did
     * not.
     *
     * Both the body *and* the query string are checked. The query string is
     * always empty for these endpoints by design, so anything appearing there
     * means the caller is still building URLs the old way and should be told
     * rather than have half its parameters quietly ignored.
     *
     * @param  string[]  $allowed
     */
    private function rejectUnsupportedParams(Request $request, array $allowed): void
    {
        $supplied = array_merge(array_keys($request->json()->all()), array_keys($request->query()));
        $unsupported = array_values(array_unique(array_diff($supplied, $allowed)));

        if ($unsupported !== []) {
            throw new UnsupportedQueryParameterException($unsupported);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function pagingRules(): array
    {
        return [
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'cursor' => ['nullable', 'string'],
            'sort' => ['nullable', 'in:id,name,email,department,role,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
        ];
    }
}
