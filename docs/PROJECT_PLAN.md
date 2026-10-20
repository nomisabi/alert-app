# Alert App: Project Plan

Last updated: 2026-10-20 (milestone 4 done: email channel; scope: milestones 4, 5 and 7)

This document holds everything we have decided so far, and why. The full discussion is in
[docs/claude-conversations/](claude-conversations/). The short version for the current scope is
[PLAN_SUMMARY.md](PLAN_SUMMARY.md) (loaded into every Claude session).

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
- The developer makes all commits. Claude does not commit unless asked.
- **One branch per milestone** (decided 2026-10-20), created from `main` when the milestone starts:
  `milestone-<n>-<short-name>` (e.g. `milestone-4-email-channel`), so every milestone's work can be looked at later.
  Milestones 0–3 were made on `main` before this rule.
- **New or changed decisions are written into this plan** (and [PLAN_SUMMARY.md](PLAN_SUMMARY.md) if they affect
  the current scope) in the same step, so they never have to be repeated.
- **Questions that come up while implementing** go to [Questions for the manager](#questions-for-the-manager) at the
  end of this plan, with the default we picked meanwhile. The developer asks the manager at the end of the scope.
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
  Final list (milestone 3): world, politics, business, technology, science, health, sports, environment, other
  (other = every provider category we don't map elsewhere).
- Articles are **de-duplicated by URL**, because sources overlap.

### Alert rules

- A rule has: name, **keywords** (matched against title and description) **or one category** (decided in
  milestone 3), channels, frequency and enabled. Later maybe: optional language, `matchMode` (any/all keywords),
  keywords and category together.
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
- **Current scope: `instant` only.** Hourly and daily digests (milestone 6) are in the [TODO list](#todo-later).

### Notification channels

- **Email** and **Slack** first. Every channel implements `NotificationChannel`
  (`type`, `validateConfig()`, `send()`), so Teams, SMS or webhooks are one new class each.
- **Email provider: Resend.**
  - SendGrid (used by the developer before) **retired its permanent free plan in 2025**: only a 60-day trial,
    then from $19.95/month.
  - Resend has a free tier (3,000 emails/month, 100/day at last check; verify) and **React Email**, so templates
    are written as React components. **Milestone 4 uses plain HTML** because of the time (React Email is in the TODO).
  - Without a verified domain, Resend only delivers to the Resend account owner's email (fine for development).
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
- Git: branch `main` + one branch per milestone (see [How we work](#how-we-work)), `.gitattributes` forces LF line endings (Windows + Prettier), one root `.gitignore`.
- **Node.js >= 24.15** (`engines` in the root `package.json`). The NestJS CLI's tooling requires it.
- **TypeScript 6.0 in all projects.** TypeScript 7 is not supported yet by `typescript-eslint` (peer range `<6.1`)
  or by the NestJS CLI (`~6.0`).
- **ESLint + Prettier in all projects**, one root `.prettierrc` (single quotes, semicolons, width 100).

### Frontend

| Area         | Choice                                                          |
| ------------ | --------------------------------------------------------------- |
| Build        | Vite 8 + TypeScript                                             |
| UI           | React 19, MUI 9 (theme = design tokens) + SASS modules (layout) |
| Routing      | React Router 8 (everything imports from `react-router`)         |
| Server state | TanStack Query 5                                                |
| API client   | Orval 8: generates TanStack Query hooks from the OpenAPI spec   |
| Forms        | React Hook Form + Zod 4 (`@hookform/resolvers` 5.9)             |
| i18n         | i18next + react-i18next (type-checked keys)                     |
| Dates        | date-fns 4 + @date-fns/tz (**mandatory**, enforced by ESLint)   |
| Tests        | Vitest 5 + React Testing Library + jsdom                        |
| Code quality | ESLint + Prettier                                               |

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
    components/     AppLayout, Loading, PageLayout, DataTable, ConfirmDialog, ...
    hooks/          useNotify, ...
    utils/          date.ts, apiFetch.ts, authApi.ts, ...
  pages/          one folder per page: components only
    Login/
      LoginPage.tsx       the page itself
      LoginForm.tsx       smaller parts used only by this page (flat, no subfolders)
      LoginPage.test.tsx
    admin/          admin pages grouped in one folder (Users/, Rules/, ...)
  api/            TanStack Query hooks, one file per query/mutation, one folder per area
    auth/           useSession, useSignOut (not tied to one page)
    login/          useSignIn
    sign-up/        useSignUp, useCheckUsername
    admin/          useAdminUsers, useUpdateAdminUser
    generated/      Orval output, never edited by hand
  types/          types/interfaces of the pages, same areas as api/ (admin/users.ts, login/loginForm.ts, ...)
  utils/          page helpers (functions), same areas (admin/userColumns.tsx, ...). Helpers used in 2+ places: global/utils/
  i18n/           i18next setup + translations (one file per area: common.json, auth.json, ...)
  theme/          MUI theme
  styles/         global SASS + mixins
  test/           test setup + render helpers
```

- **Rule:** components used by one page live in that page's folder. As soon as a second place uses one, it moves to
  `global/`.
- **No data fetching in components** (decided in milestone 2): every `useQuery`/`useMutation` is a hook in
  `api/<area>/` (kebab-case folders), one file each. The hook does the data work (request, cache invalidation),
  the component does the UI work (messages, navigation, closing dialogs) through `mutate(values, { onSuccess })` or
  `await mutateAsync()`.
- **Page types and helpers are not inside `.tsx` page files:** they go to `types/<area>/` and
  `utils/<area>/` (e.g. the table columns builder). Small global components keep their props interface in the component file (easier to read).
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

**Scope cut (2026-10-20):** we are running out of time, so the current scope is **milestones 4, 5 and 7** (in this
order). Milestones 6, 8, 9 and 10 moved to the [TODO list](#todo-later), to revisit after this scope. The numbers
stay the same, so older notes still match.

| #   | Milestone                    | Goal                                                                                     | Status        |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| 0   | Setup                        | Monorepo, frontend and backend scaffolds, shared package, Docker, tooling                | Done (commit) |
| 0.5 | Frontend foundation          | Folder structure, error/404/home pages, loading, page layout, notifications              | Done (commit) |
| 1   | Login                        | Sign up, log in, log out, protected routes, user role (Better Auth). Form field wrappers | Done (commit) |
| 2   | Admin: users                 | List users, enable/disable, change role                                                  | Done (commit) |
| 3   | Alert rules                  | Create, edit, delete, list own rules. Final category list + NewsData.io mapping          | Done (commit) |
| 4   | Email channel                | Connect an email address, send a test message (Resend)                                   | Done (branch) |
| 5   | First real alerts            | NewsData.io → matcher → instant email (BullMQ)                                           | **Next**      |
| 7   | Slack                        | Slack channel through `NotificationChannel`                                              | In scope      |
| 6   | Digests                      | Hourly and daily delivery, time zone setting                                             | TODO          |
| 8   | Admin: rules, sources, log   | All rules, source status and settings, notification log                                  | TODO          |
| 9   | Email verification and reset | Email verification, password reset                                                       | TODO          |
| 10  | Production readiness         | Rate limiting, monitoring, hosting, deployment                                           | TODO          |

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

### Milestone 2 steps (admin: users)

**Scope: included**

- **Users page** `/admin/users` (admins only). The `/admin` placeholder leads to it.
- **Table:** display name, username, email, role, status (active/disabled), created date, actions menu.
  Newest users first (fixed order).
- **Search** in username and email (case-insensitive, "contains", server-side, debounced), max 30 characters.
- **Pagination** on the server (20 per page).
- **Change role** (user ↔ admin). Takes effect on the user's next request.
- **Disable / enable** a user. Disabling deletes their sessions (logged out at once) and blocks login
  ("Your account has been disabled"). Disabling asks for confirmation (**ConfirmDialog**, moved here from milestone 3).
- **Safety:** an admin can't disable themselves or remove their own admin role (backend check + hidden in the UI).
  So there is always at least one admin.
- **Responsive:** table on tablet/desktop, card list on mobile. Loading, error and empty states.
- **Orval** set up now: TanStack Query hooks generated from our OpenAPI spec (`src/api/generated/`).
- **Table component:** plain MUI `Table` + `TablePagination` in a small `DataTable` wrapper (not MUI X DataGrid:
  heavier and hard to adapt to mobile).
- **Disable = Better Auth's `admin` plugin "ban".** The plugin adds the `banned` field and blocks login for banned
  users. Our own endpoint saves role/`banned` and deletes the sessions in one Prisma transaction (see step 4). The
  plugin's own `/api/auth/admin/*` URLs are switched off. The user list is our own Prisma query (the plugin can only
  search one field at a time).
- **One update endpoint** (`PATCH /api/admin/users/:id`) for role and disabled, not one endpoint per action.

**Scope: left out**

- Filters (role, status), sorting, search/page in the URL. Add later if asked.
- A user's alert rules (milestone 8, rules exist from milestone 3).
- Create, delete or edit users, reset passwords, impersonation, ban reason/end date, bulk actions.

**Steps**

- [x] 0. Scope
- [x] 1. Model: admin plugin fields in `schema.prisma`: `User.banned` (default `false`), `banReason`, `banExpires`,
      `Session.impersonatedBy`. Migration runs in step 4.
  - The plugin reads and writes all of these, so they must exist even though we only use `banned`.
  - `role` stays our Prisma enum. The plugin stores it as a string, which works with a Postgres enum as long as only
    `user`/`admin` are written (our update endpoint only accepts these).
  - No search index: `ILIKE '%text%'` can't use a normal index, and the users table is small.
- [x] 2. API contract. Schemas: `packages/shared/src/schemas/admin-users.ts` + `schemas/pagination.ts`, constants:
      `constants/admin-users.ts` + `constants/pagination.ts`. All endpoints need an admin session (401/403 as before).

  | Endpoint                                | Request                                      | Success                                             | Errors                                                                                                 |
  | --------------------------------------- | -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | `GET /api/admin/users`                  | query `search?`, `page` (1), `pageSize` (20) | 200 `{ items: AdminUser[], total, page, pageSize }` | 400 `VALIDATION_FAILED`                                                                                |
  | `PATCH /api/admin/users/:id`            | body `{ role?, disabled? }`                  | 200 `AdminUser`                                     | 400 `CANNOT_CHANGE_OWN_ROLE`, 400 `CANNOT_DISABLE_SELF`, 404 `USER_NOT_FOUND`, 400 `VALIDATION_FAILED` |
  | `POST /api/auth/sign-in/email` (change) | –                                            | –                                                   | 403 `BANNED_USER` "Your account has been disabled."                                                    |
  - `AdminUser`: `id, name, username` (as typed, = `displayUsername`), `email, role, disabled, createdAt` (ISO
    string). The API says **disabled**, not "banned": the plugin's word stays inside the backend.
  - List: newest first. A page after the last one returns `items: []` (not an error). `search` (max 30 characters)
    is trimmed and matched against username and email, empty = all users.
  - **One `PATCH` for every change** (decided with the developer): role and disabled are both "update this user", so
    one endpoint means one Orval hook and one place for the rules. `PATCH`, not `PUT`: `PUT` replaces the whole user
    (every field must be sent), `PATCH` changes only the fields in the body.
    - Only the fields in the body change. An empty body or the same values (e.g. disabling a disabled user) is not an
      error: the user is returned unchanged.
    - The backend saves what changed. `disabled: true` also deletes the user's sessions (logged out at once).
    - Changing your own role or disabling yourself → 400, even together with other fields (nothing is saved).
  - `GET /api/admin/ping` is removed in step 4 (the e2e tests use `GET /api/admin/users` for the guards instead).
  - **The shared Zod schemas are also the OpenAPI schemas.** Zod 4's `z.toJSONSchema()` turns them into Swagger
    schemas, so there are no duplicate DTO classes. Orval reads the spec and generates the frontend types and hooks.
    One source of truth: Zod → backend validation + Swagger → Orval → frontend.

- [x] 3. Frontend UI: `/admin/users` (`/admin` redirects there, placeholder page removed), `DataTable` and
      `ConfirmDialog` in `global/components/`, row actions menu, search (debounced, max 30), `admin` translations.
      Runs on temporary sample data (`pages/admin/Users/sampleUsers.ts`, deleted in step 5).
  - `DataTable`: table from `md` (900px), cards below (a 7-column table doesn't fit a phone or a portrait tablet).
    Columns say where they go in the card (`title`, `action` or a "label: value" line). Loading, error with "Try
    again", empty text, server-side pagination (1-based like the API). The previous page stays visible (dimmed)
    while the next one loads.
  - Your own row shows a "You" chip and has no actions menu.
  - Role changes happen at once (with a message); disabling asks first (`ConfirmDialog`, Cancel has the focus).
- [x] 4. Backend: migration `admin_users`, Better Auth `admin` plugin (replaces our own `role` field config),
      `AdminUsersController` + `AdminUsersService` (`src/admin/`), error texts, `GET /api/admin/ping` removed.
      Checked with curl: list, pagination, search, validation errors, 401/403, role change, unknown fields dropped,
      own role/disable (400), unknown user (404), disable → sessions gone + login `BANNED_USER`, enable → login works,
      plugin URLs closed (404).
  - **Changed during implementation: one Prisma transaction instead of the plugin's `banUser`/`setRole`.** With
    one `PATCH` that can change role and disabled together, two separate plugin calls could save one change and fail
    on the other. The transaction saves the role, `banned` and the logout (deleting sessions) together or not at
    all. The plugin is still used for its fields and for blocking login: its login check reads `banned` from the
    database, so it doesn't matter who set it.
  - **Bug found with curl:** Prisma's `contains` doesn't escape `_` and `%` (SQL `LIKE` wildcards), so searching
    `_` matched every user. `escapeLike()` in the service fixes it.
  - **OpenAPI from Zod** (`src/openapi/zod-openapi.ts`): the shared schemas are registered as OpenAPI components
    (`schemaRef('AdminUser')`), nested schemas become `$ref`s (named types in Orval), and `@ApiQueryFromZod()`
    documents query parameters. `operationId`s (`getAdminUsers`, `updateAdminUser`) are the names Orval will use.
  - The plugin's endpoints are closed in `AuthController` (any `/api/auth/admin/*` → 404), not with Better Auth's
    `disabledPaths`, which needs every path listed one by one.
- [x] 5. Connect: Orval set up, `useAdminUsers`/`useUpdateAdminUser` use the generated code, sample data deleted.
  - **Orval:** `alert-app-frontend/orval.config.ts`. Run `npm run api:generate -w alert-app-frontend` **with the
    backend running** after an API change. It reads `http://localhost:3000/api/docs-json` and writes
    `src/api/generated/` (one folder per Swagger tag + `model/` types, formatted with Prettier, skipped by ESLint).
    The generated files are committed, so the frontend builds without a running backend.
  - Every generated request goes through `orvalFetch` (in `apiFetch.ts`): same language header and `ApiRequestError`
    as our own calls. `ErrorType` in the same file makes the generated hooks' errors `ApiRequestError`.
  - Our hooks in `api/<area>/` wrap the generated code (e.g. `placeholderData`, cache invalidation with
    `getGetAdminUsersQueryKey()`), so pages never import from `api/generated/` directly.
  - The auth endpoints stay in `authApi.ts`: Better Auth's endpoints are not in our Swagger spec.
  - Login of a disabled user needs no frontend change: the backend's message is shown above the button.
  - **Known limit:** a user who is disabled while their page is open keeps seeing it until the next session check
    (their next API call gets 401). A global "401 → back to login" handler can come later.
- [x] 6. Tests: shared 19 (+7: list query, update body), backend 20 unit (+4: `escapeLike`, self rules) + 20 e2e
      (+9 in `admin-users.e2e-spec.ts`), frontend 62 (+18: `AdminUsersPage`, `DataTable`, `ConfirmDialog`).
  - Backend e2e: list order, paging and total, search (any case, username and email, `_` not a wildcard),
    validation errors, 401/403, role change with unknown fields dropped, disable → logged out + `BANNED_USER` →
    enable → login works, own role/disable rejected and nothing saved, 404/400, plugin URLs closed. The lists are
    filtered by the run's id, because the database may hold other users.
  - Frontend page tests fake only `orvalFetch` (`vi.mock` with the real module otherwise), so the generated hooks,
    our hooks and the query cache are tested too. jsdom has no screen size, so pages render the card layout;
    `DataTable.test.tsx` stubs `matchMedia` for the table layout.
  - Checked that two tests really catch bugs: the `_` search test fails without `escapeLike`, and the "reloads the
    list" test fails without the cache invalidation.
- [x] 7. Wrap-up: `npm run format`, plan updated, conversation saved in `docs/claude-conversations/2-admin-users_*`, review by the developer, commit (asked for by the developer).

### Milestone 3 steps (alert rules)

**Scope: included**

- **Final category list (9):** world, politics, business, technology, science, health, sports, environment, other.
  Mapped to NewsData.io (17 categories, up to 5 per request):

  | Our category | NewsData.io                                                                    |
  | ------------ | ------------------------------------------------------------------------------ |
  | world        | `world`, `top`                                                                 |
  | politics     | `politics`, `domestic`                                                         |
  | business     | `business`                                                                     |
  | technology   | `technology`                                                                   |
  | science      | `science`                                                                      |
  | health       | `health`                                                                       |
  | sports       | `sports`                                                                       |
  | environment  | `environment`                                                                  |
  | other        | `crime`, `education`, `entertainment`, `food`, `lifestyle`, `tourism`, `other` |
  - **"Other" catches every NewsData.io category not mapped above** (decided with the developer), so no news is lost.
  - Quota: the 8 main categories need one request each, "other" needs 2 (7 NewsData categories, max 5 per request).
    Hourly polling = 10 × 24 = **240 requests/day, above the ~200/day free limit.** Accepted for now: when the
    quota runs out, we simply get less data that day. Polling details (interval, order) are decided in milestone 5.
  - The mapping lives in a backend file now and is used by the NewsData adapter in milestone 5.
    `GET /api/categories` returns the list, so the frontend loads it from the API.

- **A rule is keyword-based or category-based** (decided with the developer, can change later):
  - **Keywords:** 1–10 keywords, each 2–50 characters, matched case-insensitively as whole words against title and
    description of all fetched articles. **All keywords must appear (AND).** OR (`matchMode`) can be added later if
    the product team asks.
  - **Category:** exactly one category, matches every article in it.
  - Every rule also has a **name** and **enabled** (on/off).
- **Page:** `/alerts` (own rules: name, keywords or category, on/off switch, edit, delete; table on desktop, cards
  on mobile). **Create and edit in a dialog** (decided with the developer in step 3; full screen on phones).
- Delete asks first (`ConfirmDialog`). New `EmptyState` component in `global/`. "My alerts" link in the AppBar.
- **Ownership:** users only see and change their own rules. Another user's rule → 404 (403 would reveal it exists).
- Max **20 rules per user** (no pagination needed).
- **API:** `GET /api/categories`, `GET`/`POST /api/alert-rules`, `GET`/`PATCH`/`DELETE /api/alert-rules/:id`.

**Scope: left out**

- Channels (milestones 4/7: the form gets a channel picker then). Frequency (milestone 6: every rule is "instant"
  until then). Language filter (milestone 5: depends on what we fetch). Matching (milestone 5). `matchMode`
  (any/all keywords), keywords + category together (later). Admin view of all rules (milestone 8).

**Steps**

- [x] 0. Scope
- [x] 1. Model: `AlertRule` (`id` uuid v7, `userId`, `name`, `type` enum `keywords | category`, `keywords String[]`,
      `category String?`, `enabled`, timestamps), `User.alertRules`. Migration runs in step 4.
  - `type` says which field is used, so the matcher, list and form switch on it.
  - Keywords as a Postgres array (`text[]`), not a separate table: always read/saved with the rule, max 10.
  - `category` is text checked by the shared Zod schema, not a Postgres enum: the list changes, and removing an enum
    value in Postgres is painful.
  - uuid v7 ids: not guessable in URLs, and sorted by creation time (index-friendly).
  - Limits (name/keyword length, 20 rules per user) and "only the field matching `type`" are checked in Zod and the
    service, not in the database (Prisma has no `CHECK` constraints in the schema).
- [x] 2. API contract. Schemas: `packages/shared/src/schemas/alert-rules.ts` + `schemas/categories.ts`, constants:
      `constants/alert-rules.ts` + `constants/categories.ts` (now 9 categories). All endpoints need a login (401).

  | Endpoint                      | Request                       | Success                                    | Errors                                                  |
  | ----------------------------- | ----------------------------- | ------------------------------------------ | ------------------------------------------------------- |
  | `GET /api/categories`         | –                             | 200 `{ items: [{ id }] }`, display order   | –                                                       |
  | `GET /api/alert-rules`        | –                             | 200 `{ items: AlertRule[] }`, newest first | –                                                       |
  | `GET /api/alert-rules/:id`    | –                             | 200 `AlertRule`                            | 404 `ALERT_RULE_NOT_FOUND`                              |
  | `POST /api/alert-rules`       | body `CreateAlertRuleRequest` | 201 `AlertRule`                            | 400 `VALIDATION_FAILED`, 400 `ALERT_RULE_LIMIT_REACHED` |
  | `PATCH /api/alert-rules/:id`  | body `UpdateAlertRuleRequest` | 200 `AlertRule`                            | 400 `VALIDATION_FAILED`, 404 `ALERT_RULE_NOT_FOUND`     |
  | `DELETE /api/alert-rules/:id` | –                             | 204 (no body)                              | 404 `ALERT_RULE_NOT_FOUND`                              |
  - `AlertRule`: `id, name, type, keywords` (`[]` for category rules), `category` (`null` for keyword rules),
    `enabled, createdAt, updatedAt` (ISO strings). Flat, like the database row.
  - **Another user's rule, an unknown id and a malformed id all give the same 404.**
  - `GET /api/categories` returns ids only (the frontend translates them) and **needs a login** (decided with the
    developer). Objects (`{ id }`), so fields can be added later without breaking the API.
  - Create body is a **discriminated union** on `type`: `{ type: 'keywords', name, keywords, enabled? }` or
    `{ type: 'category', name, category, enabled? }`. Unknown fields (e.g. `keywords` on a category rule) are dropped.
    The create/edit form uses the same schema.
  - **One `PATCH`** (like milestone 2), all fields optional: the switch sends `{ enabled }`, the edit form sends
    everything. `type` requires its field; the backend clears the other one. `keywords`/`category` without `type` → 400.
  - Rules: name required, trimmed, max 60. Keywords 1–10, no duplicates (ignoring case), each trimmed, 2–50
    characters, **phrases with spaces allowed** ("electric car", matched as a whole). Category: one of the 9.
    Single-keyword errors are reported on the `keywords` field (one message under the input, not `keywords.3`).
  - Validation texts in `i18n/validation.en.ts` (groups `alertRuleName`, `alertRuleType`, `keywords`, `keyword`,
    `category`). The NewsData.io mapping is backend-only (step 4).
  - OperationIds (= Orval hook names): `getCategories`, `getAlertRules`, `getAlertRule`, `createAlertRule`,
    `updateAlertRule`, `deleteAlertRule`.

- [x] 3. Frontend UI: `/alerts` (`AlertRulesPage`) with `AlertRuleDialog` (create/edit) and `KeywordsField`,
      `EmptyState` in `global/components/`, "My alerts" link in the AppBar, `alerts` translations + category names
      in `common`. Runs on temporary sample data (`pages/AlertRules/sampleAlertRules.ts`, deleted in step 5).
  - List: name, "Finds news by" (keyword chips with "All of:", or the category chip), on/off switch (saves at once,
    **only in the list**, not in the form), edit and delete as **icon buttons** with tooltips. Delete asks first.
    At 20 rules "New alert" is disabled with a hint. Empty list → `EmptyState` with "Create your first alert".
  - Dialog: name, "Find news by" (radio: keywords / category), then the chips input or the category select. Both
    values stay in the form while switching, only the selected one is sent. New alerts start switched on.
  - Keywords: MUI `Autocomplete` (`multiple` + `freeSolo`): Enter adds a chip, text not added yet is added when
    leaving the field. An **info button with a tooltip** explains how to use it (a tap opens it on touch screens).
  - Shared `alertRuleFormSchema`: the form shape (keywords + category) piped into the create schema, so the form
    checks exactly what the API checks and submits the request body.
  - Small changes to global pieces: `DataTable` pagination is optional (`pagination` prop), field error
    translation moved to `global/utils/fieldError.ts` (used by `FormTextField` and `KeywordsField`),
    `FormTextField` accepts forms whose schema changes the values' shape. The AppBar hides the "Alert App" text on
    phones (still read by screen readers) to make room for "My alerts".
- [x] 4. Backend: migration `alert_rules`, `AlertRulesController` + `AlertRulesService` (`src/alert-rules/`),
      `CategoriesController` (`src/categories/`), NewsData.io mapping (`src/news-sources/newsdata/newsdata-categories.ts`),
      error texts, OpenAPI schemas. Checked with curl: categories, empty list, create both types (trimmed, extra
      field dropped, `enabled: false` kept), validation errors (no type, short keyword, `top` as category, duplicate
      ignoring case), list newest first, get, patch `enabled`, patch keywords → category (keywords cleared), patch
      type without its field / keywords without type (400), another user's rule (404 for get/patch/delete, their
      list empty), malformed id (404), 401, delete (204, then 404), 21st rule (`ALERT_RULE_LIMIT_REACHED`).
  - Ownership: every query filters by `userId` (`findFirst({ id, userId })`, `deleteMany({ id, userId })`), so
    another user's rule is simply "not found".
  - The 20-rule limit: count + create in one transaction. Two requests at the very same moment could still both
    pass; acceptable for this limit.
  - `toAppCategory()` maps a NewsData.io category to ours; unknown ones become `other`. Used in milestone 5.
  - A category stored in the database that is no longer in our list is returned as `other`.
  - Frontend: a duplicate keyword (ignoring case) is no longer ignored silently: "“tesla” is already in the list."
    under the field (read out by screen readers). The typed text stays so it can be corrected.
  - **Bug found in the e2e tests (from milestone 2):** both test files got the same `runId` (`Date.now()`, files
    start in the same millisecond), so one file's cleanup deleted the other's admin → 5 tests failed with 401 when
    run together. `runId` now has a random part.
- [x] 5. Connect: Orval hooks regenerated (`api/generated/alert-rules/`, `api/generated/categories/`), our hooks
      `useAlertRules`, `useCreateAlertRule`, `useUpdateAlertRule`, `useDeleteAlertRule` (`api/alert-rules/`) and
      `useCategories` (`api/categories/`), sample data deleted.
  - Every change reloads the list (`invalidateQueries`). `useUpdateAlertRule` also puts the server's answer into
    the cached list first, so the on/off switch doesn't jump back while the list reloads.
  - `useCategories` returns the ids (`select`) and loads them once per visit (`staleTime: Infinity`).
  - The dialog awaits `mutateAsync`: server errors appear under their field (e.g. the limit message above the
    button), the page closes the dialog and shows the message on success.
  - The empty state only shows once the list has loaded (no flash while loading). `GET /api/alert-rules/:id`
    (`getAlertRule`) is not used by the page: the edit dialog takes the rule from the list.
- [x] 6. Tests: shared 35 (+16: create/update/form schemas, every alert rule error key has a text), backend 25
      unit (+5: NewsData.io mapping) + 33 e2e (+13 in `alert-rules.e2e-spec.ts`), frontend 79 (+17:
      `AlertRulesPage`, `EmptyState`, `DataTable` without pagination, "My alerts" link).
  - Backend e2e: login needed everywhere (401), categories in order, create both types (trimmed, other field and
    `userId` in the body dropped), validation errors, the 20-rule limit (19 rules inserted directly, then the 20th
    and 21st through the API), list only own rules newest first, a removed category returned as `other`, `PATCH`
    only the sent fields, type switch clears the other field, type without its field, delete 204 → 404,
    another user's rule 404 for get/patch/delete (same as an unknown id) and left unchanged.
  - Mapping: every NewsData.io category is mapped exactly once, every one of ours has an entry, `top` → `world`,
    unknown → `other`.
  - Frontend page tests fake `orvalFetch` with a small in-memory backend (keeps the rules, so reloads show the
    change): list (chips, category, switch), empty state, load error + "Try again", create both types (exact
    `POST` bodies, keyword added with Enter and on blur, categories from the API), form errors without a request,
    duplicate keyword message, tooltip, server error kept in the open dialog, edit with type switch (exact `PATCH`
    body), on/off switch, delete after asking (Cancel focused), "New alert" disabled at 20.
  - Checked that two tests really catch bugs: the "another user's rule" e2e test fails without the `userId`
    filter, and the duplicate keyword test fails without the duplicate check.
- [x] 7. Wrap-up: `npm run format`, plan updated, conversation saved in `docs/claude-conversations/3-alert-rules_*`, review by the developer, commit by the developer.

### Milestone 4 steps (email channel)

Branch: `milestone-4-email-channel`.

**Scope: included**

- **Channels:** a user has a list of channels (where alerts are sent): type (`email` for now), settings (the
  address) and a name. Every type is a `NotificationChannel` class, so Slack (milestone 7) is one more class.
- **The email channel is the user's account email** (decided with the developer), created automatically. No form
  for other addresses. Existing users get one in the migration.
- **Page `/channels`:** list of the user's channels with a **"Send test message"** button. Loading, error, mobile
  layout. The link is in the account menu (the AppBar has no room left on phones).
- **Test message:** a short email through Resend. Max **1 per minute per channel** (429 otherwise), because the
  free tier's 100 emails/day are shared by all users.
- **Channel picker in the alert dialog:** every rule sends to **at least one channel** (decided with the
  developer). Existing rules get the user's email channel in the migration.
- **`EmailProvider` interface:** `ResendEmailProvider` when `RESEND_API_KEY` is set, otherwise `LogEmailProvider`
  (writes the email to the backend log, so tests and local work use no quota).
- **Plain HTML templates** (decided with the developer, because of the time). React Email is in the TODO list.
- **No verified domain** (development only): Resend's test sender `onboarding@resend.dev` only delivers to the
  Resend account owner's email. Other addresses get a 403 from Resend. Real delivery needs a domain (manager
  question 3).

**Scope: left out**

- Extra email addresses (need a confirmation link), renaming or deleting channels, React Email templates (TODO).
  Slack (milestone 7). Real alert emails (milestone 5). Notification log and delivery status (TODO, milestone 8).
- **Known risk:** account emails are not verified yet (milestone 9, TODO). Someone could sign up with another
  person's address, and that person would get the alerts. Acceptable for development.

**Steps**

- [x] 0. Scope
- [x] 1. Model: `Channel` (`id` uuid v7, `userId`, `type` enum `email`, `config Json` default `{}`,
      `lastTestSentAt?`, timestamps) and the join table `AlertRuleChannel` (`alertRuleId` + `channelId` as the
      primary key, index on `channelId`, cascade deletes on both sides). `User.channels`, `AlertRule.channels`.
      Migration runs in step 4.
  - **No address in the channel:** the email channel's `config` is `{}`, and sending reads `user.email`, so it is
    never out of date. Slack (milestone 7) stores its settings in `config`, checked by its own Zod schema.
  - **Explicit join table** instead of Prisma's implicit many-to-many (`_AlertRuleToChannel` with columns `A`/`B`):
    readable names, and the migration inserts rows into it.
  - `type` is a Postgres enum (types are only added, which is easy). No `name` field yet: the page shows the type
    and the address; Slack can add a label in milestone 7.
  - `lastTestSentAt` in the database for the 1-per-minute test limit (survives restarts, no Redis needed).
  - The migration also adds data: one email channel per existing user, and every existing rule linked to its
    owner's email channel (ids from `gen_random_uuid()`, v4, because Postgres 17 can't make v7). New users get
    their channel from a Better Auth hook after sign-up (step 4).
  - "At least one channel per rule" and "one email channel per user" are checked in Zod and the service.
- [x] 2. API contract. Schemas: `packages/shared/src/schemas/channels.ts` (+ `channelIds` in `schemas/alert-rules.ts`),
      constants: `constants/channels.ts` (`CHANNEL_TYPES`, `CHANNEL_TEST_COOLDOWN_SECONDS` = 60,
      `CHANNELS_PER_RULE_MAX` = 10). All endpoints need a login (401).

  | Endpoint                      | Request                                      | Success                                  | Errors                                                                          |
  | ----------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
  | `GET /api/channels`           | –                                            | 200 `{ items: Channel[] }`, oldest first | –                                                                               |
  | `POST /api/channels/:id/test` | –                                            | 204 (no body), test message sent         | 404 `CHANNEL_NOT_FOUND`, 429 `CHANNEL_TEST_TOO_SOON`, 502 `CHANNEL_TEST_FAILED` |
  | `POST /api/alert-rules`       | + `channelIds` (required)                    | `AlertRule` with `channelIds`            | + 400 `INVALID_CHANNEL` (field error on `channelIds`)                           |
  | `PATCH /api/alert-rules/:id`  | + `channelIds` (optional, replaces the list) | `AlertRule` with `channelIds`            | + 400 `INVALID_CHANNEL`                                                         |
  - `Channel`: `id, type, destination`. `destination` is what the page shows (the user's email for email), filled
    by the backend, so the frontend doesn't need to know how a type stores its settings.
  - **Test = `POST`**: it's an action with a side effect. `GET` must never send anything (browsers and proxies may
    repeat or preload `GET`s).
  - **429** says when to try again (`{{seconds}}` in the text + the standard `Retry-After` header). The time is
    saved **before** sending, so a failed send also counts: two quick clicks can't send twice, and a broken setup
    can't use up the quota.
  - **502** = a service behind us (Resend) failed. The user sees a general text, the Resend error only goes to
    the backend log. Sending happens inside the request (queues come in milestone 5).
  - `channelIds`: 1–10 ids, no duplicates (Zod, keys `channelIds.required/tooMany/duplicate`). Ids that aren't the
    user's channels (unknown, another user's, malformed) → the same 400 `INVALID_CHANNEL`. Also in the form schema.
  - Existing rules get their channel from the migration (step 4), so the API always returns at least one id for them.
  - OperationIds: `getChannels`, `sendChannelTest`. OpenAPI schemas `Channel`, `ChannelList` registered.
  - Shared tests updated for `channelIds` (37 pass). The backend and frontend don't compile until steps 3–4 add
    `channelIds` there.

- [ ] 3. Frontend UI
- [x] 3. Frontend UI: `/channels` (`ChannelsPage` + `ChannelCard`), "Channels" in the account menu, "Send to"
      checkboxes in the alert dialog (`ChannelsField`), `channels` translations. Runs on temporary sample data
      (`pages/Channels/sampleChannels.ts`, deleted in step 5).
  - Channel cards: type, address (wraps on phones), hint, "Send test message" (button name includes the channel for
    screen readers). One column on phones, two from `sm`. Loading and error ("Try again") states are in place for
    step 5. The list is never empty (every user has the email channel), so no empty state.
  - "Send to" is a checkbox group (`fieldset` + `legend`), at least one required, error read out by screen readers.
    New alerts start with every channel ticked; ids keep the channel list's order.
  - **"Sends to" column in the alerts list** (asked for by the developer): one icon per channel of the rule, in the
    channel list's order. The tooltip ("Email (you@example.com)", a tap shows it on touch screens) is also the
    icon's accessible name (`role="img"`). `ChannelIcon` in `global/components/` maps a type to its icon (used by
    the list and the channel cards). Slack gets its own `SvgIcon` in milestone 7 (MUI has no brand icons).
  - Until steps 4–5: saving an alert fails (the running backend doesn't know `channelIds` yet), one type error in
    `useUpdateAlertRule` (Orval types regenerated in step 5), 3 frontend tests that check exact request bodies
    (updated in step 6).
- [x] 4. Backend: migration `channels` (tables + data: one email channel per existing user, every existing rule
      linked to it), `ChannelsModule` (`src/channels/`: `ChannelsController`, `ChannelsService`,
      `NotificationChannel` + `EmailChannel`), `EmailModule` (`src/email/`: `EmailProvider`,
      `ResendEmailProvider`, `LogEmailProvider`, plain HTML templates), Better Auth `databaseHooks.user.create.after`
      (email channel for new users, also for the seed script), `channelIds` in `AlertRulesService`, `resend` and
      `date-fns` installed, `RESEND_API_KEY`/`EMAIL_FROM` in `.env.example`. Checked with curl: sign-up creates the
      channel, list, 401, test 204 → again 429 (`Retry-After: 60`, seconds in the text), another user's/unknown
      channel 404, rule without channels / empty / duplicates (400 `VALIDATION_FAILED`), another user's or a
      malformed channel id (400 `INVALID_CHANNEL` on `channelIds`), create with own channel (201 with `channelIds`),
      `PATCH { enabled }` keeps the channels, Swagger has `getChannels`/`sendChannelTest`.
  - **`EmailProvider` is an abstract class**, not an interface: interfaces don't exist at runtime, so Nest couldn't
    use one to find the provider. `EmailModule` picks Resend when `RESEND_API_KEY` is set, otherwise the log.
  - **`NotificationChannel`**: `type`, `validateConfig()`, `destination()` (what the page shows), `send(target,
message, language)`. The message is channel-independent (`{ kind: 'test' }`; milestone 5 adds `'alert'`), each
    channel turns it into its own format. All channels are registered under the `NOTIFICATION_CHANNELS` token.
  - **Test limit in one atomic query:** `updateMany` "set `lastTestSentAt` = now where it's empty or older than 60s".
    The database runs it as one step, so two clicks at the same moment can't both pass. 0 rows changed → 404 (not
    the user's channel) or 429 (with the seconds left).
  - Resend's SDK returns errors instead of throwing; the provider turns them into an exception. The service logs it
    and answers 502 `CHANNEL_TEST_FAILED` (details only in the log).
  - `ApiException` got a 4th argument `extras` (`values` for the message, `headers`); `HttpException` already uses
    the name `options`.
  - Email texts are translated too (`src/i18n/locales/en/emails.ts`, `translateEmail()`); values are HTML-escaped
    in the HTML version (`escapeHtml()`), so a name like `<b>Ann</b>` is shown as text.
  - The sign-up hook runs after Better Auth saved the user, not in the same transaction. If it ever failed, that
    user would have no channel (their rules couldn't be saved). Acceptable for now; noted for milestone 5.
  - Backend unit tests still pass (25). The e2e tests are updated in step 6.
- [x] 5. Connect: Orval hooks regenerated (`api/generated/channels/`, `channelIds` in the alert rule models), our
      hooks `useChannels` and `useSendChannelTest` (`api/channels/`), sample data deleted.
  - Test message: success → "Test message sent to …", error → the server's message (already translated, e.g. "…
    try again in 42 seconds."). Only the clicked card's button shows the loading state.
  - The alerts page waits for **both** lists (alerts and channels) before it shows the list, "New alert" or the
    empty state: the "Sends to" icons and the dialog need the channels. A load error in either shows the error with
    "Try again" (reloads what failed).
  - The channel list passed to the dialog is the same array on every render (`useMemo`): a new `[]` each render
    would make the dialog reset its form again and again.
- [x] 6. Tests: shared 37 (+2: `channelIds` in the create/update schemas), backend 30 unit (+5: test email
      template, error filter `extras`) + 42 e2e (+9: 6 in the new `channels.e2e-spec.ts`, 3 in
      `alert-rules.e2e-spec.ts`), frontend 85 (+6: `ChannelsPage`, alerts page channels, "Channels" menu link).
  - Fixed for `channelIds`: the alert rule e2e tests read the user's email channel and send it (`createRule()`
    adds it), the frontend fake backend answers `GET /api/channels` (`testChannel()` in `test/fixtures.ts`), and the
    expected request bodies include `channelIds`.
  - **The channel e2e tests replace `EmailProvider` with a fake** (`overrideProvider`), because `.env` may hold a
    real Resend key: no real email is sent and no quota is used. They check: login needed, one email channel after
    sign-up, test email (recipient, subject, text), 429 with `Retry-After` and the seconds, 204 again "a minute
    later" (`lastTestSentAt` moved back in the database), another user's/unknown channel 404 and unchanged, 502
    without the provider's details (and the failed send still counts).
  - Alert rule e2e: missing/empty/duplicate `channelIds`, another user's or a malformed channel id (400
    `INVALID_CHANNEL`, nothing saved, `PATCH` leaves the rule unchanged), `PATCH channelIds` replaces the list,
    `PATCH enabled` keeps it, ids come back in channel-list order.
  - Frontend: channel card (heading, address, button name with the channel), test message success and the server's
    429 text, load error + "Try again"; alerts page "Sends to" icon name, channels load error (no "New alert"), new
    alert starts ticked, unticked → "Choose at least one channel." with focus and no request.
  - Usernames in e2e tests have a 30-character limit (`e2e_<runId>_<name>`), so test user names stay short.
  - Checked that two tests really catch bugs: the "another user's channel" e2e test fails without
    `assertOwnChannels`, and the 429 test fails without the 1-minute check. Both checks were put back after.
- [x] 7. Wrap-up: `npm run format`, plans updated (this file + PLAN_SUMMARY.md), conversation saved in
      `docs/claude-conversations/4-email-channel_*`, review by the developer, commit by the developer (on
      `milestone-4-email-channel`).

---

## Open questions (ours, decided during the scope)

- **Slack:** incoming webhook or Slack app (OAuth)? Decide in milestone 7 after research. With the time pressure,
  the simpler option is preferred.
- **Polling vs. quota:** 9 categories need ~240 requests/day at hourly polling, above NewsData.io's ~200/day.
  Choose the interval/order (or a paid plan) in milestone 5.
- **Verify before launch:** NewsData.io and Resend free-tier terms on their official pricing pages.

## TODO (later)

Moved out of the current scope on 2026-10-20. Revisit after milestones 4, 5 and 7.

**Milestones**

- **6. Digests:** hourly and daily delivery, `PendingNotification` table, digest queue, time zone setting
  (see [Frequency](#frequency)).
- **8. Admin: rules, sources, log:** all users' rules (on/off), a user's rules, source status and settings
  (enable, poll interval, last fetch, errors, quota), notification log with retry (see [Admin](#admin)).
- **9. Email verification and password reset** (Better Auth).
- **10. Production readiness:** rate limiting beyond Better Auth's defaults, monitoring, hosting and deployment
  (e.g. Railway/Render/Fly.io for the backend, Vercel/Netlify for the frontend).

**Smaller items**

- Alert rules: `matchMode` (any/all keywords), keywords + category together, language filter.
- Admin users: filters (role, status), sorting, search/page in the URL.
- Global "401 → back to login" handler (a disabled user keeps seeing the open page until the next session check).
- Profile/settings page (language, profile, time zone).
- Log in with username, Google login, 2FA.
- Other alert types from the brief (market movements, natural disasters), e.g. Finnhub/Alpha Vantage for markets,
  USGS/GDACS/NASA EONET for disasters, as additional `NewsSourceAdapter`s.
- Playwright end-to-end tests. Category mapping editor for admins.
- Email: React Email templates instead of plain HTML (M4 used plain HTML because of the time). Extra email addresses
  with a confirmation link. Rename and delete channels.
- Sending to any user needs a verified Resend domain (M4 is development only, see manager question 3).

## Questions for the manager

Collected while implementing, asked by the developer **at the end of the current scope**. Each question notes the
default we use until there is an answer. It includes every point where the developer said "it can be changed later",
"if the product team asks" or "we can extend it later" (from the conversations in
[docs/claude-conversations/](claude-conversations/)).

**News data**

1. **Is NewsData.io's free tier good enough?** It has delays of up to ~12h (no real "breaking news"), snippets
   only, and with 9 categories we go above the ~200 requests/day limit, so some days have fewer articles.
   Should we pay for a plan or add more sources?
   - Default: NewsData.io free tier, fewer articles when the quota runs out. _(Planning: "we can extend it if it's
     working correctly and we like the result"; M3: "if we go above the limit, it will have fewer data")_
2. **Which other alert types matter most** (market movements, natural disasters, from the brief)?
   - Default: news with categories only. _(Planning)_

**Notifications**

3. **Is Resend's free tier enough?** It allows 100 emails/day and 3,000/month **for all users together**, and
   needs a verified domain to send to anyone other than the Resend account owner. Do we have a company domain we can
   use, and is a paid plan possible?
   - Default: free tier, sending from a verified domain if there is one. _(M4)_

**Alert rules**

4. **Should keyword rules match all keywords (AND) or any of them (OR)?** Or should users choose?
   - Default: all keywords (AND). _(M3: "later we can add OR if production decides")_
5. **Should one rule combine keywords and a category** (or several categories)?
   - Default: a rule uses keywords **or** one category. _(Planning: categories + keywords; M3: "we can update the
     implementation")_
6. **Are hourly/daily digests needed for the first release?**
   - Default: every alert is sent instantly (digests are in the TODO list). _(Planning: "a setting to choose the
     interval"; scope cut)_

**Users and admin**

7. **Is email and password enough to log in?** Or are Google login, SSO or 2FA needed?
   - Default: email and password. _(Planning: "we can add anything if needed")_
8. **Do admins need filters (role, status) and sorting in the user list?**
   - Default: search by username/email and pagination only. _(M2: "we can add later if it's asked")_

**Project**

9. **If the app is approved, will more developers join?** Then we split the monorepo into one repo per app.
   - Default: one monorepo. _(Planning: "if this app is approved, we can change later")_
