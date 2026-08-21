import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@jasindo/shared';
import type { UserPayload, UsersQuery } from '@jasindo/shared';
import { createUser, deleteUser, fetchStats, fetchUser, fetchUsers, updateUser } from './usersApi';

/**
 * `placeholderData: keepPreviousData` is the TanStack replacement for the old
 * hand-rolled "don't blank the table while the next page loads" logic: on a
 * page/filter/sort change it keeps rendering the previous page's rows (and
 * reports `isPlaceholderData: true`) instead of clearing to a loading state,
 * so pagination reads as a smooth swap rather than a flash-to-empty.
 */
export function useUsersQuery(query: UsersQuery) {
  return useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: ({ signal }) => fetchUsers(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: ({ signal }) => fetchStats(signal),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserPayload) => createUser(payload),
    onSuccess: () => {
      // A new row can land on any page depending on the active sort, and
      // changes the dashboard's totals -- simplest correct move is to drop
      // every cached users/stats query rather than guess which ones it touched.
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}

/**
 * Not a hook, on purpose: opening the edit dialog needs this result *before*
 * the dialog can render (the ETag has to exist before the user can type a
 * single character), which is an imperative "fetch, then act" sequence, not
 * a component subscribing to a query over its lifetime. `UsersPage` awaits
 * this directly in its onEdit handler.
 */
export function loadUserForEditing(id: string) {
  return fetchUser(id);
}

export function useUpdateUserMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // etag is optional: a null/undefined etag (fetchUser failed to return
    // one, or this is called from somewhere that never fetched one) still
    // updates -- it just skips the optimistic-concurrency check server-side.
    mutationFn: ({ payload, etag }: { payload: UserPayload; etag?: string | null }) =>
      updateUser(id, payload, etag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}
