# Development Guide

## English

KLineForge is developed against the authoritative product scope in [`../KLINEFORGE_GOAL.md`](../KLINEFORGE_GOAL.md). The MVP is a pure frontend application: React renders the shell and controls, KLineCharts renders candles on Canvas, and IndexedDB stores local user data and K-line cache.

### Requirements

1. Node.js compatible with the project lockfile.
2. npm.
3. Chromium for browser verification scripts.
4. Docker for final static serving checks.

### Install And Run

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`.

### Required Checks

Run these before considering a milestone or final change complete:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Browser checks require a running dev server:

```bash
node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/
```

Older milestone scripts are kept in `scripts/verify-milestone-*.mjs` and can be used to retest specific areas such as charts, cache, indicators, drawings or export/import.

### Project Structure

```text
src/
  app/                    App entry, defaults, Zustand session store
  components/layout/      Desktop shell, sidebar, market bar, settings
  features/cache/         IndexedDB K-line cache, ranges, queue, management page
  features/chart/         KLineCharts host, adapter, loader, export registry
  features/drawings/      Drawing definitions, repository, history, toolbar
  features/export/        PNG, CSV and config import/export helpers
  features/indicators/    Indicator calculations, definitions, KLineCharts registry
  features/market-data/   Provider abstraction, Binance adapters, REST/WS helpers
  features/symbol-search/ Symbol search and leaderboard data
  features/watchlist/     Watchlist repository
  i18n/                   English and Chinese resources
  persistence/            Dexie database and settings persistence
  test/                   Vitest setup and browser mocks
  types/                  Domain types
```

### Coding Rules

1. Use English for filenames, types, variables, functions and comments.
2. All user-facing strings must go through i18n resources.
3. React UI components must not call Binance endpoints directly. Use `MarketDataProvider`, adapters or feature helpers.
4. K-line rendering must stay in KLineCharts Canvas; React must not render candle rows.
5. Persisted schemas must include `schemaVersion`.
6. Drawing anchors must be `{ timestamp, price }`; never store screen coordinates as primary data.
7. Background caching must be asynchronous, bounded and lower priority than active chart display.
8. Do not add trading, API keys, account state, alerts, Pine Script import or tick storage inside the MVP.

### Tests

Unit tests currently cover:

1. Default launch state and session hydration.
2. Binance adapter normalization and interval validation.
3. K-line cache writes, reads, duplicate handling, ranges and completeness.
4. Cache queue task creation, pause/resume/retry/delete behavior.
5. Indicator calculations and indicator config persistence.
6. Drawing serialization, repository behavior and drawing history.
7. Symbol search, watchlist and export/import schemas.

Browser scripts verify real app behavior with Playwright and Chromium. The final script captures dark, light, default, dual-chart, cache and settings screenshots and checks that charts are non-blank.

### Browser Reset

`public/reset.html` exists so verification scripts can clear `localStorage` and the `klineforge` IndexedDB database on the same origin before React/Dexie opens the app connection. Use it when a test needs a clean launch state.

### Docker

```bash
docker build -t klineforge .
docker run --rm -p 8080:80 klineforge
```

The runtime image serves `dist/` with Nginx and uses `try_files` fallback to `index.html`.

### Known Data Source Notes

Binance REST may be blocked by CORS or regional restrictions in some browser environments. The provider chain tries direct REST first, then optional proxy base URLs, then Binance Public Data where appropriate. Optional proxy variables are:

```bash
VITE_KLINEFORGE_PROXY_URL=https://your-proxy.example
VITE_KLINEFORGE_SPOT_PROXY_URL=https://your-spot-proxy.example
VITE_KLINEFORGE_USDM_PROXY_URL=https://your-usdm-proxy.example
```

The proxy is expected to expose Binance-compatible REST paths. KLineForge does not implement that backend in the MVP.

The chart loader can use Binance Public Data monthly ZIP archives for supported intervals, but monthly archives are not enough for fresh recent candles. After cache or Public Data loads, the chart loader tries a REST/proxy backfill from the last candle close boundary to now. Unsupported Public Data intervals can remain failed in the cache management page while active charts continue to load the best available history.

### Import Safety

Config import validates the envelope, schema versions, settings, session, watchlists, drawings, drawing points, indicator configs, markets, chart IDs, intervals and indicator names before mutating IndexedDB. Failed imports must preserve existing watchlists, drawings and indicator configs.

### Bundle And Static Serving

Production build uses route/panel-level dynamic imports plus manual chunks for React, KLineCharts and storage/ZIP dependencies. Nginx serves `index.html` and SPA fallbacks with `no-cache`, hashed assets with one-year immutable caching and basic security headers.

## 中文

KLineForge 以 [`../KLINEFORGE_GOAL.md`](../KLINEFORGE_GOAL.md) 为权威范围进行开发。MVP 是纯前端应用：React 渲染应用外壳和控件，KLineCharts 使用 Canvas 渲染 K 线，IndexedDB 保存用户数据和 K 线缓存。

### 环境要求

1. 与 lockfile 兼容的 Node.js。
2. npm。
3. 用于浏览器验收脚本的 Chromium。
4. 用于最终静态服务验收的 Docker。

### 安装与启动

```bash
npm install
npm run dev -- --host 127.0.0.1
```

打开 `http://127.0.0.1:5173/`。

### 必跑检查

每个里程碑或最终改动完成前必须运行：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

浏览器验收需要先启动开发服务器：

```bash
node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/
```

历史里程碑脚本保留在 `scripts/verify-milestone-*.mjs`，可用于回归图表、缓存、指标、画图或导入导出功能。

### 目录说明

```text
src/
  app/                    App 入口、默认值、Zustand 会话状态
  components/layout/      桌面外壳、侧栏、市场信息栏、设置面板
  features/cache/         IndexedDB K 线缓存、范围、队列、缓存管理页
  features/chart/         KLineCharts host、适配、加载、导出注册
  features/drawings/      画线定义、仓库、历史、工具栏
  features/export/        PNG、CSV、配置导入导出
  features/indicators/    指标计算、定义、KLineCharts 注册
  features/market-data/   行情 provider 抽象、Binance 适配器、REST/WS helper
  features/symbol-search/ 交易对搜索和榜单
  features/watchlist/     自选列表仓库
  i18n/                   英文和中文资源
  persistence/            Dexie 数据库和设置持久化
  test/                   Vitest setup 和浏览器 mock
  types/                  领域类型
```

### 代码规则

1. 文件名、类型、变量、函数和注释使用英文。
2. 所有用户可见文本必须走 i18n 资源。
3. React UI 组件不能直接调用 Binance 接口，应使用 `MarketDataProvider`、adapter 或 feature helper。
4. K 线渲染必须留在 KLineCharts Canvas 中，React 不渲染蜡烛数据。
5. 持久化 schema 需要包含 `schemaVersion`。
6. 画线锚点必须是 `{ timestamp, price }`，不能把屏幕坐标作为主数据保存。
7. 后台缓存必须异步、有并发限制，并低于当前图表展示优先级。
8. MVP 内不要加入交易、API Key、账号资产、告警、Pine Script 导入或 Tick 存储。

### 测试覆盖

当前单元测试覆盖默认启动状态、会话恢复、Binance 数据转换、周期校验、K 线缓存、缓存队列、指标计算、指标配置、画线序列化、画线历史、自选、搜索和导入导出 schema。

浏览器脚本用 Playwright + Chromium 验证真实应用行为。最终脚本会捕获深色、浅色、默认启动、双图、缓存管理和设置截图，并检查图表非空。

### 浏览器重置

`public/reset.html` 用于在同源页面清空 `localStorage` 和 `klineforge` IndexedDB，避免 React/Dexie 已打开数据库连接时删除数据库被阻塞。需要干净启动状态的验收脚本应优先使用它。

### Docker

```bash
docker build -t klineforge .
docker run --rm -p 8080:80 klineforge
```

运行镜像使用 Nginx 服务 `dist/`，并通过 `try_files` 回退到 `index.html`。

### 数据源说明

部分浏览器环境可能因 CORS 或区域限制无法直接访问 Binance REST。provider chain 会先尝试直接 REST，再尝试可选代理地址，然后在适用时尝试 Binance Public Data。可选代理变量为：

```bash
VITE_KLINEFORGE_PROXY_URL=https://your-proxy.example
VITE_KLINEFORGE_SPOT_PROXY_URL=https://your-spot-proxy.example
VITE_KLINEFORGE_USDM_PROXY_URL=https://your-usdm-proxy.example
```

代理需要暴露 Binance 兼容 REST 路径。MVP 不实现该后端。

图表加载器可使用 Binance Public Data 月度 ZIP 归档读取支持的周期，但月度归档不能提供最新蜡烛。读取缓存或 Public Data 后，图表加载器会从最后一根蜡烛收盘边界到当前时间尝试 REST/代理回补。Public Data 不支持的周期可能在缓存管理页显示失败，但当前图表会继续加载可用历史数据。

### 导入安全

配置导入会在修改 IndexedDB 前校验 envelope、schemaVersion、设置、会话、自选、画线、画线点、指标配置、市场、图表 ID、周期和指标名称。导入失败必须保留现有自选、画线和指标配置。

### Bundle 与静态服务

生产构建对非初始面板使用动态导入，并把 React、KLineCharts、存储/ZIP 依赖拆成手动 chunk。Nginx 对 `index.html` 和 SPA fallback 使用 `no-cache`，对带 hash 的静态资源使用一年 immutable 缓存，并发送基础安全响应头。
