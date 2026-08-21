import { z } from 'zod';
import {
  apiClient,
  cursorPaginatedSchema,
  FieldPolicySchema,
  isSearchQuery,
  parseApiResponse,
  StatsSchema,
  UserSchema,
} from '@jasindo/shared';
import type { CursorPaginated, Stats, User, UserPayload, UsersQuery } from '@jasindo/shared';

const UsersPageSchema = cursorPaginatedSchema(UserSchema);
const UserReadSchema = z.object({
  operation: z.string(),
  data: UserSchema,
  field_policy: FieldPolicySchema,
});
const UserWriteSchema = z.object({ operation: z.string(), data: UserSchema });
const UserDeleteSchema = z.object({
  operation: z.string(),
  data: z.object({ id: z.uuid(), name: z.string(), deleted: z.literal(true) }),
});
const StatsEnvelopeSchema = z.object({ data: StatsSchema });

/**
 * Routes to `users:search` when any filter is active, `users:find` otherwise.
 * Two endpoints, not one with optional params -- so the Network tab shows
 * which of the two actually ran, and so the cheap browse path can be cached
 * and rate-limited differently from the ILIKE-scanning search path.
 *
 * `:find` rejects filter params outright (400), so this routing is not a
 * cosmetic choice -- sending a filtered query to the wrong one is an error,
 * not a silently unfiltered result.
 *
 * Both are POST with a JSON body rather than GET with a query string. The URL
 * stays clean (`POST /api/v1/users:search`, nothing after it), and the search
 * term never reaches an access log, browser history or `Referer` header --
 * which matters when the term is somebody's name. See the backend's
 * UserController docblock for the full reasoning.
 */
export async function fetchUsers(
  query: UsersQuery,
  signal?: AbortSignal,
): Promise<CursorPaginated<User>> {
  const searching = isSearchQuery(query);
  const endpoint = searching ? '/users:search' : '/users:find';

  const body = {
    // Only sent to :search -- :find would reject them with a 400.
    ...(searching ? { search: query.search || undefined, role: query.role || undefined } : {}),
    limit: query.limit,
    cursor: query.cursor || undefined,
    sort: query.sort,
    direction: query.direction,
  };

  const { data } = await apiClient.post(endpoint, body, { signal });

  return parseApiResponse(UsersPageSchema, data);
}

export interface UserWithETag {
  user: User;
  /**
   * The ETag Laravel computed for this exact row (uuid + updated_at). Send it
   * back as If-Match on the following update so the server can tell whether
   * someone else changed the row in between -- optimistic concurrency,
   * without needing to poll or lock anything.
   */
  etag: string | null;
}

/**
 * Fetches one user fresh, with its current ETag. Used right before opening
 * the edit form rather than trusting the row already sitting in a cached
 * list -- both because the list is potentially stale, and because the list
 * response has no per-row ETag to edit against in the first place.
 */
export async function fetchUser(id: string, signal?: AbortSignal): Promise<UserWithETag> {
  const response = await apiClient.get(`/users/${id}`, { signal });
  return {
    user: parseApiResponse(UserReadSchema, response.data).data,
    etag: response.headers['etag'] ?? null,
  };
}

export async function createUser(payload: UserPayload): Promise<User> {
  const { data } = await apiClient.post('/users:create', payload);
  return parseApiResponse(UserWriteSchema, data).data;
}

/**
 * The target `id` goes in the body alongside the payload, so the request line
 * stays `POST /users:update` with no record identifier in it.
 *
 * `etag` is optional -- omit it and the update behaves as last-write-wins.
 * Pass the one `fetchUser` returned and a stale write comes back as an
 * ApiError with code PRECONDITION_FAILED instead of silently overwriting
 * whatever changed underneath it.
 */
export async function updateUser(
  id: string,
  payload: UserPayload,
  etag?: string | null,
): Promise<UserWithETag> {
  const response = await apiClient.post(
    '/users:update',
    { id, ...payload },
    { headers: etag ? { 'If-Match': etag } : undefined },
  );
  return {
    user: parseApiResponse(UserWriteSchema, response.data).data,
    etag: response.headers['etag'] ?? null,
  };
}

export async function deleteUser(id: string): Promise<{ id: string; name: string }> {
  const { data } = await apiClient.post('/users:delete', { id });
  const parsed = parseApiResponse(UserDeleteSchema, data);
  return { id: parsed.data.id, name: parsed.data.name };
}

export async function fetchStats(signal?: AbortSignal): Promise<Stats> {
  const { data } = await apiClient.get('/stats', { signal });
  return parseApiResponse(StatsEnvelopeSchema, data).data;
}
