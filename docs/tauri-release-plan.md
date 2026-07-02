# v0.1.0-tauri Release Plan

## Release Target

`v0.1.0-tauri` is a desktop prerelease for the high-performance KLineForge app. Package it for local desktop verification before treating it as a release candidate.

## Required Local Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run rust:fmt
npm run rust:clippy
npm run rust:test
npm run tauri:build
```

Recommended data checks:

```bash
npm run prepare:chart-dataset:100k
npm run verify:market-data
npm run verify:render -- http://127.0.0.1:4173/
npm run verify:large-chart:100k
```

For browser verification, build and start preview first:

```bash
npm run build
npm run preview -- --port 4173
```

## Packaging

Build the release binary:

```bash
npm run tauri:build
```

Build the configured bundle:

```bash
npm run tauri:bundle
```

The binary is written to:

```text
src-tauri/target/release/klineforge
```

On some rolling-release Linux hosts, AppImage bundling can fail because the external packaging toolchain may not understand newer system library sections. Use Ubuntu or CI for AppImage artifacts if local bundling fails.

## Release Evidence

Attach or preserve:

1. Full local verification command output.
2. Tauri release binary path.
3. 100k chart dataset benchmark JSON under `artifacts/performance/`.
4. Render and large-chart verification outputs when generated.
5. Notes for any external Binance access failure, including HTTP status and whether archive verification passed.

## Known First-Stage Limits

1. Drawing creation/loading/deletion covers the core annotation types; richer edit handles and undo/redo remain future work.
2. Indicator display covers Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend; 1M overlay indicators are best effort.
3. Full range-completeness cache task UI remains future work.
4. Direct Binance REST/WebSocket smoke can fail in restricted networks. Treat that as external when archive verification and local checks pass.
