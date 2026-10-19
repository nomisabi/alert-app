import { defineConfig } from 'orval';

// Generates TanStack Query hooks, request functions and types from the backend's OpenAPI spec.
// Run with the backend running: npm run api:generate (output: src/api/generated, never edit by hand).
// Docs: https://orval.dev/reference/configuration/output
export default defineConfig({
  api: {
    input: { target: 'http://localhost:3000/api/docs-json' },
    output: {
      // One folder per Swagger tag (admin/, health/), types in model/
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        // Every request goes through our fetch wrapper (language header, ApiRequestError)
        mutator: { path: 'src/global/utils/apiFetch.ts', name: 'orvalFetch' },
        // Return the response body itself, not { data, status, headers }
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
