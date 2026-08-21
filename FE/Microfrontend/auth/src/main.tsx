import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppQueryProvider } from '@jasindo/shared';
import './index.css';
import { LoginPage } from './pages/LoginPage';

/**
 * Standalone entry point — the auth remote runs on its own at :5002.
 * AppQueryProvider is needed here too: LoginPage's login mutation runs
 * through useMutation, which requires a QueryClient somewhere up the tree.
 * Inside the host, that provider comes from the shell instead.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <LoginPage onSuccess={(user) => alert(`Signed in as ${user.name} (${user.role})`)} />
    </AppQueryProvider>
  </StrictMode>,
);
