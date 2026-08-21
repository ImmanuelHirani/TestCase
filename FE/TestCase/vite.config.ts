import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';

// The host compiles none of the remotes' code. It fetches each remoteEntry.js
// over HTTP at runtime, which is what makes independent deploys possible.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'host',
      dts: false,
      remotes: {
        users_mfe: {
          type: 'module',
          name: 'users_mfe',
          entry: 'http://localhost:5001/remoteEntry.js',
        },
        auth_mfe: {
          type: 'module',
          name: 'auth_mfe',
          entry: 'http://localhost:5002/remoteEntry.js',
        },
      },
      // singleton is not optional for react/react-dom/react-router-dom: a
      // second copy means "invalid hook call", and a second router silently
      // stops navigating. The same rule applies to any library whose value
      // is shared through React context across the federation boundary:
      //   - react-query: the host's <QueryClientProvider> has to be the SAME
      //     module a remote's useQuery() looks up, or every remote falls back
      //     to "no QueryClient set" instead of sharing the host's cache.
      //   - zod: ApiError handling does `instanceof z.ZodError`; two zod
      //     module instances make that check silently false.
      //   - framer-motion: AnimatePresence coordinates exit animations
      //     through its own context, so a dialog exposed by a remote needs
      //     the same instance the host's route transitions use.
      // react-hook-form and @tanstack/react-table stay off this list: every
      // form/table owns its instance locally, nothing about them crosses the
      // federation boundary through context.
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.0.0' },
        '@tanstack/react-query': { singleton: true, requiredVersion: '^5.0.0' },
        zod: { singleton: true, requiredVersion: '^4.0.0' },
        'framer-motion': { singleton: true, requiredVersion: '^13.0.0' },
      },
    }),
  ],
  build: { target: 'esnext' },
  optimizeDeps: { exclude: ['@jasindo/shared'] },
});
