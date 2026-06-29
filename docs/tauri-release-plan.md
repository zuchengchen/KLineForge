# v0.1.0-tauri Release, Migration And Rollback Plan

## Release Target

`v0.1.0-tauri` is a prerelease for the Tauri/Rust performance rewrite. It should be packaged for local desktop verification before it is considered a replacement for the old Electron/Web architecture.

## Migration Notes

Old IndexedDB, localStorage and old config import compatibility are intentionally out of scope. The Tauri prerelease starts from a new SQLite database.

Users who need old IndexedDB/localStorage settings should keep using the `main` branch build. New-schema JSON import/export exists for the Tauri SQLite app, but it does not read the old config envelope.

## Packaging

Expected command:

```bash
npm run tauri:build
```

`npm run tauri:build` validates the release desktop binary with `tauri build --no-bundle`. Use this command in local verification and CI.

Full Linux bundling command:

```bash
npm run tauri:bundle
```

The configured bundle target is AppImage on Linux. On the current Arch-based development machine, the Tauri AppImage step can fail inside `linuxdeploy` because its bundled `strip` does not understand newer system libraries with `.relr.dyn` sections. The release binary still builds successfully at `src-tauri/target/release/klineforge`. Produce AppImage artifacts from an Ubuntu-based CI runner or another linuxdeploy-compatible environment until the AppImage toolchain handles these libraries.

## Rollback

Do not merge this branch into `main` until the verification section in the saved Goal file passes or the completion standard is explicitly changed.

Rollback path:

1. Switch back to `main`.
2. Use the existing Electron/Web build and docs.
3. Ignore the new SQLite app data created by the Tauri prerelease.

## Known First-Stage Degradations

1. Drawing creation/loading/deletion now covers horizontal line, trend line, vertical line, rectangle, text and measurement annotations, but drag/edit handles, style editing, lock/hide and undo/redo remain pending.
2. Indicator display now covers Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend; full per-chart parameter/style editing is still pending.
3. 1M chart browsing uses LOD/downsampling and overlay indicators remain best-effort; 100k remains the release-gating full-interaction target.
4. Full range-completeness cache task queue UI remains degraded; the first-stage UI exposes cache summary plus current-symbol and per cached interval clear actions.
5. Direct Binance REST/WebSocket smoke can fail in restricted networks, including HTTP 451 responses. Treat that as an external blocker when the Public Data archive verification and local checks pass.
6. Full Linux AppImage bundling should be produced in Ubuntu/CI because local Arch `linuxdeploy` can fail on `.relr.dyn` sections.

## Implemented In The Current Slice

1. Binance REST history for Spot/USD-M and Rust-managed WebSocket kline updates.
2. SQLite K-line cache read/write, summary, clear-current-symbol UI and per cached interval clear action.
3. CSV export for the current chart request.
4. New-schema JSON config export/import for settings, watchlist and drawings.
5. Core drawing persistence and rendering for horizontal lines, trend lines, vertical lines, rectangles, text labels and measurements.
6. Time-linked crosshair/visible-range synchronization between the two chart panes.
7. Rust-backed 24h market info, USD-M mark/index/funding data and compact symbol search/leaderboards.
8. Watchlist add/remove/reorder, chart PNG export and Volume/MA/EMA/BOLL/MACD/RSI/ATR/KDJ/Supertrend calculation/rendering.
9. Real Binance Public Data chart evidence for 100k full interaction and 1M LOD basic browsing.
