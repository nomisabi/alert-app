# Alert App: Backend

NestJS API (and later the background workers) for Alert App. See the [root README](../README.md) for the full project.

## Setup

```bash
# from the repo root
npm install                              # also generates the Prisma client
cp alert-app-backend/.env.example alert-app-backend/.env
npm run db:up                            # PostgreSQL + Redis in Docker
npm run dev:backend                      # http://localhost:3000/api
```

- API docs (Swagger UI): http://localhost:3000/api/docs
- OpenAPI JSON (for Orval): http://localhost:3000/api/docs-json
- Health check: http://localhost:3000/api/health

## Scripts (run inside `alert-app-backend/` or with `-w alert-app-backend`)

| Script                    | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `npm run start:dev`       | Start with auto-reload                            |
| `npm run build`           | Generate the Prisma client and compile to `dist/` |
| `npm run lint`            | Lint with ESLint (type-aware rules)               |
| `npm run typecheck`       | Type-check without building                       |
| `npm run test`            | Unit tests (`src/**/*.spec.ts`)                   |
| `npm run test:e2e`        | End-to-end tests against the real database        |
| `npm run db:migrate`      | Create and apply a migration from the schema      |
| `npm run db:studio`       | Open Prisma Studio (database browser)             |
| `npm run prisma:generate` | Regenerate the Prisma client                      |

## Structure

```
src/
  main.ts            starts the server
  setup-app.ts       global prefix, CORS, Swagger (shared with e2e tests)
  app.module.ts      root module
  config/env.ts      environment variable validation (Zod)
  prisma/            PrismaService (database client), global module
  health/            GET /api/health
  generated/         Prisma client (generated, not committed)
prisma/
  schema.prisma      database schema
prisma.config.ts     Prisma CLI configuration
```

## Notes

- The project uses **ES modules**: local imports end in `.js` (e.g. `import { X } from './x.js'`), even in `.ts` files.
- Prisma 7 does not read `.env` automatically. The app reads it through `@nestjs/config`, and the CLI through `prisma.config.ts`.
