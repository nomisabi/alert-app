# Alert App: Project Plan

Last updated: 2026-10-19 (milestone 1 done: login)

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
  A Slack app with OAuth is nicer but more work. **Research and decide when we implement milestone 7.**

### Admin

- **Users:** list and search, enable/disable, change role (user/admin), see a user's rules.
- **Alert rules:** see all rules from all users, turn any rule on or off.
- **Sources:** enable/disable, set poll interval, see last fetch, error count and quota used today.
  API keys stay in backend environment variables. The UI only shows whether a key is configured.
- Optional: notification log (sent/failed, retry button), category mapping editor.

### Auth

- **Email and password** for now: sign up, log in, log out (milestone 1), **email verification** and
  **password reset** (milestone 9).
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

#### Frontend folder structure

```
src/
  app/            app-wide wiring: App, AppProviders, routes, router, queryClient
  global/         everything used in 2 or more places
    components/     AppLayout, Loading, PageLayout, ...
    hooks/          useNotify, useSession, ...
    utils/          date.ts, ...
  pages/          one folder per page
    Login/
      LoginPage.tsx       the page itself
      LoginForm.tsx       smaller parts used only by this page (flat, no subfolders)
      LoginPage.test.tsx
    admin/          admin pages grouped in one folder (Users/, Rules/, ...)
  api/
    generated/    Orval output, never edited by hand
  i18n/           i18next setup + translations (one file per area: common.json, auth.json, ...)
  theme/          MUI theme
  styles/         global SASS + mixins
  test/           test setup + render helpers
```

- **Rule:** code used by one page lives in that page's folder. As soon as a second place uses it, it moves to
  `global/`.
- Related pages can be grouped in a folder (like `admin/`) when it helps, but this is not required.
- Tests sit next to the file they test.
- The developer prefers type-based folders (`global/` + `pages/`) to a feature-based `features/` folder.

**Not now:**

- **MSW**: not needed. The backend is built before the frontend is connected (see
  [Steps for every milestone](#steps-for-every-milestone)).
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
| Jobs      | BullMQ + Redis 8 (milestone 5)                                  |
| Email     | Resend (milestone 4)                                            |
| Auth      | Better Auth (milestone 1)                                       |
| Local dev | Docker Compose                                                  |

Libraries are installed in the phase that uses them, not before.

### Shared package (`@alert-app/shared`)

- Domain types, Zod schemas and constants used by both apps. No React, NestJS or Node-only code.
- Grouped by kind: `src/constants/`, `src/schemas/`, `src/types/`, `src/i18n/`, one file per topic inside
  (e.g. `constants/auth.ts`, `schemas/auth.ts`). Details in `packages/shared/README.md`.
- Built with `tsc` to `dist/`, because the backend cannot run TypeScript source. The root `postinstall` builds
  it. After changes: `npm run build -w @alert-app/shared` or keep `npm run dev:shared` running.

### Local development environment

- **Docker Desktop must be running** before `npm run db:up`. Otherwise you get
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
  Tip: Docker Desktop → Settings → General → "Start Docker Desktop when you sign in".
- **PostgreSQL in Docker uses host port 5433**, because a local PostgreSQL install already uses 5432.
- Redis on 6379. Backend on http://localhost:3000/api, frontend on http://localhost:5174.

### Versions to revisit

| Package               | Pinned at      | Why                                                   | Revisit when                   |
| --------------------- | -------------- | ----------------------------------------------------- | ------------------------------ |
| TypeScript            | ~6.0           | typescript-eslint and NestJS CLI don't support 7 yet  | Both support TS 7              |
| Prisma                | ^7.10 (stable) | npm `latest` was 8.0.0-rc at setup time               | Prisma 8 is released as stable |
| `@hookform/resolvers` | ^5.9           | 6.0.0 (released 2026-10-19) has conflicting peer deps | A fixed 6.x release            |

---

## Milestones

**We build in vertical slices:** one feature at a time, through every layer (model, frontend, backend, tests),
so every milestone ends with something that works and can be clicked through. Models are designed when a feature
needs them, not all up front.

The first plan was split into layers (all models, then all screens, then all backend). We dropped it because it
meant deciding too much before seeing anything work.

### Steps for every milestone

0. **Scope:** what the feature does, and what it explicitly leaves out for now.
1. **Model:** Prisma models and fields.
2. **API contract:** endpoints, request/response shapes, Zod schemas in `packages/shared`.
3. **Frontend UI:** pages, components, forms (with validation), translations, loading/error/empty states, but
   **no API calls yet**. Everything responsive (mobile first) and with basic accessibility (semantic HTML, labels,
   keyboard, focus, contrast).
4. **Backend:** modules, services, controllers, migrations.
5. **Connect:** the frontend calls the real backend. Click through the whole feature.
6. **Tests**
7. **Wrap-up:** `npm run format`, update this plan, review by the developer, commit by the developer.

A milestone is not finished until it works against the real backend. Because the backend is built before the
frontend is connected, **we don't mock the API during development** (no MSW). Frontend tests fake our own API
functions (e.g. `global/utils/authApi`) with `vi.mock`, so the real hooks and query cache are tested too.

### Milestone list

| #   | Milestone                    | Goal                                                                                     | Status        |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| 0   | Setup                        | Monorepo, frontend and backend scaffolds, shared package, Docker, tooling                | Done (commit) |
| 0.5 | Frontend foundation          | Folder structure, error/404/home pages, loading, page layout, notifications              | Done (commit) |
| 1   | Login                        | Sign up, log in, log out, protected routes, user role (Better Auth). Form field wrappers | Done (commit) |
| 2   | Admin: users                 | List users, enable/disable, change role                                                  | **Next**      |
| 3   | Alert rules                  | Create, edit, delete, list own rules. Final category list + NewsData.io mapping          | –             |
| 4   | Email channel                | Connect an email address, send a test message (Resend)                                   | –             |
| 5   | First real alerts            | NewsData.io → matcher → instant email (BullMQ)                                           | –             |
| 6   | Digests                      | Hourly and daily delivery, time zone setting                                             | –             |
| 7   | Slack                        | Slack channel through `NotificationChannel`                                              | –             |
| 8   | Admin: rules, sources, log   | All rules, source status and settings, notification log                                  | –             |
| 9   | Email verification and reset | Email verification, password reset                                                       | –             |
| 10  | Production readiness         | Rate limiting, monitoring, hosting, deployment                                           | –             |

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
- [x] First commit (by the developer)

### Milestone 0.5 steps (frontend foundation)

Not part of the setup and not a feature, but every milestone needs these pieces.

- [x] Decide the frontend folder structure (see [Frontend folder structure](#frontend-folder-structure))
- [x] A. Move the existing files to the new structure (`lib/` → `global/utils/`, `components/` →
      `global/components/`, `pages/HomePage/` → `pages/Home/`, ...)
- [x] B. Error page (React Router `errorElement`) and loading components (full page + inline)
  - Error page is attached twice: around the pages (AppBar stays) and on the root route (fallback). Error details
    only in development. 404 page stays a simple static page (no shared component).
  - `Loading` waits 300 ms before showing, so fast loads don't flash a spinner.
- [x] C. Page layout (title + optional action), Home page, 404 page polish
- [x] D. Notifications: snackbar + `useNotify()` hook
- [x] E. Tests, format, plan update, review, commit

Moved to milestone 1, where they are first needed: form field wrappers (MUI + React Hook Form) and the API
client / Orval setup. Later milestones: empty state (3), confirm dialog (3), data table (2).

### Milestone 1 steps (login)

**Scope: included**

- **Sign up** with display name, username, email, password and repeat password. "Repeat password" is checked only
  in the frontend (Zod), and only one password is sent.
- **Display name** (Better Auth's `name`): free text, not unique, shown in the AppBar.
- **Username** is a **unique** handle. Uses Better Auth's `username` plugin: uniqueness is case-insensitive, the
  original spelling is kept in `displayUsername`.
- **Log in with email** and password, **log out**. After login the user goes back to the page they asked for
  (`/login?redirectTo=...`), otherwise Home.
- **Session in an httpOnly cookie** (Better Auth). Vite proxies `/api` to the backend in development, so the
  browser sees one origin and cookies work without CORS setup.
- **Role** `user | admin`. Sign-up always creates `user`. The role can't be set through sign-up input.
- **First admin** created by a seed script (`npm run db:seed`, from `ADMIN_NAME`/`ADMIN_USERNAME`/`ADMIN_EMAIL`/
  `ADMIN_PASSWORD` in `.env`). Running it again changes nothing.
- **Frontend:** `/login` and `/signup` pages, `useSession()` (TanStack Query around Better Auth's client),
  `ProtectedRoute` and `AdminRoute`, a placeholder `/admin` page, AppBar with display name + log out.
  Form field wrappers (MUI + React Hook Form).
- **Backend:** Better Auth mounted at `/api/auth/*`, `AuthGuard` (401) and `AdminGuard` (403), and
  `GET /api/admin/ping` to prove the guards work.
- **Form validation** (rules in `packages/shared`, so the backend enforces the same ones):

  | Field           | Rules                                                                      | Checked                                       |
  | --------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
  | Display name    | required, max 50 characters, trimmed                                       | in the browser                                |
  | Username        | required, 6–30 characters, letters, numbers, `_` and `.`, trimmed          | in the browser                                |
  | Username taken  | must not exist (case-insensitive)                                          | server: when leaving the field + on submit    |
  | Email           | required, valid format, trimmed, lowercased                                | in the browser                                |
  | Email taken     | must not exist                                                             | server: on submit only, shown under the field |
  | Password        | required, 8–128 characters, at least one letter and one number             | in the browser, rules shown as hint text      |
  | Repeat password | must match the password                                                    | in the browser                                |
  | Login form      | valid email, password not empty (no password rules, they may change later) | in the browser                                |
  - Errors appear when the user leaves a field, then update while typing (React Hook Form `mode: 'onTouched'`).
  - On submit, focus moves to the first invalid field. The submit button shows a loading state while waiting.
  - Error texts are linked to their field, so screen readers read them out (MUI `helperText`).

- Error messages from Better Auth error codes, translated. Wrong login always says "Invalid email or password".

**Scope: left out**

- Email verification, password reset (milestone 9). Disabling users (milestone 2). Profile/settings, time zone
  (milestone 6). Log in with username, Google login, 2FA (later). Rate limiting beyond Better Auth's defaults
  (milestone 10).

**Steps**

- [x] 0. Scope
- [x] 1. Model: `User`, `Session`, `Account`, `Verification` (Better Auth's tables) in `schema.prisma`, plus
      `role` (enum `user | admin`) and `username`/`displayUsername` (username plugin). Migration runs in step 4.
  - `username` is stored lowercased (unique), `displayUsername` keeps the original spelling. `name` is the display name. Password hashes are in `Account`, not `User`.
  - Milestone 2: consider Better Auth's `admin` plugin (list users, set role, ban = disable).
- [x] 2. API contract. Schemas and rules: `packages/shared/src/schemas/auth.ts`, constants: `constants/auth.ts`, types: `types/` (Zod messages are
      i18n keys).

  | Endpoint                               | Body                              | Success                           | Errors (body `{ code, message }`)                                                             |
  | -------------------------------------- | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
  | `POST /api/auth/sign-up/email`         | `name, username, email, password` | 200 `{ token, user }` + cookie    | 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, 400 `USERNAME_IS_ALREADY_TAKEN`, 400 rule errors |
  | `POST /api/auth/sign-in/email`         | `email, password`                 | 200 `{ token, user }` + cookie    | 401 `INVALID_EMAIL_OR_PASSWORD`                                                               |
  | `POST /api/auth/sign-out`              | –                                 | 200 `{ success: true }`           | –                                                                                             |
  | `GET /api/auth/get-session`            | –                                 | 200 `{ session, user }` or `null` | –                                                                                             |
  | `POST /api/auth/is-username-available` | `username`                        | 200 `{ available: boolean }`      | 422 rule errors                                                                               |
  | `GET /api/admin/ping` (ours)           | –                                 | 200 `{ ok: true }`                | 401 not logged in, 403 not admin                                                              |
  - All `/api/auth/*` endpoints come from Better Auth. `POST /api/auth/sign-in/username` (username plugin) is
    switched off, because login is by email only.
  - **Error format (every endpoint, ours and Better Auth's):** `ApiError` in `packages/shared`

    ```json
    {
      "code": "USERNAME_IS_ALREADY_TAKEN",
      "message": "This username is already taken.",
      "fieldErrors": [{ "field": "username", "message": "This username is already taken." }]
    }
    ```

    - `message` is **translated by the backend**, in the language from the `Accept-Language` header (the frontend
      sends the app's language; English only for now, English is the fallback).
    - `fieldErrors` (optional): `field` is the request body field name (= the form field name), so the frontend
      shows the message under that field. Without `fieldErrors` (e.g. wrong login, server error), the form shows
      `message` above the submit button.
    - Better Auth's errors are rewritten into this format in the backend, our own errors (guards, Zod validation,
      unexpected errors) go through a global NestJS exception filter.
    - Validation texts (`validation.json`) move to `packages/shared`, so the frontend and backend use the same texts.

- [x] 3. Frontend UI: `/login`, `/signup`, `/admin` (placeholder), AppBar links, `FormTextField` (with password
      show/hide), `AuthLayout`, `auth` + `validation` translations. Submitting only shows a message for now.
- [x] 4. Backend: Better Auth 1.7 (`src/auth/create-auth.ts`), migration `auth`, seed script, `AuthGuard` +
      `AdminGuard`, `GET /api/admin/ping`, global `ApiExceptionFilter` + backend i18n (i18next), validation texts moved
      to `packages/shared`. Checked with curl: sign-up, validation errors, taken username/email, login, wrong
      password, ping (401/403/200), log out, foreign Origin (403).
  - Better Auth runs **behind our own controller** (`/api/auth/*`), not mounted directly on Express. The controller
    validates the body with the shared Zod schemas (unknown fields like `role` are dropped) and rewrites Better
    Auth's errors into `ApiError`.
  - Better Auth's CSRF protection: POST requests from an origin other than `CORS_ORIGIN` get 403 `INVALID_ORIGIN`.
  - Frontend dev server is fixed to port 5174 (`strictPort`).
- [x] 5. Connect: Vite proxy (`/api` → `:3000`), `apiFetch` + `ApiRequestError`, `authApi.ts`, `useSession()`,
      `setServerErrors()` (server errors under their field or above the button), username check on blur,
      `ProtectedRoute` (`requireAdmin` for `/admin`), AppBar `AccountMenu` (name, admin link, log out),
      `?redirectTo=` after login (only paths inside the app).
  - We call the endpoints with our own small `fetch` wrapper instead of Better Auth's client library: our backend
    has its own error format, and Orval can use the same wrapper later.
- [x] 6. Tests: shared 12 (schemas, every error key has a text), backend 16 unit (i18n, `parseBody`, exception
      filter) + 11 e2e (sign-up, validation, taken username/email, login, logout, guards, disabled endpoint, foreign
      origin), frontend 44 (sign-up and login pages, `ProtectedRoute`, AppBar incl. the logout bug, `FormTextField`,
      `apiFetch`).
  - Frontend tests mock `authApi` for every test (`src/test/setup.ts`, default: logged out), test data in
    `src/test/fixtures.ts`.
  - Found while testing: Better Auth turns its origin check off when `NODE_ENV=test`, so it's now switched on
    explicitly (`advanced.disableOriginCheck: false`). `apiFetch` no longer crashes on answers that aren't JSON.
    `mutationFn` gets the values explicitly (TanStack Query passes a second argument).
- [x] 7. Wrap-up: `npm run format`, plan updated, conversation saved in `docs/claude-conversations/1-login_*`, review and commit by the developer.

---

## Open questions

- **Slack:** incoming webhook or Slack app (OAuth)? Decide in milestone 7 after research.
- **Final category list** and its mapping to NewsData.io categories (milestone 3).
- **Hosting and deployment** (e.g. Railway/Render/Fly.io for the backend, Vercel/Netlify for the frontend).
- **Verify before launch:** NewsData.io and Resend free-tier terms on their official pricing pages.
- Later: other alert types from the brief (market movements, natural disasters), e.g. Finnhub/Alpha Vantage
  for markets, USGS/GDACS/NASA EONET for disasters, as additional `NewsSourceAdapter`s.
