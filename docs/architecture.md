# Architecture

## English

KLineForge is a pure frontend charting application with strict separation between UI, market data access, chart rendering, local persistence, cache queue, indicators, drawings and export/import.

### High-Level Flow

```text
React shell
  -> session/settings store
  -> chart host
  -> chart data loader
  -> IndexedDB K-line cache
  -> market data provider
  -> Binance adapters / Binance Public Data / WebSocket

KLineCharts Canvas
  <- normalized K-lines
  <- indicator configs
  <- drawing overlays
```

React owns layout, controls, dialogs and persisted preference state. KLineCharts owns high-volume rendering, pan/zoom, crosshair and overlays. IndexedDB owns durable local data. Market access stays behind provider and adapter boundaries.

### Main Modules

`src/app`

Creates default launch state and stores the active session/settings in Zustand. The first launch defaults are:

1. Market: Binance USD-M Futures.
2. Symbol: `BTCUSDT`.
3. Left interval: `5m`.
4. Right interval: `1h`.
5. Theme: dark.
6. Price color mode: green up / red down.

`src/components/layout`

Owns the desktop shell: collapsible sidebar, watchlist area, export/import panel, top market information bar, dual-chart area, cache view and settings panel.

`src/features/chart`

Hosts KLineCharts instances. It maps KLineForge domain K-lines to KLineCharts data and now splits chart responsibilities across focused modules: instance lifecycle and resize, data loading/WebSocket feed, styles, crosshair synchronization, indicator application, drawing helpers and debug handles. It broadcasts crosshair timestamps through a local `EventTarget` so left and right charts can stay time-linked without routing high-frequency crosshair events through React global state.

`src/features/market-data`

Defines `MarketDataProvider`, exchange adapters and Binance REST/WS helpers. Direct Binance adapters are wrapped by a provider chain for reads that can try direct REST, an optional configured proxy and Public Data where appropriate before the UI uses static fallback rows.

`src/features/cache`

Implements IndexedDB K-line cache access, range merging, missing-range detection, task creation and cache management UI. Active chart intervals are prioritized first, then remaining supported intervals are cached in the background.

`src/features/indicators`

Keeps indicator definitions, pure calculation functions and KLineCharts custom indicator registration separate from UI. The current MVP supports built-in indicators only. The config repository persists visible state, parameters, color and line width per chart/market/symbol/interval.

`src/features/drawings`

Defines drawing object schemas and drawing toolbar behavior. Drawings are saved as timestamp/price anchors, not screen coordinates. Left and right chart drawings are independent, and drawings are not shared across intervals in the MVP.

`src/features/export`

Exports chart PNG from registered chart handles, K-line CSV from local cache and config JSON from user configuration stores. Config export intentionally excludes K-lines, cache ranges and cache tasks. Import validation checks the export envelope and persisted record shapes before any stores are cleared.

`src/persistence`

Defines the Dexie database and settings persistence. `localStorage` is used only for small launch/session preferences; IndexedDB stores larger and structured data.

### Data Model Families

The MVP uses these domain families:

1. Market type: `spot` or `usdM`.
2. Supported interval: `1m` through `1M`, excluding `1s`.
3. Symbol metadata.
4. K-line row.
5. 24h ticker row.
6. USD-M futures market info.
7. Cache task and cache coverage range.
8. Watchlist row.
9. Drawing object.
10. Indicator config.
11. Chart settings.
12. Last session state.
13. Exported config envelope.

Persisted records include `schemaVersion` so later migrations can be explicit.

### IndexedDB Stores

Current Dexie stores:

1. `metadata`
2. `symbols`
3. `klines`
4. `klineRanges`
5. `cacheTasks`
6. `watchlists`
7. `drawings`
8. `settings`
9. `indicatorConfigs`

`indicatorConfigs` was introduced in database version 2. Do not redeclare it in version 1 when editing migrations, because changing a primary key across Dexie versions can trigger upgrade errors.

### Market Data Strategy

The frontend market data strategy uses:

1. Local IndexedDB cache for chart history where available.
2. Binance Spot REST for Spot metadata, tickers and K-lines where browser access allows it.
3. Binance USD-M Futures REST for futures metadata, tickers, mark/index/funding info and K-lines where browser access allows it.
4. Optional configured proxy base URLs using `VITE_KLINEFORGE_PROXY_URL`, `VITE_KLINEFORGE_SPOT_PROXY_URL` or `VITE_KLINEFORGE_USDM_PROXY_URL`.
5. Binance Public Data monthly ZIP archives for chart history where REST/proxy access is unavailable and archive intervals exist.
6. Static fallback ticker rows or generated chart fallback candles only after real market data reads fail.
7. Binance WebSocket streams for active K-line updates.

Direct Binance browser access can fail because of CORS or regional restrictions. This is why provider abstraction is mandatory and why a backend proxy boundary is reserved.

Chart history does not treat a past monthly archive as fresh. After cache or Public Data rows are read, the loader checks the last candle close boundary and tries to backfill the recent gap via REST or the configured proxy before the WebSocket stream begins live continuation. If all real sources fail, generated fallback candles are labeled as fallback data instead of being presented as Binance history.

### Backend Proxy Reservation

No backend service is implemented in the MVP. The current app only exposes frontend proxy configuration boundaries. The intended future migration path is:

1. Keep UI and chart code unchanged.
2. Add `BackendMarketDataProvider` implementing `MarketDataProvider`.
3. Route REST-like reads through backend endpoints.
4. Optionally route WebSocket subscriptions through a backend or edge relay.
5. Keep local cache and drawing/indicator persistence in the frontend unless a later product decision adds cloud sync.

### Real-Time Updates

Each chart subscribes to the active symbol and interval. Incoming WebSocket K-lines update the currently forming candle or append new closed candles. The stream layer handles reconnect, state reporting and out-of-order protection. Live rows are also written back to IndexedDB asynchronously.

### Performance Boundaries

1. React never renders candle rows.
2. WebSocket ticks update the KLineCharts data loader callback, not a global React candle array.
3. IndexedDB writes are batched/chunked for large K-line imports.
4. Cache tasks run with limited concurrency.
5. Indicator calculations are pure modules and can later move to Web Workers.
6. Crosshair sync uses a lightweight event bus instead of persistent store writes.

### Scope Boundaries

This architecture deliberately does not include trading, API keys, accounts, cloud sync, order book, latest trades, alerts, custom indicator editing, Pine Script import, tick storage, multiple workspaces or exchanges beyond Binance Spot/USD-M Futures.

## 中文

KLineForge 是一个纯前端看盘应用，严格分离 UI、行情访问、图表渲染、本地持久化、缓存队列、指标、画线和导入导出。

### 总体数据流

```text
React 外壳
  -> 会话/设置状态
  -> 图表 host
  -> 图表数据加载器
  -> IndexedDB K 线缓存
  -> 行情 provider
  -> Binance 适配器 / Binance Public Data / WebSocket

KLineCharts Canvas
  <- 标准化 K 线
  <- 指标配置
  <- 画线 overlay
```

React 负责布局、控件、弹窗和偏好状态；KLineCharts 负责高频图表渲染、缩放拖动、十字光标和 overlay；IndexedDB 负责本地持久数据；行情访问必须通过 provider/adapter 边界。

### 主要模块

`src/app`

创建默认启动状态并用 Zustand 保存当前会话和设置。首次启动默认值为 U 本位合约、`BTCUSDT`、左图 `5m`、右图 `1h`、深色主题、绿涨红跌。

`src/components/layout`

负责桌面应用外壳：可折叠侧栏、自选区域、导入导出面板、顶部市场信息栏、双图区域、缓存视图和设置面板。

`src/features/chart`

负责 KLineCharts 实例挂载，把领域 K 线转换为 KLineCharts 数据。图表职责已拆分为更聚焦的模块：实例生命周期和 resize、数据加载和 WebSocket feed、样式、十字光标同步、指标应用、画线 helper 和调试句柄。左右图十字光标通过本地 `EventTarget` 按时间联动，避免把高频事件写入 React 全局状态。

`src/features/market-data`

定义 `MarketDataProvider`、交易所 adapter 和 Binance REST/WS helper。直接 Binance adapter 由 provider chain 包装，读取时可以依次尝试直接 REST、可选代理，以及适用时的 Public Data，最后 UI 才使用静态兜底行。

`src/features/cache`

实现 IndexedDB K 线缓存、范围合并、缺口检测、缓存任务创建和缓存管理页。当前左右图周期优先加载，其他支持周期在后台缓存。

`src/features/indicators`

指标定义、纯计算函数和 KLineCharts 自定义指标注册彼此分离。MVP 只支持内置指标，不支持用户编辑源码。指标配置按 chart/market/symbol/interval 保存可见状态、参数、颜色和线宽。

`src/features/drawings`

定义画线 schema 和工具栏行为。画线保存 timestamp/price 锚点，而不是屏幕坐标。左右图画线独立，MVP 中不同周期也不共享画线。

`src/features/export`

通过图表注册句柄导出 PNG，从本地缓存导出 K 线 CSV，从用户配置 store 导出配置 JSON。配置导出明确排除 K 线、缓存范围和缓存任务。导入会先校验 envelope 和持久化记录形状，确认安全后才清空并写入相关 store。

`src/persistence`

定义 Dexie 数据库和设置持久化。`localStorage` 只保存少量启动/会话偏好，IndexedDB 保存较大和结构化数据。

### 数据模型

MVP 包含市场类型、周期、交易对元数据、K 线、24h ticker、U 本位合约信息、缓存任务、缓存范围、自选、画线、指标配置、图表设置、上次会话和配置导出 envelope。持久化记录包含 `schemaVersion`，便于后续显式迁移。

### IndexedDB Store

当前 Dexie store 包括 `metadata`、`symbols`、`klines`、`klineRanges`、`cacheTasks`、`watchlists`、`drawings`、`settings` 和 `indicatorConfigs`。

`indicatorConfigs` 在数据库版本 2 引入。编辑迁移时不要把它也声明到版本 1，否则 Dexie 可能因为主键变化产生 upgrade error。

### 行情策略

当前前端行情策略依次使用本地 IndexedDB 缓存、Binance Spot REST、Binance USD-M Futures REST、可选代理地址 `VITE_KLINEFORGE_PROXY_URL` / `VITE_KLINEFORGE_SPOT_PROXY_URL` / `VITE_KLINEFORGE_USDM_PROXY_URL`、Binance Public Data 月度 ZIP 归档、真实数据失败后的静态 ticker 兜底行或生成的图表兜底蜡烛，以及 Binance WebSocket。直接浏览器访问 Binance 可能受到 CORS 或区域限制，因此 provider 抽象和后端代理预留是必要边界。

图表历史不会把过去月份归档当作最新数据。读取缓存或 Public Data 后，加载器会检查最后一根蜡烛的收盘边界，并在 WebSocket 开始实时延续前通过 REST 或配置代理补齐最近缺口。如果所有真实来源都失败，生成的兜底蜡烛会标记为兜底数据，而不会伪装成 Binance 历史。

### 后端代理预留

MVP 不实现后端服务。当前只保留前端代理配置边界。未来迁移路径是新增实现 `MarketDataProvider` 的 `BackendMarketDataProvider`，把 REST 类读取转到后端接口，并可选择把 WebSocket 订阅转到后端或边缘中继。除非后续产品决定增加云同步，本地缓存、画线和指标配置仍可留在前端。

### 实时更新

每个图表订阅当前交易对和当前周期。WebSocket K 线会更新当前未完成蜡烛或追加新收盘蜡烛。stream 层负责重连、状态展示和乱序保护。实时行也会异步写回 IndexedDB。

### 性能边界

React 不渲染 K 线蜡烛；WebSocket tick 不写入全局 React K 线数组；大批量 K 线导入会分块写入 IndexedDB；缓存任务限制并发；指标计算是纯模块，未来可迁移到 Web Worker；十字光标联动使用轻量事件总线。

### 范围边界

架构刻意不包含交易、API Key、账户、云同步、盘口、最新成交、告警、自定义指标编辑、Pine Script 导入、Tick 存储、多工作区或 Binance Spot/USD-M Futures 以外交易所。
