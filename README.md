# KLineForge

Open-source crypto charting, indicators and multi-timeframe analysis platform.

开源的加密货币看盘、画图与自定义指标平台。

## Tauri/Rust Performance Rewrite

The `perf/tauri-rust-rewrite` branch is a `v0.1.0-tauri` prerelease rewrite focused on extreme desktop performance. It replaces the old Electron/Web-first runtime with Tauri, Rust, Tokio, SQLx/SQLite, Solid and Lightweight Charts.

Current branch documentation:

1. [`docs/tauri-rust-architecture.md`](./docs/tauri-rust-architecture.md)
2. [`docs/tauri-rust-mvp-migration.md`](./docs/tauri-rust-mvp-migration.md)
3. [`docs/performance-benchmark.md`](./docs/performance-benchmark.md)
4. [`docs/tauri-release-plan.md`](./docs/tauri-release-plan.md)

Primary development commands on this branch:

```bash
npm install
npm run tauri:dev
npm run typecheck
npm run lint
npm run test
npm run rust:fmt
npm run rust:clippy
npm run rust:test
npm run benchmark:real
npm run prepare:chart-dataset:100k
npm run prepare:chart-dataset:1m
npm run verify:large-chart:100k
npm run verify:large-chart:1m
```

Current Tauri/Rust slice includes:

1. Tauri 2 desktop shell with a Rust/Tokio/SQLx/SQLite backend and Solid frontend.
2. Binance Spot and USD-M public market data through Rust REST/WebSocket clients.
3. SQLite-backed K-line cache, settings, watchlist, drawings and config import/export.
4. Dual Lightweight Charts panes with linked crosshair/range, PNG export and CSV export.
5. Built-in indicator calculation and display for Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend.
6. Persisted drawing creation/loading/deletion for horizontal line, trend line, vertical line, rectangle, text and measurement annotations.
7. Cache summary, current-symbol clear and per cached market/symbol/interval clear actions.
8. Chinese/English UI, dark/light theme and session restore.

Latest local performance evidence on this branch:

1. 100,000 real Binance Public Data `BTCUSDT` USD-M `1m` rows: full dual-chart interaction, full indicator handoff, drawing workflow, PNG export and CSV export passed.
2. 1,000,000 real Binance Public Data `BTCUSDT` USD-M `1m` rows: dual-chart basic browsing passed with LOD/downsampling to 142,858 rendered candles per pane; 1M overlay indicators remain a non-blocking best-effort area.
3. `npm run tauri:build` builds the release binary at `src-tauri/target/release/klineforge`.
4. Live Binance market smoke can be blocked by external regional/network responses such as HTTP 451; use the Public Data archive verification path for local release evidence when direct Binance REST/WebSocket access is unavailable.

The old React/Electron implementation has been moved to `legacy-src/` as a migration reference. Old IndexedDB/localStorage data is not migrated into the new SQLite store on this branch.

## Legacy Main-Branch Notes

The following sections describe the previous React/Electron/Web MVP preserved under `legacy-src/`. They remain useful as migration reference only and are not the active architecture on `perf/tauri-rust-rewrite`.

For current work on this branch, prefer the Tauri/Rust docs linked above and the npm scripts listed in the Tauri/Rust section. The legacy notes below intentionally mention React, Electron, Dexie/IndexedDB, KLineCharts and Docker because they describe the old `main` architecture.

KLineForge is a desktop-first, pure frontend crypto charting application for Binance Spot and Binance USD-M Futures public market data. The MVP focuses on local charting, drawing, built-in indicators, multi-timeframe review and local K-line caching. It does not place orders, manage API keys or connect to a user account.

KLineForge 是一个桌面端优先的纯前端加密货币看盘应用，面向 Binance 现货和 U 本位合约公开行情。MVP 聚焦本地看盘、画图、内置指标、多周期分析和本地 K 线缓存，不做下单、API Key 管理或账号系统。

## MVP Status

The application has been implemented according to [`KLINEFORGE_GOAL.md`](./KLINEFORGE_GOAL.md) through Milestone 12 final verification scope.

当前应用已按 [`KLINEFORGE_GOAL.md`](./KLINEFORGE_GOAL.md) 推进到 Milestone 12 最终验收范围。

Included:

1. Binance Spot and Binance USD-M Futures market contexts.
2. Same-symbol left/right dual-chart layout with independent intervals.
3. Default launch state: USD-M Futures, `BTCUSDT`, left `5m`, right `1h`, dark theme.
4. KLineCharts Canvas chart rendering with real K-line history and live WebSocket updates.
5. Time-linked crosshair between the two charts.
6. Collapsible watchlist sidebar with add, delete, reorder and local persistence.
7. Symbol search with gainers, losers and quote-volume leaderboards.
8. Top market information bar with 24h ticker fields and USD-M funding/mark/index fields when available.
9. Built-in indicators: MA, EMA, BOLL, Supertrend, Volume, MACD, RSI, ATR and KDJ.
10. Indicator add/search/config panel with per-chart persistence.
11. Core drawing tools: trend line, horizontal line, vertical line, rectangle, text and measurement.
12. Drawing style, lock, hide, delete and drawing-only undo/redo.
13. Local multi-interval K-line cache in IndexedDB with cache tasks and cache management page.
14. Chart PNG export, K-line CSV export and config JSON import/export.
15. Dark/light themes, price color mode, basic chart settings and last-session restore.
16. Chinese and English UI.
17. Unit tests, browser verification scripts and Docker/Nginx static deployment.

已包含：

1. Binance 现货和 Binance U 本位合约市场。
2. 同交易对左右双图布局，左右图周期独立。
3. 默认启动状态：U 本位合约、`BTCUSDT`、左图 `5m`、右图 `1h`、深色主题。
4. 基于 KLineCharts Canvas 渲染真实 K 线历史和 WebSocket 实时更新。
5. 左右图按时间联动十字光标。
6. 可折叠自选列表，支持添加、删除、排序和本地保存。
7. 交易对搜索，支持涨幅榜、跌幅榜、成交额榜。
8. 顶部市场信息栏，展示 24h 行情字段；U 本位合约可展示资金费率、标记价和指数价。
9. 内置指标：MA、EMA、BOLL、Supertrend、Volume、MACD、RSI、ATR、KDJ。
10. 指标添加、搜索、参数和样式配置面板，左右图独立保存。
11. 核心画图工具：趋势线、水平线、垂直线、矩形、文字、测量。
12. 画线样式、锁定、隐藏、删除，以及只覆盖画线操作的撤销/重做。
13. IndexedDB 本地多周期 K 线缓存、缓存任务和缓存管理页面。
14. 图表 PNG 导出、K 线 CSV 导出、配置 JSON 导入/导出。
15. 深浅主题、涨跌颜色模式、基础图表设置和上次页面恢复。
16. 中文和英文界面。
17. 单元测试、浏览器验收脚本和 Docker/Nginx 静态部署。

## Non-Goals

The MVP intentionally does not include:

1. Real trading or order placement.
2. Binance API key management.
3. Account assets, positions, orders or PnL.
4. User accounts or cloud sync.
5. Order book or latest trade panels.
6. Alerts.
7. Custom indicator editor.
8. Pine Script or TradingView indicator import.
9. Tick, raw trade or aggTrade storage.
10. Multiple workspaces or 2x2/freeform multi-chart layouts.
11. Backend service implementation.
12. Exchanges other than Binance, including COIN-M Futures.

MVP 不包含：

1. 真实交易或下单。
2. Binance API Key 管理。
3. 账户资产、持仓、订单或 PnL。
4. 用户账号或云同步。
5. 盘口或最新成交面板。
6. 告警。
7. 自定义指标编辑器。
8. Pine Script 或 TradingView 指标导入。
9. Tick、raw trade 或 aggTrade 存储。
10. 多工作区或 2x2/自由布局多图。
11. 后端服务实现。
12. Binance 以外交易所，包括 COIN-M 合约。

## Tech Stack

Current `v0.1.0-tauri` branch:

1. Tauri 2 desktop shell.
2. Rust + Tokio backend.
3. SQLx over SQLite for K-lines, settings, watchlists, drawings and cache metadata.
4. Solid + TypeScript + Vite frontend.
5. Lightweight Charts for high-performance chart rendering.
6. Rust `reqwest` and `tokio-tungstenite` for Binance public REST/WebSocket data.
7. Rust ZIP/Public Data archive tooling for benchmark datasets.
8. Vitest, Rust tests and Playwright scripts for verification.

Legacy `main` reference under `legacy-src/`: React, KLineCharts, Zustand, Dexie/IndexedDB, Electron and Docker/Nginx.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:1420/
```

Run as a standalone Tauri desktop app during development:

```bash
npm run tauri:dev
```

This starts the Vite development server and opens KLineForge in a Tauri window.

Development checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Browser verification scripts require Chromium and a running dev server. Example:

```bash
npm run build
npm run preview -- --port 4173
npm run verify:render -- http://127.0.0.1:4173/
```

本地开发：

```bash
npm install
npm run dev
```

然后打开 `http://127.0.0.1:1420/`。开发验收命令为 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。浏览器验收脚本需要先构建并启动 preview 服务。

如需用独立 Tauri 桌面窗口启动开发版：

```bash
npm run tauri:dev
```

该命令会启动 Vite 开发服务器，并用 Tauri 窗口打开 KLineForge。

## Production Build

Build static assets:

```bash
npm run build
```

The production output is written to `dist/`.

The production build code-splits vendor libraries into separate Solid, Tauri bridge and charting chunks.

生产构建输出位于 `dist/`。

生产构建会拆分 vendor 库，生成独立的 Solid、Tauri bridge 和 charting chunk。

## Desktop Build

Build the Tauri release binary:

```bash
npm run tauri:build
```

Create the configured Linux bundle when the host bundling toolchain supports it:

```bash
npm run tauri:bundle
```

`npm run tauri:build` uses `tauri build --no-bundle` and writes the local release binary to:

```text
src-tauri/target/release/klineforge
```

On the current Arch-based development machine, full AppImage bundling can fail inside `linuxdeploy` because its bundled `strip` may not understand newer system libraries with `.relr.dyn` sections. Use Ubuntu/CI for AppImage artifacts if that occurs.

桌面版构建：

```bash
npm run tauri:build
npm run tauri:bundle
```

`npm run tauri:build` 使用 `tauri build --no-bundle`，本地 release binary 输出到 `src-tauri/target/release/klineforge`。当前 Arch 开发机上的完整 AppImage bundling 可能受 `linuxdeploy`/`.relr.dyn` 工具链限制影响；如遇到该问题，用 Ubuntu/CI 产出 AppImage。

## Web/Docker

Web/Docker static deployment is not a release target for `v0.1.0-tauri`. The old Docker/Nginx files remain only as legacy reference.

`v0.1.0-tauri` 不以 Web/Docker 静态部署作为发布目标；旧 Docker/Nginx 文件仅作为 legacy 参考保留。

## Data And Persistence

KLineForge uses public Binance data only. It does not ask for API keys and does not send user configuration to a server.

Local persistence:

1. SQLite database `klineforge.sqlite3` under the Tauri app data directory.
2. Preview/browser mode keeps small in-memory state for verification, but the release desktop app uses SQLite.

Old IndexedDB/localStorage data from the React/Electron/Web architecture is not migrated into this prerelease. Use the old `main` build if those local profiles are still needed.

Market data reads use Rust-side Binance public REST and WebSocket clients. Large benchmark/verification datasets use Binance Public Data monthly archives. If direct Binance REST/WebSocket is blocked by network or regional policy, commands can fail with external errors such as HTTP 451; the Public Data archive verification path remains the preferred local release evidence in that case.

Binance REST endpoints can be unavailable in some browser environments because of regional access or CORS restrictions. Binance Public Data monthly ZIP archives can also lag because they only cover completed months, and some archive intervals are not available. Unsupported archive intervals and failed imports are surfaced in cache tasks instead of being treated as complete coverage.

Chart history first reads SQLite. A cache hit must contain enough rows for the requested limit; otherwise the Rust backend refetches and writes the larger window so a small old cache cannot block large-chart verification. Config import/export uses the new SQLite-era schema for settings, watchlist and drawings.

KLineForge 只使用 Binance 公开数据，不需要 API Key，也不会把用户配置发送到服务器。

本地保存：

1. Tauri app data 目录下的 SQLite 数据库 `klineforge.sqlite3`。
2. Preview/browser 模式只为验证保留少量内存状态；发布桌面版使用 SQLite。

React/Electron/Web 旧架构里的 IndexedDB/localStorage 数据不会迁移到该预发布版本；仍需这些本地 profile 时请继续使用旧 `main` 构建。

行情读取使用 Rust 侧 Binance 公共 REST 和 WebSocket client。大数据 benchmark/验证数据集使用 Binance Public Data 月度归档。若直接 Binance REST/WebSocket 被网络或地区策略阻断，命令可能出现 HTTP 451 等外部错误；此时以 Public Data 归档验证路径作为本地发布证据。

图表历史优先读取 SQLite。缓存命中必须满足请求行数，否则 Rust 后端会重新拉取并写入更大的窗口，避免小缓存阻塞大图验证。配置导入/导出使用新的 SQLite 时代 schema，覆盖设置、自选和画线。

## Documentation

More details:

1. [Development Guide](./docs/development.md)
2. [Tauri/Rust Architecture](./docs/tauri-rust-architecture.md)
3. [Cache Design](./docs/cache.md)
4. [Tauri Release Plan](./docs/tauri-release-plan.md)

更多说明：

1. [开发文档](./docs/development.md)
2. [Tauri/Rust 架构文档](./docs/tauri-rust-architecture.md)
3. [缓存文档](./docs/cache.md)
4. [Tauri 发布计划](./docs/tauri-release-plan.md)

## Contributing Notes

Keep MVP scope tight. Frontend components should call Tauri commands instead of Binance endpoints directly. Persisted schemas must stay explicit and versionable. Drawing anchors must remain time/price based, never screen coordinates. Background cache and benchmark work must not block active chart interaction.

贡献时请保持 MVP 范围收敛。前端组件不要直接调用 Binance 接口，应通过 Tauri command 访问后端。持久化结构需要保持明确且可版本化。画线锚点必须基于时间/价格，不能用屏幕坐标。后台缓存和 benchmark 不能阻塞当前图表交互。
