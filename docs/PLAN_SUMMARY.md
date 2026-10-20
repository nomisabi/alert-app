# Alert App: Plan Summary

Last updated: 2026-10-20 (milestone 4 done, next: milestone 5)

The short version of [PROJECT_PLAN.md](PROJECT_PLAN.md): only what is needed to build the current scope.
PROJECT_PLAN.md stays the full record (all decisions, the reasons, every finished milestone's steps). Read a section
there when you need more detail.

## Current scope

We are short on time, so the scope is cut to three milestones, in this order:

| #   | Milestone         | Goal                                                   | Status   |
| --- | ----------------- | ------------------------------------------------------ | -------- |
| 4   | Email channel     | Connect an email address, send a test message (Resend) | Done     |
| 5   | First real alerts | NewsData.io → matcher → instant email (BullMQ)         | **Next** |
| 7   | Slack             | Slack channel through `NotificationChannel`            | –        |

Done: 0 setup, 0.5 frontend foundation, 1 login, 2 admin users, 3 alert rules (all on `main`), 4 email channel
(branch `milestone-4-email-channel`).

Everything else (digests, admin rules/sources/log, email verification and password reset, production readiness,
smaller "later" items) is in the [TODO list](PROJECT_PLAN.md#todo-later). We revisit it after this scope.
**Every rule is delivered instantly** (no hourly/daily digests in this scope).

At the end of the scope, the developer asks the manager the
[questions for the manager](PROJECT_PLAN.md#questions-for-the-manager).

## How we work

- Steps for every milestone: 0 scope → 1 model → 2 API contract → 3 frontend UI (temporary sample data, no API
  calls) → 4 backend (check with curl) → 5 connect (delete sample data) → 6 tests → 7 wrap-up (`npm run format`,
  update the plans, save the conversation in `docs/claude-conversations/<n>-<name>_*`, review, commit).
- One step at a time, the developer checks each step before the next one.
- **One branch per milestone**, created from `main` when the milestone starts: `milestone-<n>-<short-name>`
  (e.g. `milestone-4-email-channel`). So every milestone's work can be looked at later. Milestones 0–3 were made on
  `main` before this rule. Commits and merges only when the developer asks.
- **New or changed decisions go into PROJECT_PLAN.md** (and this file, if they affect the current scope) in the
  same step, so the developer never has to repeat them.
- **Questions that come up while implementing** go to the end of PROJECT_PLAN.md
  ([Questions for the manager](PROJECT_PLAN.md#questions-for-the-manager)). We pick a sensible default, note it
  next to the question, and keep going.

## Decisions for the current scope

### News source (milestone 5)

- **NewsData.io** (free tier). Every source is an adapter: `NewsSourceAdapter.fetchLatest(since)` returns
  `NormalizedArticle` (externalId, sourceId, title, description, url, imageUrl, publishedAt, categories, language,
  country). Not written yet.
- Our own categories (`AppCategory`, 9: world, politics, business, technology, science, health, sports, environment,
  other). The NewsData.io mapping and `toAppCategory()` are in
  `alert-app-backend/src/news-sources/newsdata/newsdata-categories.ts` (unknown → `other`).
- **Our backend does the matching**: fetch the latest articles per category on a schedule, then match all rules in
  our database. API usage depends only on the number of categories polled.
- **Quota problem:** hourly polling of 9 categories = ~240 requests/day, above the ~200/day free limit. Choose the
  interval/order in milestone 5.
- Articles are de-duplicated by URL. No free tier is truly "breaking" (delays up to ~12h).

### Alert rules (milestones 3 and 4, used by 5/7)

- `AlertRule`: `id` (uuid v7), `userId`, `name`, `type` (`keywords | category`), `keywords String[]`,
  `category String?`, `enabled`, timestamps. Max 20 per user.
- **Keyword rules:** 1–10 keywords (phrases allowed), case-insensitive, whole words, against title + description,
  **all keywords must appear (AND)**. **Category rules:** exactly one category, every article in it matches.
- **Every rule sends to at least one of the user's channels** (`channelIds`, join table `AlertRuleChannel`,
  "Send to" checkboxes in the dialog, "Sends to" icons in the list). Milestone 5 sends matches to these channels.

### Notification channels (milestones 4 and 7)

- **Built in milestone 4** (`alert-app-backend/src/channels/`): every channel type implements `NotificationChannel`
  (`type`, `validateConfig()`, `destination()`, `send(target, message, language)`), registered in `ChannelsModule`
  under the `NOTIFICATION_CHANNELS` token. The message is channel-independent (`{ kind: 'test' }`; **milestone 5 adds
  `{ kind: 'alert', ... }`**), each channel renders its own format. `ChannelsService.assertOwnChannels()` checks ids.
- **`Channel` model:** `id`, `userId`, `type` (Postgres enum, `email`; Slack adds a value), `config` (JSON, `{}` for
  email: the address is read from `user.email` when sending), `lastTestSentAt`. Every user has exactly one email
  channel (migration for old users, Better Auth `databaseHooks.user.create.after` for new ones).
- `/channels` page (account menu) with "Send test message" (`POST /api/channels/:id/test`, 1 per minute per channel:
  429 + `Retry-After`, 502 when the provider fails). `ChannelIcon` (`global/components/`) maps a type to its icon.
- **Email: Resend** (`alert-app-backend/src/email/`), behind the `EmailProvider` abstract class. `ResendEmailProvider`
  when `RESEND_API_KEY` is set, otherwise `LogEmailProvider` (writes to the backend log). **Plain HTML templates**
  (`src/email/templates/`, `emailLayout()` + `escapeHtml()`, texts in `src/i18n/locales/en/emails.ts`; React Email is
  in the TODO). Free tier: 100/day, 3,000/month for all users together.
- **No verified domain yet** (development only): the test sender `onboarding@resend.dev` only delivers to the
  Resend account owner's email.
- Known risk for milestone 5: the sign-up hook runs after the user is saved (not in one transaction). A user without
  a channel can't save rules.
- **Slack: not decided** (incoming webhook = user pastes a URL, easy; Slack app with OAuth = nicer, more work).
  Research and decide at the start of milestone 7. With the time pressure, the simpler option is preferred.

### Background jobs (milestone 5)

- **BullMQ + Redis** via `@nestjs/bullmq` (`@Processor` + `WorkerHost`). Survives restarts, retries with backoff,
  no double runs with two instances. The poll interval maps to `queue.upsertJobScheduler()`.

```
[Scheduler: every N min per source]
  → ingest queue → IngestWorker: fetch → normalize → save new articles
  → match queue  → MatchWorker: find matching enabled rules
  → notify queue → NotifyWorker: send via the rule's channels (with retries, logged)
```

### Draft data model (remaining parts)

- **Source**: id, enabled, pollIntervalMinutes, lastFetchedAt, lastError
- **Article**: sourceId, externalId, url (unique), title, description, categories[], publishedAt
- **Notification**: ruleId, articleId, channelId, status (`pending` | `sent` | `failed`), attempts, error

## Conventions from milestones 1–4 (keep using them)

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
- Injectable "interfaces" are abstract classes (`EmailProvider`) or a token (`NOTIFICATION_CHANNELS`): TypeScript
  interfaces don't exist at runtime, so Nest can't inject them.
- Data changes for existing rows go into the migration SQL (`migrate dev --create-only`, add the SQL, then run).
- Dates with `date-fns` in the backend too.

**Frontend**

- Orval: `npm run api:generate -w alert-app-frontend` **with the backend running** after an API change. Generated
  files (`src/api/generated/`) are committed. Our hooks in `src/api/<area>/` wrap them (cache invalidation, etc.);
  pages never import from `api/generated/`.
- Reusable pieces in `global/components/`: `PageLayout`, `Loading`, `DataTable` (table from `md`, cards below,
  optional pagination), `ConfirmDialog`, `EmptyState`, `FormTextField`; `useNotify()` for messages. Create/edit in a
  dialog (full screen on phones). Server errors via `setServerErrors()` under their field or above the button.

**Tests**

- Backend: Vitest unit + e2e with supertest (`test/*.e2e-spec.ts`); test data uses a `runId` with a random part,
  test usernames stay short (max 30 characters). **e2e tests that send anything replace `EmailProvider` with a
  fake** (`overrideProvider`): `.env` holds a real Resend key.
- Frontend: fake only `orvalFetch` (a small in-memory backend, also answering `/api/channels`), so the real hooks and
  cache are tested. Fixtures in `src/test/fixtures.ts` (`testAlertRule()`, `testChannel()`, ...).
- Check that at least one or two tests really fail without the fix/feature they cover.

## Local development

- Docker Desktop must be running before `npm run db:up`. Postgres on host port **5433**, Redis on 6379.
- Backend http://localhost:3000/api (Swagger `/api/docs`), frontend http://localhost:5174 (Vite proxies `/api`).
- First admin: `npm run db:seed -w alert-app-backend` (from `ADMIN_*` in `.env`).
- Email: `RESEND_API_KEY` and `EMAIL_FROM` in `alert-app-backend/.env` (restart the backend after changing `.env`).
