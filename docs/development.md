# Development Guide

## Requirements

1. Node.js compatible with the project lockfile or install metadata.
2. npm.
3. Rust stable with `rustfmt` and `clippy`.
4. Linux desktop libraries required by Tauri on the host platform.
5. Chromium or system Chrome for Playwright-based verification scripts.

## Install And Run

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:1420/
```

Run the desktop shell during development:

```bash
npm run tauri:dev
```

## Required Checks

Run these before considering a change complete:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run rust:fmt
npm run rust:clippy
npm run rust:test
```

## Project Structure

```text
src/
  App.tsx                 Solid app shell and workflows
  components/             Chart pane and frontend presentation modules
  services/               Tauri command bridge, preview data and shared types
  styles/                 Application CSS
  test/                   Vitest setup

src-tauri/
  migrations/             SQLite schema
  src/bin/                Benchmark and market smoke CLIs
  src/binance.rs          Binance public REST/WebSocket access
  src/commands.rs         Tauri command handlers
  src/db.rs               SQLite access
  src/domain.rs           Domain types and validation
  src/indicators.rs       Indicator calculations and series shaping
  src/state.rs            Shared app state

scripts/
  verify-*.mjs            Browser and data verification helpers
```

## Coding Rules

1. Keep user-facing strings in the existing language resource path.
2. Frontend modules should call Tauri commands through `src/services/backend.ts`.
3. Rust owns market data, persistence, cache and indicator calculation.
4. Persisted records must have explicit schemas and validation.
5. Drawing anchors must remain time/price based, never screen coordinates as primary data.
6. Background cache and benchmark work must not block active chart interaction.
7. Do not add trading, API keys, account state, cloud sync, alerts, Pine Script import, tick storage or unsupported exchanges.

## Browser Verification

Build and serve production assets:

```bash
npm run build
npm run preview -- --port 4173
```

Then run verification scripts against the preview URL:

```bash
npm run verify:render -- http://127.0.0.1:4173/
npm run verify:indicator-instances
npm run verify:independent-chart-viewports
npm run verify:large-chart:100k
```

Large-chart scripts expect prepared datasets under `artifacts/performance/`. Generate them with:

```bash
npm run prepare:chart-dataset:100k
npm run prepare:chart-dataset:1m
```

## Data Source Notes

Direct Binance REST/WebSocket access can be blocked by network or regional policy. For large local verification, prefer Binance Public Data archive preparation commands. Unsupported archive intervals should be treated as source coverage limits, not local schema failures.

## Import Safety

Config import validates the current JSON envelope before mutating SQLite-backed app state. Failed imports must preserve existing watchlists, drawings and indicator instances.
