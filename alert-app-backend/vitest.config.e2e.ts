import { defineConfig } from 'vitest/config';

// End-to-end tests run against the real database (npm run db:up first)
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
  },
});
