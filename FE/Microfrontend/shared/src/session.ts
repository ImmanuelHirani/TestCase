import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import { ApiError, AuthResponseSchema, parseApiResponse } from './dto';
import type { AuthUser } from './dto';
import { queryKeys } from './queryKeys';

/**
 * Session state now lives entirely in the React Query cache under
 * queryKeys.session(), not in localStorage.
 *
 * That is a direct consequence of the cookie being HttpOnly: JavaScript
 * cannot read the JWT to decide "am I logged in" the way the old
 * localStorage-token version could. The only way to know is to ask the
 * server, via GET /me -- so "am I logged in" becomes a query like any other,
 * with the same loading/error/data lifecycle, instead of a synchronous
 * localStorage check.
 */

async function fetchSession(): Promise<AuthUser | null> {
  try {
    const { data } = await apiClient.get('/me');
    return parseApiResponse(AuthResponseSchema, data).user;
  } catch (err) {
    // No session is not a query failure -- it is a valid answer to "who is
    // logged in": nobody. Any other failure (network down, 500, ...) should
    // still surface as a query error so the UI can distinguish "you're
    // logged out" from "the server is unreachable".
    if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') {
      return null;
    }
    throw err;
  }
}

/**
 * Call once, high in the tree (the host shell). Every component that needs
 * to know who is logged in reads the same cached query instead of each
 * making its own /me call.
 */
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session(),
    queryFn: fetchSession,
    // The cookie's own expiry is the real staleness signal; polling /me on a
    // timer would just be guessing at that. A 401 from anywhere else in the
    // app is what actually invalidates this (see apiClient's interceptor).
    staleTime: Infinity,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: query.data != null,
    isAdmin: query.data?.role === 'admin',
  };
}

/** Mutations (login/logout) call this to update every observer at once. */
export function useSetSession() {
  const queryClient = useQueryClient();

  return (user: AuthUser | null) => {
    queryClient.setQueryData(queryKeys.session(), user);
  };
}

/**
 * Clears the cookie server-side, then the cache client-side. Order matters
 * only for correctness under a slow network: if the request fails, the UI
 * should not claim the user is signed out while the server still honours the
 * cookie -- so the cache is cleared in onSettled, not optimistically.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/logout');
    },
    onSettled: () => {
      queryClient.setQueryData(queryKeys.session(), null);
      // Nothing fetched under the old session should survive into whatever
      // account signs in next.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    },
  });
}
