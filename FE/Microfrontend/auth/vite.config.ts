import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'auth_mfe',
      filename: 'remoteEntry.js',
      // Types are declared by hand in the host (src/types/remotes.d.ts),
      // so the DTS generator has nothing useful to add.
      dts: false,
      exposes: {
        './LoginPage': './src/pages/LoginPage.tsx',
      },
      // See TestCase/vite.config.ts for why these four are singletons.
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
  // The host loads remoteEntry.js cross-origin, so the remote must allow it.
  server: { cors: true },
  preview: { cors: true },
  build: { target: 'esnext' },
  optimizeDeps: { exclude: ['@jasindo/shared'] },
});
