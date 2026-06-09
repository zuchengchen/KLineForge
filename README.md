# KLineForge

Open-source crypto charting, indicators and multi-timeframe analysis platform.

开源的加密货币看盘、画图与自定义指标平台。

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

1. React + TypeScript + Vite.
2. KLineCharts for high-performance Canvas chart rendering.
3. Zustand for app/session/settings state.
4. Dexie over IndexedDB for K-lines, ranges, cache tasks, drawings, watchlists, indicators and settings.
5. i18next and react-i18next for bilingual UI.
6. fetch and WebSocket for Binance public market data.
7. fflate for Binance Public Data ZIP archive parsing.
8. Vitest and Testing Library for unit/component tests.
9. Playwright scripts for browser-level verification.
10. Electron desktop shell for standalone local app startup.
11. Docker multi-stage build with Nginx static serving.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

Run as a standalone desktop app during development:

```bash
npm run desktop:dev
```

This starts the Vite development server and opens KLineForge in an Electron window.

Development checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Browser verification scripts require Chromium and a running dev server. Example:

```bash
node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/
```

本地开发：

```bash
npm install
npm run dev -- --host 127.0.0.1
```

然后打开 `http://127.0.0.1:5173/`。开发验收命令为 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。浏览器验收脚本需要先启动开发服务器。

如需用独立桌面窗口启动开发版：

```bash
npm run desktop:dev
```

该命令会启动 Vite 开发服务器，并用 Electron 窗口打开 KLineForge。

## Production Build

Build static assets:

```bash
npm run build
```

The production output is written to `dist/`.

The production build code-splits non-initial panels and vendor libraries. The latest verified build split the initial app code into a small entry chunk plus separate React, KLineCharts and storage chunks, with lazy chunks for symbol search, cache management, indicators and export/import.

生产构建输出位于 `dist/`。

生产构建会拆分非初始面板和 vendor 库。最新验收构建把初始应用代码拆成较小入口 chunk，并把 React、KLineCharts 和存储依赖拆成独立 chunk；交易对搜索、缓存管理、指标和导入导出为懒加载 chunk。

## Desktop Build

Compile the Electron main/preload process and the Vite renderer:

```bash
npm run desktop:build
```

Create an unpacked desktop build for local verification:

```bash
npm run desktop:pack
```

Create a distributable desktop package:

```bash
npm run desktop:dist
```

On Linux, the default distributable target is an AppImage written under `release/`. The desktop shell keeps the React renderer isolated from Node.js by using Electron `contextIsolation`, disabled `nodeIntegration` and a small preload bridge.

桌面版构建：

```bash
npm run desktop:build
npm run desktop:pack
npm run desktop:dist
```

Linux 默认产物为 `release/` 目录下的 AppImage。桌面外壳保持 React 渲染层与 Node.js 隔离，使用 Electron `contextIsolation`、关闭 `nodeIntegration`，并通过很小的 preload bridge 暴露桌面只读信息。

## Docker

Build:

```bash
docker build -t klineforge .
```

Run:

```bash
docker run --rm -p 8080:80 klineforge
```

Open:

```text
http://127.0.0.1:8080/
```

Docker image uses a Node build stage and an Nginx runtime stage. It serves the static Vite build, falls back to `index.html` for client-side routing, sends basic security headers, keeps `index.html` uncached and serves hashed assets with immutable long-lived cache headers.

Docker 镜像使用 Node 构建阶段和 Nginx 运行阶段，部署 Vite 静态构建，并通过 `index.html` 处理前端路由回退；同时发送基础安全响应头，对 `index.html` 禁用缓存，对带 hash 的静态资源使用长期 immutable 缓存。

## Data And Persistence

KLineForge uses public Binance data only. It does not ask for API keys and does not send user configuration to a server.

Local persistence:

1. `localStorage`: small launch/session preferences.
2. IndexedDB database `klineforge`: K-lines, cache ranges, cache tasks, watchlists, drawings, indicator configs and settings.

The Electron desktop build uses Chromium storage inside Electron's app profile. Browser-mode and desktop-mode IndexedDB data are separate; use the existing config export/import flow to move settings, watchlists, drawings and indicator configuration between profiles.

Market data reads use a clear fallback order. Symbol search, leaderboards, watchlist ticker rows and market info try real Binance REST data first, then optional configured proxy endpoints, and only use static fallback rows when real data access fails. Chart history tries local cache, direct REST/proxy and Binance Public Data where supported; after cache or Public Data loads, the chart loader checks the last candle close boundary and tries REST/proxy backfill so monthly archives do not silently leave recent gaps. If real chart sources all fail, generated fallback candles are labeled as fallback data. WebSocket remains the live continuation.

Optional proxy variables are `VITE_KLINEFORGE_PROXY_URL`, `VITE_KLINEFORGE_SPOT_PROXY_URL` and `VITE_KLINEFORGE_USDM_PROXY_URL`. KLineForge expects Binance-compatible REST paths and does not implement the backend service in this MVP.

Binance REST endpoints can be unavailable in some browser environments because of regional access or CORS restrictions. Binance Public Data monthly ZIP archives can also lag because they only cover completed months, and some archive intervals are not available. Unsupported archive intervals and failed imports are surfaced in cache tasks instead of being treated as complete coverage.

Cache coverage ranges use accurate candle close boundaries, not just the last candle `openTime`. Cache tasks can be `partial` when their declared target range still has missing spans. Config import validates the export envelope and record shapes before mutating IndexedDB, so malformed JSON cannot clear existing settings, watchlists, drawings or indicator configs.

KLineForge 只使用 Binance 公开数据，不需要 API Key，也不会把用户配置发送到服务器。

本地保存：

1. `localStorage` 保存少量启动和会话偏好。
2. IndexedDB 数据库 `klineforge` 保存 K 线、缓存范围、缓存任务、自选、画线、指标配置和设置。

Electron 桌面版使用 Electron 应用 profile 下的 Chromium 存储。浏览器模式和桌面模式的 IndexedDB 数据彼此独立；如需迁移设置、自选、画线和指标配置，请使用现有配置导出/导入流程。

行情读取使用明确的兜底顺序。交易对搜索、榜单、自选 ticker 行和市场信息会先尝试真实 Binance REST，再尝试可选代理端点，只有真实数据访问失败后才使用静态兜底行。图表历史会尝试本地缓存、直接 REST/代理和支持的 Binance Public Data；读取缓存或 Public Data 后会检查最后一根蜡烛收盘边界，并尝试 REST/代理回补最近缺口，避免月度归档造成静默过期。如果真实图表来源全部失败，生成的兜底蜡烛会标记为兜底数据。WebSocket 仍用于实时延续。

可选代理变量为 `VITE_KLINEFORGE_PROXY_URL`、`VITE_KLINEFORGE_SPOT_PROXY_URL` 和 `VITE_KLINEFORGE_USDM_PROXY_URL`。KLineForge 期望代理提供 Binance 兼容 REST 路径，MVP 不实现后端服务。

部分浏览器环境可能因区域访问或 CORS 限制无法直接访问 Binance REST。Binance Public Data 月度 ZIP 归档只覆盖已完成月份，也可能不支持部分周期。不支持的归档周期和失败导入会在缓存任务中显示，而不会被当成完整覆盖。

缓存覆盖范围使用准确的蜡烛收盘边界，而不是仅使用最后一根 K 线的 `openTime`。如果声明的目标范围仍有缺失，缓存任务会显示为 `partial`。配置导入会在修改 IndexedDB 前校验导出 envelope 和记录形状，因此格式错误的 JSON 不能清空已有设置、自选、画线或指标配置。

## Documentation

More details:

1. [Development Guide](./docs/development.md)
2. [Architecture](./docs/architecture.md)
3. [Cache Design](./docs/cache.md)
4. [Goal Specification](./KLINEFORGE_GOAL.md)

更多说明：

1. [开发文档](./docs/development.md)
2. [架构文档](./docs/architecture.md)
3. [缓存文档](./docs/cache.md)
4. [目标规格](./KLINEFORGE_GOAL.md)

## Contributing Notes

Keep MVP scope tight. UI components should not call Binance endpoints directly; use provider/adapter abstractions. Persisted schemas must keep `schemaVersion`. Drawing anchors must remain `{ timestamp, price }`, never screen coordinates. Background cache work must not block active chart interaction.

贡献时请保持 MVP 范围收敛。UI 组件不要直接调用 Binance 接口，应通过 provider/adapter 抽象访问。持久化结构需要保留 `schemaVersion`。画线锚点必须保持 `{ timestamp, price }`，不能用屏幕坐标。后台缓存不能阻塞当前图表交互。
