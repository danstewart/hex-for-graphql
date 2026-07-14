# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Hex is a native desktop GraphQL client built with Tauri 2 + React. It provides a Monaco-based editor with schema-aware autocomplete, schema introspection, an integrated docs browser, saved operations, and persistent state.

## Commands

```bash
npm run tauri dev      # Start Tauri app in dev mode (hot-reload)
npm run tauri build    # Build native app bundle
npm run build          # Type-check + Vite build (SPA only, no Tauri)
```

There are no tests or lint scripts configured.

## Versioning

To bump the version, edit `src-tauri/tauri.conf.json` — the `version` field there is the source of truth.

## Architecture

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand 5, Monaco Editor + monaco-graphql, Tauri 2 (Rust backend with reqwest), SQLite via tauri-plugin-sql.

### Frontend → Tauri Communication

All network calls go through Tauri's `invoke()`. The only backend command is `execute_graphql` (in `src-tauri/src/lib.rs`), which makes an HTTP POST to the GraphQL endpoint and returns the response as a JSON string. Both operation execution and schema introspection use this same command.

### State Management

Zustand store (`src/store/index.ts`) is the single source of truth. Two patterns worth knowing:

- **Signal counters** — `executeRequested` and `formatRequested` are integers that components watch with `useEffect`. Incrementing them triggers the action without boolean toggle churn.
- **Boot sequence** — `App.tsx` runs `boot()` on mount, which loads all SQLite state into Zustand before rendering.

### Persistence

SQLite (`gqled.db`) has four tables managed in `src/lib/db.ts`:
- `settings` — endpoint, headers, theme, font, layout dimensions
- `operations` — saved GraphQL operations (name, type, body)
- `editor_state` — current editor content
- `operation_variables` — per-operation JSON variables

### Schema & Completions

`src/lib/schema.ts` manages monaco-graphql integration. Completions are registered on the main thread (not the worker) via `registerCompletionProvider()` to avoid serialization issues with the Monaco worker. `refreshSchema()` fetches introspection via Tauri, builds a `GraphQLSchema` with graphql-js, and updates the completion provider. The built schema is held in a module-level variable in `schema.ts`.

### Key Files

| File | Purpose |
|------|---------|
| `src/store/index.ts` | All app state + setters |
| `src/lib/db.ts` | SQLite CRUD |
| `src/lib/graphql.ts` | Execution, introspection, cursor resolution, variable schema building |
| `src/lib/actions.ts` | `runOperation()` — orchestrates parse → save → execute flow |
| `src/lib/schema.ts` | Monaco GraphQL language service, completions, schema refresh |
| `src/lib/uiScale.ts` | Font size presets (small/medium/large) with editor px + UI zoom values |
| `src-tauri/src/lib.rs` | Tauri command handler for HTTP GraphQL requests |

### Styling

Tailwind CSS 4 with a custom Navy palette (`navy-950` through `navy-700`). Monaco editor themes are defined in `src/lib/monacoTheme.ts`.
