import { useLogout, useSession } from '@jasindo/shared';

/**
 * Thin host-side wrapper over the shared session query. `isLoading` matters
 * here specifically: on first paint the host does not yet know if the
 * HttpOnly cookie is still valid (it cannot read it), so RequireAuth must
 * wait for this to settle before deciding to redirect to /login -- otherwise
 * every hard refresh would flash the login page for a moment even for an
 * already-signed-in user.
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, isAdmin } = useSession();
  const logout = useLogout();

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    logout: () => logout.mutate(),
  };
}
