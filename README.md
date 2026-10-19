# Alert App

Users set up alerts on news (categories and keywords) and get notified by email or Slack.

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for the full plan and decisions.

## Structure

```
alert-app/
├─ alert-app-frontend/   React + Vite app
├─ alert-app-backend/    NestJS API and background workers
├─ packages/shared/      Shared types and Zod schemas (@alert-app/shared)
├─ docs/                 Project documentation and saved Claude conversations
└─ scripts/              Repo tools (conversation export)
```

## Requirements

- Node.js 24.15+
- Docker Desktop (for PostgreSQL and Redis)

## Getting started

```bash
# 1. Install all dependencies (always from the repo root)
npm install

# 2. Create your local env files
cp .env.example .env
cp alert-app-backend/.env.example alert-app-backend/.env

# 3. Start PostgreSQL (port 5433) and Redis (port 6379)
npm run db:up

# 4. Start the backend (http://localhost:3000/api, docs at /api/docs)
npm run dev:backend

# 5. Start the frontend (http://localhost:5174)
npm run dev:frontend
```

## Scripts (from the root)

| Script                 | Description                             |
| ---------------------- | --------------------------------------- |
| `npm run dev:frontend` | Start the frontend dev server           |
| `npm run dev:backend`  | Start the backend with auto-reload      |
| `npm run dev:shared`   | Rebuild the shared package on save      |
| `npm run build`        | Build all projects                      |
| `npm run lint`         | Lint all projects                       |
| `npm run test`         | Run tests in all projects               |
| `npm run format`       | Format all files with Prettier          |
| `npm run format:check` | Check formatting without changing files |
| `npm run db:up`        | Start PostgreSQL and Redis in Docker    |
| `npm run db:down`      | Stop the Docker services                |

## Claude conversations

Each phase's conversation with Claude is saved in [docs/claude-conversations/](docs/claude-conversations/).
