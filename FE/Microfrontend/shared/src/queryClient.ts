import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient for the whole app -- host and every microfrontend import
 * this exact module instance (workspace symlink, and `@tanstack/react-query`
 * itself is a Module Federation singleton), so a remote's useQuery() shares
 * the host's cache instead of starting cold every time a route mounts it.
 *
 * Defaults:
 *   staleTime 30s   -- an admin table does not need per-keystroke freshness;
 *                      this is what stops a filter tweak from refetching data
 *                      that arrived a second ago.
 *   gcTime 5min      -- how long an unused query stays warm in cache after its
 *                      last observer unmounts, e.g. navigating dashboard ->
 *                      users -> dashboard reuses the dashboard's data instead
 *                      of refetching if it's still within this window.
 *   refetchOnWindowFocus true -- this is an admin dashboard; catching a
 *                      change a colleague just made is worth the extra request.
 *   retry 1          -- one silent retry for a transient blip; anything past
 *                      that surfaces to the ErrorPanel rather than spinning.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
