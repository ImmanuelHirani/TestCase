import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppQueryProvider } from '@jasindo/shared';
import './index.css';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';

/**
 * Standalone entry point.
 *
 * The remote is a real application in its own right: `npm run dev -w users-mfe`
 * serves it at :5001 with no host involved. Only ./DashboardPage, ./UsersPage
 * and ./UserTable are federated out; this bootstrap is never loaded by the
 * host -- which is why it wraps itself in BrowserRouter (UsersPage reads
 * useSearchParams) and AppQueryProvider (nothing above it provides a
 * QueryClient in standalone mode). Inside the host, both come from the shell.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-surface p-6">
          <div className="mx-auto max-w-5xl space-y-8">
            <p className="md-body-small rounded-xs bg-tertiary-container px-4 py-3 text-on-tertiary-container">
              Standalone mode — users microfrontend running on its own at :5001.
            </p>
            <DashboardPage />
            <UsersPage />
          </div>
        </div>
      </BrowserRouter>
    </AppQueryProvider>
  </StrictMode>,
);
