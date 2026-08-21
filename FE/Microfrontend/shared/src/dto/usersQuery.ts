import { z } from 'zod';
import { RoleSchema } from './user';

/**
 * Request DTO for the users list query.
 *
 * Serves three jobs from one definition: it is the component state UsersPage
 * holds, the react-query cache key, and the JSON body POSTed to
 * `users:find` / `users:search`. Because it is the same object in all three
 * roles, the cache key can never describe a different query than the one
 * actually sent.
 *
 * These values deliberately do not appear in the browser URL -- see
 * UsersPage's docblock for that trade. `cursor` is opaque: the UI only ever
 * echoes back a cursor the server handed it, never builds one.
 */
export const UsersQuerySchema = z.object({
  search: z.string().max(255).optional(),
  role: RoleSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  // No 'id' option: the published id is a random uuid, so sorting by it would
  // order rows by nothing a reader can see. Omitting `sort` asks for the
  // server's default ordering instead.
  sort: z.enum(['name', 'email', 'department', 'role', 'created_at']).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type UsersQuery = z.infer<typeof UsersQuerySchema>;

/**
 * Which custom method a given query should hit.
 *
 * The split is the whole point of having two endpoints: a plain browse and a
 * filtered query are different operations with different costs, and naming
 * them separately is what makes that visible in a Network trace. `:find`
 * also *rejects* filter params, so routing a filtered query there would be a
 * 400 rather than a silently unfiltered result.
 */
export function isSearchQuery(query: UsersQuery): boolean {
  return Boolean(query.search) || Boolean(query.role);
}
