# Hex for GraphQL

A desktop GraphQL client with an IDE-like editing experience.

## Features

- **Monaco editor** with GraphQL syntax highlighting, real-time validation, and schema-aware autocomplete
- **Schema introspection** — automatically fetches your API's schema to power completions and docs
- **Integrated docs browser** — browse types and fields; Cmd/Ctrl+click in the editor to navigate to a type
- **Saved operations** — operations are persisted and grouped by type in the sidebar
- **Command palette** (Cmd+P) — quickly find saved operations or search the schema
- **Variables panel** — per-operation variable storage with JSON editing
- **Multiple themes** — Noir, Graphite, Mocha (dark), and Dawn (light)
- **CORS-free requests** — GraphQL execution runs through the Tauri backend process

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform

## Setup

```bash
npm install
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The compiled app will be in `src-tauri/target/release/bundle/`.


## Tech Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS, Zustand
- **Editor** — Monaco + monaco-graphql
- **Backend** — Tauri 2 (Rust), reqwest
- **Storage** — SQLite via `@tauri-apps/plugin-sql` (saves endpoint, headers, operations, variables, theme)
