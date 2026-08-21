import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './queryClient';

/**
 * Wrap the host's <App> in this once. Every remote's exposed page component
 * assumes a provider already exists up the tree -- it does not render its
 * own -- so host and remote share the one cache. A remote's *standalone*
 * bootstrap (main.tsx, used only when running that remote on its own outside
 * the host) wraps itself in this same component, since nothing put a
 * provider above it in that mode.
 */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </QueryClientProvider>
  );
}
