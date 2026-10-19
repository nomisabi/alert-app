# @alert-app/shared

Types, Zod schemas and constants shared by `alert-app-frontend` and `alert-app-backend`.

```ts
import { APP_CATEGORIES, appCategorySchema, type AppCategory } from '@alert-app/shared';
```

## How it works

- The source is in `src/`. Export everything public from `src/index.ts`.
- The apps import the **built** output in `dist/`, because the backend (Node.js) cannot run TypeScript source directly.
- `npm install` at the repo root builds this package automatically.

## When you change something here

Rebuild, so the apps see the change:

```bash
npm run build -w @alert-app/shared       # once
npm run dev:shared                       # or: rebuild on every save (from the root)
```

## Rules

- Only add code here that **both** apps need: domain types, Zod schemas for API payloads and forms, shared constants.
- No React, NestJS or Node-only code. This package must run in the browser and in Node.js.
- Local imports end in `.js` (ES modules), like in the backend.
