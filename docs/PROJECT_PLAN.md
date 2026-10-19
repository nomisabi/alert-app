# Alert App: Project Plan

Last updated: 2026-10-19 (end of Phase 0 setup)

This document holds everything we have decided so far, and why. The full discussion is in
[docs/claude-conversations/](claude-conversations/).

## Product brief (from the PM)

> We want users to be able to set up alerts so they get notified when
> something important happens in the world — like breaking news, market
> movements, natural disasters, that kind of thing. Should work for both email
> and Slack. Make it flexible enough that we can add more channels later.
> We need an admin view too.

The PM was not available for questions, so the decisions below are ours.
**Everything is designed to be easy to change** if the product team wants something different:

- Sources and channels are adapters behind interfaces (`NewsSourceAdapter`, `NotificationChannel`, `EmailProvider`).
- Categories, sources and frequencies live in the database or config, not hard-coded in the UI.
- The frontend loads option lists from the API (e.g. `GET /categories`), so new options need no frontend release.

## How we work

- The developer is a frontend developer who is new to backend work. Backend concepts are explained as they come up.
- **One step at a time.** Each step is checked by the developer before the next one starts.
- The developer makes all commits. Claude does not commit.
- Project rules for every Claude session are in [CLAUDE.md](../CLAUDE.md).
- Each phase's conversation is saved in [docs/claude-conversations/](claude-conversations/).

---

## Product decisions

### Data source: news with categories

**We start with one source: [NewsData.io](https://newsdata.io)** (free tier). We add others later, if this one
works and we like the results.

Free news APIs we compared (October 2026; third-party sources disagreed on some numbers, so
**verify the provider's own pricing page before launch**):

| API               | Free limit                         | Categories              | Delay on free | Commercial use on free | Verdict                                        |
| ----------------- | ---------------------------------- | ----------------------- | ------------- | ---------------------- | ---------------------------------------------- |
| **NewsData.io**   | ~200 credits/day, 10 articles each | ✅ + country, language  | up to ~12h    | ✅ reportedly allowed  | **Chosen.** Snippets only, broad coverage      |
| Currents API      | ~250–600 req/day                   | ✅                      | low           | ✅ generally allowed   | Second candidate. Smaller company, uneven data |
| GNews             | 100 req/day, 10 articles each      | ✅                      | 12h           | ❌ dev only            | Good docs, but blocks a real launch            |
| NewsAPI.org       | 100 req/day                        | ✅ (top headlines only) | 24h           | ❌ dev only            | Production starts at $449/month                |
| TheNewsAPI        | 100 req/day, 3 articles each       | ✅                      | –             | unclear                | Too small                                      |
| Guardian Open Pl. | free key, daily cap                | sections                | none          | non-commercial         | One publisher only, but full text              |

- **No free tier gives true "breaking news" speed** (delays of up to 12–24h). Moving to a paid plan
  should only mean changing an API key, not code.
- **Every source is an adapter** (`NewsSourceAdapter.fetchLatest(since)`) that converts provider data into one
  `NormalizedArticle` type (externalId, sourceId, title, description, url, imageUrl, publishedAt, categories,
  language, country). Adding a source = one adapter + one category mapping.
- **We use our own category list** (`AppCategory` in `@alert-app/shared`), and each provider's categories are
  mapped to it (e.g. NewsData's `top` → `world`). Users never see provider-specific names.
  Starting list: world, business, technology, science, health, sports, environment.
- Articles are **de-duplicated by URL**, because sources overlap.

### Alert rules

- A rule has: name, **categories**, **keywords** (matched against title and description), optional language,
  channels, frequency and enabled. Later maybe: `matchMode` (any/all keywords).
- **Our backend does the matching, not the news API.** We fetch the latest articles per category on a schedule
  and match all rules in our own database. API usage then depends only on how many categories we poll,
  not on the number of users or rules. Example: 7 categories × 24 polls/day = **168 requests**, which fits
  NewsData.io's ~200/day.

### Frequency

- **Fetching** is global, set per source by the admin (e.g. every 60 minutes). The free quota limits this.
- **Delivery** is chosen per rule by the user:
  - `instant`: sent as soon as a matching article is fetched
  - `hourly`: one digest message per hour
  - `daily`: one digest at a time the user picks, in their time zone
- Matches for digests are stored in a pending table and sent by a scheduled job. Adding "weekly" later is small.

### Notification channels

- **Email** and **Slack** first. Every channel implements `NotificationChannel`
  (`type`, `validateConfig()`, `send()`), so Teams, SMS or webhooks are one new class each.
- **Email provider: Resend.**
  - SendGrid (used by the developer before) **retired its permanent free plan in 2025**: only a 60-day trial,
    then from $19.95/month.
  - Resend has a free tier (3,000 emails/month, 100/day at last check; verify) and **React Email**, so templates
    are written as React components.
  - It sits behind an `EmailProvider` interface, so switching to SendGrid, Mailgun or SES is one small class.
- **Slack: not decided yet.** Incoming webhooks (user pastes a URL, very easy) are probably enough.
  A Slack app with OAuth is nicer but more work. **Research and decide when we implement Phase 5.**

### Admin

- **Users:** list and search, enable/disable, change role (user/admin), see a user's rules.
- **Alert rules:** see all rules from all users, turn any rule on or off.
- **Sources:** enable/disable, set poll interval, see last fetch, error count and quota used today.
  API keys stay in backend environment variables. The UI only shows whether a key is configured.
- Optional: notification log (sent/failed, retry button), category mapping editor.

### Auth

- **Email and password** for now: sign up, log in, log out, **email verification**, **password reset**.
- Library: **Better Auth** (TypeScript, self-hosted, Prisma support). Passwords hashed (argon2/bcrypt),
  sessions in **httpOnly cookies** (safer than tokens in localStorage).
- Google login or 2FA can be added later through configuration.

### UI language

- **English only for now.** i18next is set up from the start (all text through `t()`), so adding a language
  later means adding one translation folder and one date-fns locale.

### Screens (first draft)

- **User:** login/sign-up, dashboard (my alerts + recent notifications), create/edit alert (category → filters →
  channels), channels (connect email/Slack, "send test message"), settings (language, profile, time zone).
- **Admin:** users, all alert rules, notification log, data source status.

---

## Architecture

```
┌─────────────┐     REST/JSON     ┌──────────────────┐
│ React app   │ ◄───────────────► │   Backend API    │
│ (user+admin)│                   │  (auth, CRUD)    │
└─────────────┘                   └────────┬─────────┘
                                           │
                                     ┌─────▼─────┐
                                     │ PostgreSQL│
                                     └─────▲─────┘
                                           │
┌─────────────────┐  events   ┌────────────┴─────┐   jobs   ┌────────────────────┐
│ Ingestion worker│ ────────► │  Rule matcher    │ ───────► │ Notification worker│
│ (polls APIs)    │           │ (event → users)  │  (queue) │  ├─ EmailChannel   │
└─────────────────┘           └──────────────────┘          │  ├─ SlackChannel   │
                                                            │  └─ (future…)      │
                                                            └────────────────────┘
```

1. **API:** login, CRUD for alert rules and channels, admin endpoints.
2. **Ingestion:** scheduled jobs pull from news sources and store normalized articles.
3. **Matcher:** checks new articles against all rules and creates notification jobs.
4. **Notifier:** sends through the right channel, with retries and logging.

### Background jobs: BullMQ + Redis

Why not `setInterval` or a simple cron: scheduled work would be lost on restart, there are no retries,
and with two backend instances every job would run twice.

| Piece             | What it is                                                   |
| ----------------- | ------------------------------------------------------------ |
| **Redis**         | Fast in-memory database. Here it only stores the queues      |
| **BullMQ**        | Node.js library that implements queues on top of Redis       |
| **Queue**         | A named list of jobs (`ingest`, `match`, `notify`, `digest`) |
| **Job**           | One task with data, e.g. `{ ruleId, articleId, channel }`    |
| **Worker**        | Code that takes jobs from a queue and runs them              |
| **Job Scheduler** | Creates a job automatically every N minutes or on a cron     |

BullMQ gives us: retries with backoff, jobs that survive restarts, concurrency control, no double runs,
delayed jobs (daily digest at 08:00) and a dashboard (Bull Board). In NestJS: `@nestjs/bullmq`
(`@Processor` + `WorkerHost`). The admin "poll interval" setting maps to `queue.upsertJobScheduler()`.

```
[Scheduler: every N min per source]
  → ingest queue  → IngestWorker: fetch → normalize → save new articles
  → match queue   → MatchWorker: find matching rules
      ├─ instant        → notify queue → NotifyWorker: send via channel (with retries)
      └─ hourly / daily → PendingNotification table
[Scheduler: every hour] → digest queue → DigestWorker → notify queue
```

Production Redis: a managed service (e.g. Upstash, Redis Cloud) or the hosting provider's.

### Draft data model

- **User**: id, email, role, locale, timezone
- **ChannelConnection**: userId, type (`email` | `slack`), config (JSON), verified
- **AlertRule**: userId, name, categories[], keywords[], language?, channelIds[], frequency, enabled
- **Source**: id, enabled, pollIntervalMinutes, lastFetchedAt, lastError
- **Article**: sourceId, externalId, url (unique), title, description, categories[], publishedAt
- **Notification**: ruleId, articleId, channelId, status (`pending` | `sent` | `failed`), attempts, error
- **PendingNotification**: for hourly/daily digests

---

## Tech stack

### Repository

- **Monorepo: one git repo** at `alert-app/` with **npm workspaces**:
  `packages/shared/`, `alert-app-frontend/`, `alert-app-backend/` (in this order, so shared builds first).
- Why: the shared package is used by both apps (separate repos would need a published npm package and
  version syncing), and one feature usually touches backend + shared + frontend in one commit/PR.
- The developer is used to one repo per app at work. **If the app is approved and the team grows, we can split
  it into separate repos later.**
- Git: branch `main`, `.gitattributes` forces LF line endings (Windows + Prettier), one root `.gitignore`.
- **Node.js >= 24.15** (`engines` in the root `package.json`). The NestJS CLI's tooling requires it.
- **TypeScript 6.0 in all projects.** TypeScript 7 is not supported yet by `typescript-eslint` (peer range `<6.1`)
  or by the NestJS CLI (`~6.0`).
- **ESLint + Prettier in all projects**, one root `.prettierrc` (single quotes, semicolons, width 100).

### Frontend

| Area         | Choice                                                              |
| ------------ | ------------------------------------------------------------------- |
| Build        | Vite 8 + TypeScript                                                 |
| UI           | React 19, MUI 9 (theme = design tokens) + SASS modules (layout)     |
| Routing      | React Router 8 (everything imports from `react-router`)             |
| Server state | TanStack Query 5                                                    |
| API client   | Orval: generates TanStack Query hooks from the OpenAPI spec (later) |
| Forms        | React Hook Form + Zod 4 (`@hookform/resolvers` 5.9)                 |
| i18n         | i18next + react-i18next (type-checked keys)                         |
| Dates        | date-fns 4 + @date-fns/tz (**mandatory**, enforced by ESLint)       |
| Tests        | Vitest 5 + React Testing Library + jsdom                            |
| Code quality | ESLint + Prettier                                                   |

**MUI + SASS, not Tailwind.** Tailwind overlaps with MUI's styling (theme/`sx` vs. utility classes), its reset
clashes with MUI's `CssBaseline`, and colors/spacing would be defined twice. Tailwind fits headless libraries
(shadcn/ui, Radix) better. How MUI and SASS work together here:

- The MUI theme (`cssVariables: true`) is the single source of truth. SASS reads it via `var(--mui-...)`.
- MUI styles go into a CSS layer (`StyledEngineProvider enableCssLayer`), so SASS modules always win.
- `styles/_mixins.scss`: `spacing(n)` and `@include up(md)` match MUI's spacing and breakpoints.

**Not now:**

- **MSW**: not needed for the setup. Reconsider when building screens before the API exists.
- **Playwright**: enough testing tools for now. Revisit later.
- **Redux / Zustand**: TanStack Query handles server state. React context covers the rest.

### Backend

| Area      | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Framework | NestJS 12 (ES modules: local imports end in `.js`)              |
| Config    | `@nestjs/config`, validated with Zod (app won't start if wrong) |
| Database  | PostgreSQL 17 + Prisma 7 (pg driver adapter)                    |
| API docs  | Swagger at `/api/docs`, OpenAPI JSON at `/api/docs-json`        |
| Tests     | Vitest (unit + e2e with supertest)                              |
| Lint      | ESLint (with type-aware rules) + Prettier                       |
| Jobs      | BullMQ + Redis 8 (Phase 4)                                      |
| Email     | Resend (Phase 4)                                                |
| Auth      | Better Auth (Phase 3)                                           |
| Local dev | Docker Compose                                                  |

Libraries are installed in the phase that uses them, not before.

### Shared package (`@alert-app/shared`)

- Domain types, Zod schemas and constants used by both apps. No React, NestJS or Node-only code.
- Built with `tsc` to `dist/`, because the backend cannot run TypeScript source. The root `postinstall` builds
  it. After changes: `npm run build -w @alert-app/shared` or keep `npm run dev:shared` running.

### Local development environment

- **Docker Desktop must be running** before `npm run db:up`. Otherwise you get
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
  Tip: Docker Desktop → Settings → General → "Start Docker Desktop when you sign in".
- **PostgreSQL in Docker uses host port 5433**, because a local PostgreSQL install already uses 5432.
- Redis on 6379. Backend on http://localhost:3000/api, frontend on http://localhost:5173.

### Versions to revisit

| Package               | Pinned at      | Why                                                   | Revisit when                   |
| --------------------- | -------------- | ----------------------------------------------------- | ------------------------------ |
| TypeScript            | ~6.0           | typescript-eslint and NestJS CLI don't support 7 yet  | Both support TS 7              |
| Prisma                | ^7.10 (stable) | npm `latest` was 8.0.0-rc at setup time               | Prisma 8 is released as stable |
| `@hookform/resolvers` | ^5.9           | 6.0.0 (released 2026-10-19) has conflicting peer deps | A fixed 6.x release            |

---

## Phases

| Phase                          | Goal                                                                      | Status        |
| ------------------------------ | ------------------------------------------------------------------------- | ------------- |
| 0. Setup                       | Monorepo, frontend and backend scaffolds, shared package, Docker, tooling | Done (commit) |
| 1. Data model and API contract | Prisma schema, OpenAPI endpoints, Orval                                   | **Next**      |
| 2. Frontend screens            | User screens (dashboard, alert form, channels, settings)                  | –             |
| 3. Backend basics              | Auth, CRUD for rules and channels                                         | –             |
| 4. First end-to-end flow       | NewsData.io → matcher → **email** (BullMQ, Resend)                        | –             |
| 5. Slack                       | Slack channel through `NotificationChannel`                               | –             |
| 6. Admin view                  | Users, rules, sources, notification log                                   | –             |
| 7. Production readiness        | Rate limiting, monitoring, deployment                                     | –             |

### Phase 0 setup steps

- [x] A. Monorepo root (workspaces, git config files, Prettier, Docker Compose, docs)
- [x] B. Frontend libraries and configuration
  - Vite demo removed. Layout with AppBar, Home page, 404 page, 4 tests.
- [x] C. Backend (NestJS, config, Swagger, Prisma, health check)
  - `GET /api/health` checks the database (503 when it is down). 2 unit + 2 e2e tests.
  - Removed from the Nest template: `@nestjs/mau` (paid hosting), its own `.prettierrc`, `vite-tsconfig-paths`.
  - Replaced the template's oxlint with ESLint, so all projects use the same tool. The backend also enables
    type-aware rules (e.g. `no-floating-promises` catches a forgotten `await`).
  - Removed the AI agent skill folders that `prisma init` creates (`.claude/`, `.agents/`, `.windsurf/`).
- [x] D. Shared package (`@alert-app/shared`)
- [x] E. Review
  - Fixes: frontend README, `engines: node >=24.15` (developer updated Node to 24.22), backend `package.json`
    metadata, single root `.gitignore`, bell favicon, ESLint in the backend.
- [x] Conversation export to `docs/claude-conversations/`: readable version (`scripts/export-conversation.mjs`) + the developer's `/export`.
- [ ] First commit (by the developer)

### Next: Phase 1 (data model and API contract)

1. Discuss and decide the **frontend folder structure** (see open questions).
2. Finalize the category list and the data model, then write the Prisma schema and the first migration.
3. Define the API endpoints (OpenAPI via Swagger decorators) and set up Orval in the frontend.

---

## Open questions

- **Frontend folder structure: discuss before adding new folders or features.** The current structure is
  temporary:

  ```
  src/app/          app-wide wiring (App, AppProviders, routes, router, queryClient)
  src/components/   shared UI components
  src/pages/        route pages
  src/theme/        MUI theme
  src/styles/       global SASS + mixins
  src/i18n/         i18next setup + translations
  src/lib/          helpers (date.ts)
  src/test/         test setup + render helpers
  ```

  Points raised so far:
  - `src/app/` feels unusual (the developer is used to everything directly in `src`) but is easy to find. Probably keep it.
  - `src/lib/` should probably be renamed to `src/utils/`, holding all utility functions.
  - Still to decide: a `features/` folder (feature-based) vs. type-based folders, and where Orval's generated hooks go.

- **Slack:** incoming webhook or Slack app (OAuth)? Decide in Phase 5 after research.
- **Final category list** and its mapping to NewsData.io categories (Phase 1).
- **Hosting and deployment** (e.g. Railway/Render/Fly.io for the backend, Vercel/Netlify for the frontend).
- **Verify before launch:** NewsData.io and Resend free-tier terms on their official pricing pages.
- Later: other alert types from the brief (market movements, natural disasters), e.g. Finnhub/Alpha Vantage
  for markets, USGS/GDACS/NASA EONET for disasters, as additional `NewsSourceAdapter`s.
