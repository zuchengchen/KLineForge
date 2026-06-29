# KLineForge Tauri/Rust Architecture

This branch rebuilds KLineForge as a Tauri desktop app for the `v0.1.0-tauri` prerelease.

## Stack

1. Tauri 2 desktop shell.
2. Rust backend with Tokio for async REST, WebSocket, SQLite and background tasks.
3. SQLx over SQLite for local K-line, settings, watchlist, drawing and indicator persistence.
4. Solid frontend for the desktop UI.
5. Lightweight Charts for the first charting implementation, with uPlot kept as the documented fallback if feature or performance targets cannot be met.

## Ownership Boundaries

Rust owns public Binance market data access, SQLite persistence, cache reads and writes, indicator calculations, benchmark data preparation and structured backend errors.

Solid owns layout, user interaction, language/theme controls and chart presentation.

The frontend talks to Rust through Tauri commands and receives live candles through Tauri events.

Current command/event surface:

1. Health/settings: `health`, `get_settings`, `save_settings`.
2. Market data: `get_symbols`, `get_market_info`, `get_leaderboards`, `get_chart_data`, `get_indicators`.
3. Live data: `start_live_stream`, `stop_live_stream`, `kline://update`, `kline://error`.
4. Watchlist/cache: `get_watchlist`, `seed_default_watchlist`, `get_cache_summary`, `clear_cache`.
5. Export/import: `export_klines_csv`, `export_config`, `import_config`.
6. Drawings: `get_drawings`, `save_drawing`, `delete_drawing`.
7. Benchmark: `run_performance_benchmark`.

## Security Boundary

The app remains a public-market-data charting app. It does not introduce trading, accounts, API keys, private exchange data, cloud sync or remote user configuration storage.

Tauri capabilities are intentionally small and should stay limited to the desktop shell defaults, dialog/file operations needed by import/export, opener support and explicitly approved local resources.

## Data Model

SQLite migrations live in `src-tauri/migrations/`. The initial schema includes:

1. `symbols`
2. `klines`
3. `kline_ranges`
4. `watchlists`
5. `drawings`
6. `indicator_configs`
7. `settings`
8. `cache_tasks`
9. `metadata`

Old IndexedDB/localStorage data is not migrated on this branch. New data starts from the SQLite schema.

## Current Migration Status

The current architecture slice is runnable and now covers the core data path:

1. Solid app shell.
2. Tauri command bridge.
3. SQLite initialization and K-line upsert/read path.
4. Binance REST K-line fetch path.
5. Lightweight Charts dual-pane chart shell.
6. Rust WebSocket kline stream supervisor per chart.
7. Rust Volume/MA/EMA/BOLL/MACD/RSI/ATR/KDJ/Supertrend calculation and chart display path.
8. CSV export and new-schema config import/export.
9. Cache summary, clear-current-symbol workflow and per cached market/symbol/interval clear action.
10. SQLite-backed drawing persistence for horizontal line, trend line, vertical line, rectangle, text and measurement annotations.
11. Watchlist add/remove/reorder and chart PNG export.
12. Benchmark command and CLI with REST smoke fallback plus real Binance Public Data archive dataset export.
13. Large-chart verification for 100k full interaction and 1M LOD basic browsing.
14. Spot/USD-M market-data smoke covering history, market info, symbols and live WebSocket kline.
15. Cache reads now require enough rows to satisfy the requested limit before returning a SQLite hit, so small old cache windows do not block larger chart or verification requests from being refetched.

Remaining MVP migration work is tracked in `docs/tauri-rust-mvp-migration.md`.

Known first-stage degradations:

1. Drawing drag/edit handles, style editing, lock/hide and undo/redo remain pending; creation/loading/deletion now covers the core annotation types.
2. Indicator configuration is limited to global visibility toggles; per-chart parameter/style editing is still pending.
3. Symbol search is compact and ticker-backed.
4. Full cache range-completeness/task queue UI remains degraded beyond summary and clear actions.
5. 1M overlay indicators are best-effort only; 100k remains the full-interaction verification target.
