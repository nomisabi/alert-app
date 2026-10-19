import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed port: the backend trusts this origin (CORS_ORIGIN). Fail instead of picking another port.
    port: 5174,
    strictPort: true,
    // The browser calls /api on this server, Vite forwards it to the backend.
    // Same origin for the browser, so the session cookie works without extra CORS setup.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
