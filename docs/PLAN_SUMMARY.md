# Alert App: Plan Summary

Last updated: 2026-10-20 (milestone 5 done, next: milestone 7)

The short version of [PROJECT_PLAN.md](PROJECT_PLAN.md): only what is needed to build the current scope.
PROJECT_PLAN.md stays the full record (all decisions, the reasons, every finished milestone's steps). Read a section
there when you need more detail.

## Current scope

We are short on time, so the scope is cut to three milestones, in this order:

| #   | Milestone         | Goal                                                   | Status   |
| --- | ----------------- | ------------------------------------------------------ | -------- |
| 4   | Email channel     | Connect an email address, send a test message (Resend) | Done     |
| 5   | First real alerts | NewsData.io → matcher → instant email (BullMQ)         | Done     |
| 7   | Slack             | Slack channel through `NotificationChannel`            | **Next** |

Done: 0 setup, 0.5 frontend foundation, 1 login, 2 admin users, 3 alert rules (all on `main`), 4 email channel
(branch `milestone-4-email-channel`, merged), 5 first real alerts (branch `milestone-5-first-real-alerts`).

Everything else (digests, admin rules/sources/log, email verification and password reset, production readiness,
smaller "later" items) is in the [TODO list](PROJECT_PLAN.md#todo-later); **Bull Board is its first item**. We
revisit it after this scope. **Every rule is delivered instantly** (no hourly/daily digests in this scope).

At the end of the scope, the developer asks the manager the
[questions for the manager](PROJECT_PLAN.md#questions-for-the-manager).

## How we work

- Steps for every milestone: 0 scope → 1 model → 2 API contract → 3 frontend UI (temporary sample data, no API
  calls) → 4 backend (check with curl) → 5 connect (delete sample data) → 6 tests → 7 wrap-up (`npm run format`,
  update the plans, save the conversation in `docs/claude-conversations/<n>-<name>_*`, review, commit).
- **Tests are written together with the code** (from M5 on): each part comes with its tests, step 6 only fills gaps.
- One step at a time, the developer checks each step before the next one. **Propose first, build after the OK**
  (also for models and other decisions the developer hasn't seen yet).
- Big steps are split into parts the developer can check one by one (M5: backend 4a–4d).
- **One branch per milestone**, created from `main` when the milestone starts: `milestone-<n>-<short-name>`
  (e.g. `milestone-4-email-channel`). So every milestone's work can be looked at later. Milestones 0–3 were made on
  `main` before this rule. Commits and merges only when the developer asks.
- **New or changed decisions go into PROJECT_PLAN.md** (and this file, if they affect the current scope) in the
  same step, so the developer never has to repeat them.
- **Questions that come up while implementing** go to the end of PROJECT_PLAN.md
  ([Questions for the manager](PROJECT_PLAN.md#questions-for-the-manager)). We pick a sensible default, note it
  next to the question, and keep going.

## Decisions for the current scope

### Alerts pipeline (built in milestone 5)

Details: [Milestone 5 steps](PROJECT_PLAN.md#milestone-5-steps-first-real-alerts).

```
[schedule "fetch-news", every NEWS_POLL_INTERVAL_MINUTES (120)]  or  admin "fetch now"
  → ingest (src/news-sources/): NewsDataAdapter → save new articles (unique URL) → batchId = job id
  → match  (src/matching/):     ruleMatcher() → one pending Notification per rule + channel (all its articles)
  → notify (src/notifications/): NotifyService → ChannelsService.send() → the channel (email) → sent / failed
```

- **News:** NewsData.io free tier, **English only**, every **2 hours**: 10 requests per fetch (one per category of
  ours, two for `other`) = 120 of ~200 a day. `top` is ignored, NewsData.io's `duplicate: true` articles are skipped.
  Sources implement `NewsSourceAdapter.fetchLatest()` → `NormalizedArticle`, listed under `NEWS_SOURCES` (only those
  with a key; no `NEWSDATA_API_KEY` → no fetching, a warning). The schedule lives in Redis: restarts don't fetch.
- **Matching:** enabled rules of non-disabled users, only articles saved after the rule was created. Keywords: all
  of them (AND), title or description, case and accents ignored, **whole words in the exact form** (no plurals),
  phrases = words in order with spaces/hyphens between. Category: in the article's categories.
- **Sending:** **one message per rule and fetch**, per channel. 3 attempts (30s, 60s); a **`PermanentSendError`**
  (e.g. Resend 4xx except 429) fails at once (BullMQ `UnrecoverableError`). Never sent twice. Max 2 sends/second.
- **Models:** `Article` (unique `url`, `sourceName`, `createdAt` = when we saved it), `Notification` (`batchId` +
  rule + channel unique, `status` `pending | sent | failed`, `attempts`, `error`, `sentAt`), `NotificationArticle`.
- **API:** every `AlertRule` has **`lastAlertAt`** (newest `sentAt` of its sent notifications, or `null`); the
  alerts list shows it as "Last alert" (relative time, exact date in a tooltip, `-` when never). Admin
  `POST /api/admin/news-sources/fetch` → 202 `{ batchId }` (no UI; Swagger).

### Alert rules (milestones 3 and 4)

- `AlertRule`: `id` (uuid v7), `userId`, `name`, `type` (`keywords | category`), `keywords String[]`,
  `category String?`, `enabled`, timestamps. Max 20 per user. 1–10 keywords per keyword rule, one category per
  category rule.
- **Every rule sends to at least one of the user's channels** (`channelIds`, join table `AlertRuleChannel`,
  "Send to" checkboxes in the dialog, "Sends to" icons in the list).

### Notification channels (milestones 4, 5 and 7)

- Every channel type implements `NotificationChannel` (`alert-app-backend/src/channels/`: `type`,
  `validateConfig()`, `destination()`, `send(target, message, language)`), registered in `ChannelsModule` under
  `NOTIFICATION_CHANNELS`. **Messages are channel-independent** (`ChannelMessage`): `{ kind: 'test' }` and
  `{ kind: 'alert', ruleName, articles, alertsUrl }` (M5). **Slack (M7) = one class that renders both**, and throws
  `PermanentSendError` for errors that won't go away by retrying.
- `ChannelsService.send(channelId, message, language)` sends through any channel (used by the notify worker);
  `assertOwnChannels()` checks rule channel ids.
- **`Channel` model:** `id`, `userId`, `type` (Postgres enum, `email`; Slack adds a value), `config` (JSON, `{}` for
  email: the address is read from `user.email` when sending), `lastTestSentAt`. Every user has exactly one email
  channel (migration for old users, Better Auth `databaseHooks.user.create.after` for new ones).
- `/channels` page (account menu) with "Send test message" (`POST /api/channels/:id/test`, 1 per minute per channel:
  429 + `Retry-After`, 502 when the provider fails). `ChannelIcon` (`global/components/`) maps a type to its icon.
- **Email: Resend** (`alert-app-backend/src/email/`), behind the `EmailProvider` abstract class
  (`ResendEmailProvider` with `RESEND_API_KEY`, otherwise `LogEmailProvider`). **Plain HTML templates**
  (`src/email/templates/`: `test-message.ts`, `alert.ts`; `emailLayout()` + `escapeHtml()`, texts in
  `src/i18n/locales/en/emails.ts`). Free tier: 100/day, 3,000/month for all users together.
- **No verified domain yet** (development only): the test sender only delivers to the Resend account owner's email
  (others: 403; `example.com` addresses: 422).
- Known risk: the sign-up hook runs after the user is saved (not in one transaction). A user without a channel can't
  save rules.
- **Slack: not decided** (incoming webhook = user pastes a URL, easy; Slack app with OAuth = nicer, more work).
  Research and decide at the start of milestone 7. With the time pressure, the simpler option is preferred.

## Conventions from milestones 1–5 (keep using them)

**API and backend**

- **Error format** for every endpoint: `ApiError { code, message, fieldErrors? }`
  (`packages/shared/src/types/api-error.ts`). `message` is translated by the backend (`Accept-Language`),
  `fieldErrors[].field` = form field name. Our errors go through `ApiExceptionFilter`
  (`alert-app-backend/src/errors/`), error texts in `src/i18n/locales/en/errors.ts`. `ApiException`'s 4th argument
  `extras` adds `values` for the text (`{{seconds}}`) and response `headers`.
- **One Zod schema for everything:** shared schemas in `packages/shared/src/schemas/<topic>.ts` (constants in
  `constants/`, Zod messages are i18n keys in `i18n/validation.en.ts`) → backend validation + OpenAPI
  (`src/openapi/zod-openapi.ts`, `schemaRef()`, `@ApiQueryFromZod()`, `operationId` = Orval hook name) → Orval.
  No DTO classes.
- **Ownership:** every query filters by `userId`. Another user's item, an unknown id and a malformed id all give
  the same **404**.
- **One `PATCH`** per resource for changes (only the sent fields change). uuid v7 ids. Lists that change (like
  categories) are text checked by Zod, not Postgres enums.
- Auth: Better Auth behind our own `AuthController` (`/api/auth/*`), `AuthGuard` (401), `AdminGuard` (403).
- ES modules: local imports end in `.js`. Never edit `src/generated/`.
- Injectable "interfaces" are abstract classes (`EmailProvider`) or a token (`NOTIFICATION_CHANNELS`,
  `NEWS_SOURCES`): TypeScript interfaces don't exist at runtime, so Nest can't inject them.
- Data changes for existing rows go into the migration SQL (`migrate dev --create-only`, add the SQL, then run).
- Dates with `date-fns` (and `@date-fns/tz`) in the backend too.
- **The backend must always type-check:** a type error stops `nest start --watch` (it's not just a warning). A
  contract change gets a temporary value in the backend until the real one is built.
- **Queues (BullMQ, `src/queues/`):** one module owns each queue (`registerQueue`) and exports a service with
  `enqueue()`; workers are `@Processor` classes. A queue's own `defaultJobOptions` must spread
  `DEFAULT_JOB_OPTIONS` (`@nestjs/bullmq` replaces, not merges). BullMQ 6 needs `ioredis` installed. Job ids can't
  contain `:`. Jobs are made safe to run twice (unique keys, `upsert`, job id = row id).

**Frontend**

- Orval: `npm run api:generate -w alert-app-frontend` **with the backend running** after an API change. Generated
  files (`src/api/generated/`) are committed. Our hooks in `src/api/<area>/` wrap them (cache invalidation, etc.);
  pages never import from `api/generated/`.
- Reusable pieces in `global/components/`: `PageLayout`, `Loading`, `DataTable` (table from `md`, cards below,
  optional pagination), `ConfirmDialog`, `EmptyState`, `FormTextField`; `useNotify()` for messages. Create/edit in a
  dialog (full screen on phones). Server errors via `setServerErrors()` under their field or above the button.
- Dates: `formatDate()` and `formatTimeAgo()` (`global/utils/date.ts`). Screen-reader-only text: the
  `visually-hidden` SCSS mixin.

**Tests**

- Backend: Vitest unit + e2e with supertest (`test/*.e2e-spec.ts`); test data uses a `runId` with a random part,
  test usernames stay short (max 30 characters).
- **e2e safety (`test/setup-e2e.ts`):** `NEWSDATA_API_KEY` and `RESEND_API_KEY` are emptied (no real fetches or
  emails: test articles are matched against the developer's rules too), each test file gets its own `QUEUE_PREFIX`
  (removed afterwards). Guarded by a test in `app.e2e-spec.ts`. Tests that need news override `NEWS_SOURCES`,
  tests that check emails override `EmailProvider` (`overrideProvider`). Delete the notifications your test
  articles created.
- Frontend: fake only `orvalFetch` (a small in-memory backend, also answering `/api/channels`), so the real hooks and
  cache are tested. Fixtures in `src/test/fixtures.ts` (`testAlertRule()`, `testChannel()`, ...).
- Check that at least one or two tests really fail without the fix/feature they cover.

## Local development

- Docker Desktop must be running before `npm run db:up`. Postgres on host port **5433**, Redis on 6379.
- Backend http://localhost:3000/api (Swagger `/api/docs`), frontend http://localhost:5174 (Vite proxies `/api`).
- First admin: `npm run db:seed -w alert-app-backend` (from `ADMIN_*` in `.env`).
- Email: `RESEND_API_KEY` and `EMAIL_FROM` in `alert-app-backend/.env` (restart the backend after changing `.env`).
- News: `NEWSDATA_API_KEY`, `NEWS_POLL_INTERVAL_MINUTES` (120), `REDIS_URL` in `alert-app-backend/.env`. "Fetch now"
  as an admin: `POST /api/admin/news-sources/fetch` in Swagger (costs 10 of the ~200 daily requests). Check results
  with `npm run db:studio -w alert-app-backend` (`article`, `notification`).
