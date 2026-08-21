import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppQueryProvider } from '@jasindo/shared';
import { AppShell } from './components/AppShell';
import { RemoteBoundary } from './components/RemoteBoundary';
import { useAuth } from './hooks/useAuth';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Federated imports. Nothing here is compiled into the host bundle -- each of
// these resolves at runtime by fetching the remote's remoteEntry.js.
const RemoteDashboardPage = lazy(() => import('users_mfe/DashboardPage'));
const RemoteUsersPage = lazy(() => import('users_mfe/UsersPage'));
const RemoteLoginPage = lazy(() => import('auth_mfe/LoginPage'));

export function App() {
  return (
    <AppQueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <AppShell>
                  <RemoteBoundary name="dashboard">
                    <RemoteDashboardPage />
                  </RemoteBoundary>
                </AppShell>
              </RequireAuth>
            }
          />

          <Route
            path="/users"
            element={
              <RequireAuth>
                <AppShell>
                  <RemoteBoundary name="users">
                    <RemoteUsersPage />
                  </RemoteBoundary>
                </AppShell>
              </RequireAuth>
            }
          />

          <Route
            path="/about"
            element={
              <RequireAuth>
                <AppShell>
                  <AboutPage />
                </AppShell>
              </RequireAuth>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="*"
            element={
              <AppShell>
                <NotFoundPage />
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppQueryProvider>
  );
}

/** Login lives in its own remote; the host only decides where to go next. */
function LoginRoute() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Don't render the login form for someone who is already signed in, but
  // also don't decide that until the /me check (fired by useAuth) has
  // actually come back -- otherwise a hard refresh on /login always shows
  // the form for a flash before bouncing away.
  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-4">
      <RemoteBoundary name="auth">
        <RemoteLoginPage onSuccess={() => navigate('/dashboard', { replace: true })} />
      </RemoteBoundary>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Same reasoning as LoginRoute, mirrored: whether the cookie is still good
  // is unknown until /me answers, so a protected route must wait rather than
  // assume "no cached user yet" means "not signed in".
  if (isLoading) {
    return null;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default App;
