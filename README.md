# KLineForge

Open-source crypto charting, indicators and multi-timeframe analysis platform.

开源的加密货币看盘、画图与自定义指标平台。

## Current Branch

`perf/tauri-rust-rewrite` is the `v0.1.0-tauri` desktop prerelease branch. The app is built with Tauri 2, Rust, Tokio, SQLx, SQLite, Solid, TypeScript, Vite and Lightweight Charts.

Current documentation:

1. [Architecture](./docs/tauri-rust-architecture.md)
2. [Current Status](./docs/current-status.md)
3. [Development](./docs/development.md)
4. [Cache](./docs/cache.md)
5. [Performance Benchmark](./docs/performance-benchmark.md)
6. [Release Plan](./docs/tauri-release-plan.md)

## Features

1. Binance Spot and USD-M public market data through Rust REST and WebSocket clients.
2. SQLite-backed K-line cache, settings, watchlist, drawings and config import/export.
3. Dual chart panes with linked crosshair and independent zoom/pan state.
4. Built-in indicators: Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend.
5. Indicator instances with per-chart interval scope, editable parameters, style controls and persistence.
6. Drawing creation, loading and deletion for horizontal line, trend line, vertical line, rectangle, text and measurement annotations.
7. Cache summary plus current-symbol and per cached market/symbol/interval clear actions.
8. Chart PNG export, K-line CSV export and JSON config import/export.
9. Chinese/English UI, dark/light theme and session restore.
10. Real-data performance tooling for 100k and 1M chart datasets.

## Commands

Install dependencies:

```bash
npm install
```

Run the browser preview:

```bash
npm run dev
```

Run the desktop app during development:

```bash
npm run tauri:dev
```

Required checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run rust:fmt
npm run rust:clippy
npm run rust:test
```

Performance and browser verification:

```bash
npm run benchmark:real
npm run prepare:chart-dataset:100k
npm run prepare:chart-dataset:1m
npm run verify:render
npm run verify:indicator-instances
npm run verify:independent-chart-viewports
npm run verify:large-chart:100k
npm run verify:large-chart:1m
```

## Desktop Build

Build the release binary:

```bash
npm run tauri:build
```

Create the configured Linux bundle when the host toolchain supports it:

```bash
npm run tauri:bundle
```

The local release binary is written to:

```text
src-tauri/target/release/klineforge
```

On some rolling-release Linux hosts, full AppImage bundling can fail inside the external packaging toolchain because bundled binary utilities may not understand newer system library sections. Use Ubuntu or CI for AppImage artifacts if that occurs.

## Data And Persistence

KLineForge uses public Binance data only. It does not ask for API keys and does not send user configuration to a server.

Local persistence lives in the SQLite database `klineforge.sqlite3` under the Tauri app data directory. Browser preview mode keeps lightweight in-memory state for verification, while the desktop app uses SQLite.

Market data reads use Rust-side Binance public REST and WebSocket clients. Large benchmark datasets use Binance Public Data monthly archives. Direct Binance REST/WebSocket access can fail because of network or regional policy; archive-based verification remains the preferred local evidence path when that happens.

## Scope Boundaries

KLineForge does not include trading, API keys, account data, positions, orders, PnL, user accounts, cloud sync, alerts, Pine Script import, custom indicator source editing, tick storage or exchanges beyond Binance Spot and USD-M.

贡献时请保持范围收敛：不要加入交易、API Key、账户数据、云同步、告警、自定义指标源码编辑、Tick 存储或 Binance Spot/USD-M 之外的交易所。
