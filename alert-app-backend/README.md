# Alert App: Backend

NestJS API (and later the background workers) for Alert App. See the [root README](../README.md) for the full project.

## Setup

```bash
# from the repo root
npm install                              # also generates the Prisma client
cp alert-app-backend/.env.example alert-app-backend/.env
npm run db:up                            # PostgreSQL + Redis in Docker
npm run db:migrate -w alert-app-backend  # create the tables
npm run db:seed -w alert-app-backend     # first admin, from ADMIN_* in .env
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
| `npm run db:seed`         | Create the first admin (from `ADMIN_*` in `.env`) |
| `npm run db:studio`       | Open Prisma Studio (database browser)             |
| `npm run prisma:generate` | Regenerate the Prisma client                      |

## Structure

```
src/
  main.ts            starts the server
  setup-app.ts       global prefix, CORS, error filter, Swagger (shared with e2e tests)
  app.module.ts      root module
  config/env.ts      environment variable validation (Zod)
  prisma/            PrismaService (database client), global module
  auth/              Better Auth (create-auth.ts), /api/auth/* controller, AuthGuard + AdminGuard
  admin/             admin endpoints (GET /api/admin/ping for now)
  errors/            ApiException, parseBody (Zod), global ApiExceptionFilter
  i18n/              error message translations (Accept-Language)
  health/            GET /api/health
  generated/         Prisma client (generated, not committed)
prisma/
  schema.prisma      database schema
  migrations/        SQL migrations (committed)
  seed.ts            seed script (first admin)
prisma.config.ts     Prisma CLI configuration
```

## Notes

- The project uses **ES modules**: local imports end in `.js` (e.g. `import { X } from './x.js'`), even in `.ts` files.
- Prisma 7 does not read `.env` automatically. The app reads it through `@nestjs/config`, and the CLI through `prisma.config.ts`.
- **Errors:** throw `ApiException(status, code, fieldErrors?)`. The global filter turns every error into
  `{ code, message, fieldErrors? }` with translated texts. Add the text for a new code in `src/i18n/locales/en/errors.ts`.
- **Protected endpoints:** `@UseGuards(AuthGuard)` (logged in) or `@UseGuards(AuthGuard, AdminGuard)` (admin).
