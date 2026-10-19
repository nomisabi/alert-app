# Alert App: Frontend

React app for Alert App (user screens and admin view). See the [root README](../README.md) for the full project.

## Setup

```bash
# from the repo root
npm install
npm run dev:frontend        # http://localhost:5173
```

## Scripts (run inside `alert-app-frontend/` or with `-w alert-app-frontend`)

| Script               | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the Vite dev server          |
| `npm run build`      | Type-check and build to `dist/`    |
| `npm run preview`    | Serve the production build locally |
| `npm run lint`       | Lint with ESLint                   |
| `npm run typecheck`  | Type-check without building        |
| `npm run test`       | Run tests once (Vitest)            |
| `npm run test:watch` | Run tests in watch mode            |

## Tech stack

Vite, React 19, TypeScript, MUI + SASS modules, React Router, TanStack Query, i18next,
React Hook Form + Zod, date-fns, Vitest + React Testing Library.
The reasons for each choice are in [docs/PROJECT_PLAN.md](../docs/PROJECT_PLAN.md).

## Structure

```
src/
  main.tsx          entry point
  app/              app-wide wiring (App, AppProviders, routes, router, queryClient)
  components/       shared UI components
  pages/            route pages
  theme/            MUI theme (colors, typography, spacing)
  styles/           global SASS + mixins
  i18n/             i18next setup + translations (locales/en/*.json)
  lib/              helpers (formatDate)
  test/             test setup + render helpers
```

This structure is temporary and will be decided before Phase 2 (see "Open questions" in the plan).

## Conventions

- **Styling:** colors, typography and spacing come from the MUI theme. Use `*.module.scss` for layout,
  with `spacing(n)` and `@include up(md)` from `styles/_mixins.scss`.
- **Text:** all UI text goes through `t()` from react-i18next. Keys are type-checked.
- **Dates:** always use `formatDate()` / date-fns. ESLint blocks other date libraries and `toLocaleDateString()`.
- **Tests:** use `renderWithProviders()` or `renderRoute()` from `src/test/renderWithProviders.tsx`.
