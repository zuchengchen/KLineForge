# Milestone 0 Design And Repo Plan

Status: approved by goal owner on 2026-06-09.

This document is the Milestone 0 deliverable for `KLINEFORGE_GOAL.md`. It is planning-only and intentionally does not add application code.

## 1. Scope Preservation

The MVP remains a desktop-first, pure frontend crypto charting app for:

1. Binance Spot.
2. Binance USD-M Futures.

The implementation must not add:

1. Trading or order placement.
2. API key handling.
3. User accounts.
4. Cloud sync.
5. Order book or latest trades panels.
6. Alerts.
7. Custom indicator editor.
8. Pine Script import.
9. Tick, raw trade or aggTrade storage.
10. Backend services.
11. Exchanges outside Binance Spot and Binance USD-M Futures.
12. Binance COIN-M Futures.
13. 2x2 or freeform multi-chart layout.

Any future need that appears to require one of these non-goals should stop the milestone and be reported.

## 2. Product Module Design

### 2.1 App Shell

Owns the desktop terminal layout and persistent user session.

Responsibilities:

1. Restore first-launch or last-session state.
2. Render collapsible left sidebar and dual-chart workspace.
3. Route or switch between main chart view, cache management and settings.
4. Provide global i18n, theme and keyboard shortcut contexts.

Primary state:

1. Active market.
2. Active symbol.
3. Left chart interval.
4. Right chart interval.
5. Active chart id.
6. Sidebar state.
7. Fullscreen chart state.
8. Dialog and panel state.

### 2.2 Market Data

Owns all public Binance data access through abstractions. UI components never call Binance endpoints directly.

Responsibilities:

1. Fetch exchange symbols.
2. Fetch historical K-lines.
3. Fetch 24h tickers.
4. Fetch USD-M mark price, index price, funding rate and next funding time.
5. Subscribe to real-time K-line streams.
6. Normalize external payloads into internal models.
7. Expose provider APIs that can later be backed by a backend proxy.

### 2.3 Charting

Owns KLineCharts integration.

Responsibilities:

1. Mount and dispose chart instances.
2. Apply theme, style and precision.
3. Load data from repositories.
4. Apply real-time candle updates.
5. Manage zoom, pan and visible range.
6. Link crosshair by timestamp between left and right charts.
7. Render indicators and drawings.
8. Export chart PNG.

React owns layout and controls; KLineCharts owns candle rendering.

### 2.4 Watchlist And Symbol Discovery

Owns user watchlists, symbol search and market leaderboards.

Responsibilities:

1. Keep Spot and USD-M watchlists separate.
2. Add, delete and reorder watchlist symbols.
3. Persist watchlists locally.
4. Display latest price and 24h change.
5. Search symbols in current market context.
6. Sort leaderboards by 24h change and quote volume.

### 2.5 Indicator System

Owns built-in indicator definitions, calculations, configuration and chart registration.

Responsibilities:

1. Provide calculation modules for all MVP indicators.
2. Provide unit-testable pure functions.
3. Store per-chart indicator configs.
4. Render main-pane and sub-pane indicators.
5. Allow parameter, color, line width and visibility changes.
6. Preserve future custom-indicator architecture without exposing custom editing in MVP.

MVP indicators:

1. Main chart: MA, EMA, BOLL, Supertrend.
2. Sub chart: Volume, MACD, RSI, ATR, KDJ.

### 2.6 Drawing System

Owns chart overlays and drawing persistence.

Responsibilities:

1. Support select, trend line, horizontal line, vertical line, rectangle, text and measurement tools.
2. Store anchors as timestamp plus price.
3. Keep left and right chart drawings independent.
4. Persist drawings locally.
5. Support lock, hide, delete, style edit and text edit.
6. Support undo/redo for drawing operations only.

### 2.7 Local Persistence

Owns IndexedDB and localStorage persistence.

Responsibilities:

1. IndexedDB for K-line cache, cache ranges, cache tasks, watchlists, drawings, indicator configs and larger persisted records.
2. localStorage for small boot preferences and last-session pointers only.
3. Schema versioning for every persisted domain.
4. Import/export for user configuration, excluding K-line cache.

### 2.8 Cache Engine

Owns full local multi-interval K-line cache for opened symbols.

Responsibilities:

1. Prioritize active chart data.
2. Discover earliest available K-line.
3. Cache all supported intervals for active market/symbol in the background.
4. Limit request concurrency.
5. Track progress, retries and failures.
6. Detect and repair missing ranges.
7. Pause on storage quota errors without deleting data.
8. Provide cache management data and actions.

### 2.9 Export

Responsibilities:

1. Chart PNG export for left, right or fullscreen active chart.
2. CSV export from local K-line cache.
3. JSON config export/import with schema validation.

### 2.10 Documentation And Verification

Responsibilities:

1. Keep README and docs bilingual or English-first with Chinese notes.
2. Provide development, cache and architecture docs.
3. Maintain milestone-gated test commands.
4. Add browser verification for UI/chart milestones.

## 3. Page Structure

The app can start without a heavyweight router. A lightweight view state is enough for MVP:

1. `chart`: default main terminal.
2. `cache`: cache management page or full-height panel.
3. `settings`: settings panel.

### 3.1 Chart View

Structure:

```text
AppShell
  Sidebar
  MainArea
    MarketInfoBar
    ChartWorkspace
      DrawingToolbar
      ChartPane(left)
      ChartPane(right)
```

The sidebar may collapse to an icon rail. The chart workspace keeps a stable two-column grid. Fullscreen chart mode replaces the two-column grid with one active chart pane.

### 3.2 Cache Management View

Structure:

```text
AppShell
  Sidebar
  MainArea
    CacheManagementHeader
    CacheSummary
    CacheTaskTable
    CacheActionToolbar
```

Cache management should be reachable from the sidebar and from storage quota warnings.

### 3.3 Settings View

Structure:

```text
SettingsPanel
  AppearanceSection
  LanguageSection
  ChartBehaviorSection
  ImportExportSection
```

Settings may be a drawer or modal. It must not obscure critical error dialogs.

### 3.4 Dialogs

Dialogs:

1. Symbol search dialog.
2. Indicator add/edit dialog.
3. Config import dialog.
4. CSV export dialog.
5. Confirmation dialog for cache deletion.
6. Storage quota warning dialog.

All dialogs close with Esc unless a destructive confirmation is in progress.

## 4. Component Structure

Proposed source layout for later milestones:

```text
src/
  app/
    App.tsx
    providers/
    routes/
    stores/
  components/
    common/
    dialogs/
    layout/
  features/
    cache/
    chart/
    drawings/
    export/
    indicators/
    market-data/
    settings/
    symbols/
    watchlist/
  i18n/
  persistence/
  test/
  types/
```

### 4.1 App And Layout Components

1. `App`: top-level providers and view switching.
2. `AppShell`: overall layout.
3. `Sidebar`: collapsible sidebar shell.
4. `MarketSwitch`: Spot / USD-M Futures switch.
5. `MainArea`: right-side content region.
6. `TopBarActions`: settings, cache and export entries.

### 4.2 Market Components

1. `MarketInfoBar`: symbol/ticker/futures info.
2. `SymbolSearchDialog`: search and leaderboards.
3. `LeaderboardTabs`: gainers, losers, quote volume.
4. `SymbolSearchResultList`.
5. `WatchlistPanel`.
6. `WatchlistRow`.

### 4.3 Chart Components

1. `ChartWorkspace`: dual-chart or fullscreen layout.
2. `ChartPane`: pane header plus KLineCharts host.
3. `KLineChartHost`: owns chart instance lifecycle.
4. `IntervalSelector`.
5. `ChartHeaderStats`: active candle OHLC and indicator values.
6. `ChartConnectionBadge`.
7. `ChartFullscreenButton`.
8. `ChartScreenshotButton`.

### 4.4 Indicator Components

1. `IndicatorButton`.
2. `IndicatorDialog`.
3. `IndicatorSearch`.
4. `IndicatorGroupList`.
5. `IndicatorConfigForm`.
6. `IndicatorLegend`.

### 4.5 Drawing Components

1. `DrawingToolbar`.
2. `DrawingToolButton`.
3. `DrawingStylePopover`.
4. `DrawingTextEditor`.
5. `DrawingUndoRedoButtons`.

KLineCharts overlays should own the actual hit testing and canvas drawing where possible.

### 4.6 Cache Components

1. `CacheStatusBadge`.
2. `CacheManagementPage`.
3. `CacheSummaryCards`.
4. `CacheTaskTable`.
5. `CacheTaskRow`.
6. `CacheActions`.
7. `StorageQuotaWarning`.

### 4.7 Settings And Export Components

1. `SettingsPanel`.
2. `ThemeToggle`.
3. `LanguageSelect`.
4. `PriceColorModeSelect`.
5. `ChartStyleSelect`.
6. `ConfigImportExport`.
7. `CsvExportDialog`.

## 5. Data Model Draft

These are draft TypeScript shapes for implementation. Field names should stay English.

```ts
type MarketType = 'spot' | 'usdM';

type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M';

type ChartId = 'left' | 'right';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';
```

### 5.1 Symbol Metadata

```ts
interface SymbolInfo {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'trading' | 'halt' | 'break' | 'unknown';
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: string;
  stepSize?: string;
  contractType?: 'perpetual' | 'delivery';
  onboardDate?: number;
  earliestKlineOpenTime?: number;
  updatedAt: number;
}
```

### 5.2 K-Line

```ts
interface Kline {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  interval: Interval;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  tradeCount: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  isClosed: boolean;
  source: 'rest' | 'websocket' | 'cache' | 'public-data' | 'fallback';
  updatedAt: number;
}
```

Prices and quantities stay as strings in storage to avoid precision loss. Chart adapters convert to numbers at render boundaries.

### 5.3 Ticker

```ts
interface Ticker24h {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  tradeCount?: number;
  updatedAt: number;
}
```

### 5.4 Futures Info

```ts
interface FuturesMarketInfo {
  schemaVersion: 1;
  market: 'usdM';
  symbol: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  nextFundingTime: number;
  updatedAt: number;
}
```

### 5.5 Watchlist

```ts
interface WatchlistItem {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

### 5.6 Session And Settings

```ts
interface LastSessionState {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  leftInterval: Interval;
  rightInterval: Interval;
  activeChartId: ChartId;
  fullscreenChartId: ChartId | null;
  sidebarCollapsed: boolean;
  updatedAt: number;
}

interface ChartSettings {
  schemaVersion: 1;
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US' | 'auto';
  priceColorMode: 'green-up-red-down' | 'red-up-green-down';
  chartStyle: 'candle' | 'hollow-candle' | 'line';
  showGrid: boolean;
  showLastPriceLine: boolean;
  showCrosshair: boolean;
  updatedAt: number;
}
```

## 6. IndexedDB Schema Draft

Database name: `klineforge`.

Database schema version: `1`.

The implementation may use Dexie. Suggested stores:

```text
metadata
symbols
klines
klineRanges
cacheTasks
watchlists
drawings
indicatorConfigs
settings
```

### 6.1 Store: metadata

Purpose: database and migration metadata.

Primary key: `key`.

Fields:

1. `key`.
2. `value`.
3. `schemaVersion`.
4. `updatedAt`.

### 6.2 Store: symbols

Primary key:

```text
[market+symbol]
```

Indexes:

1. `market`.
2. `symbol`.
3. `[market+status]`.

### 6.3 Store: klines

Primary key:

```text
[market+symbol+interval+openTime]
```

Indexes:

1. `[market+symbol+interval]`.
2. `[market+symbol+interval+openTime]`.
3. `updatedAt`.

Rules:

1. This key prevents duplicate candles.
2. WebSocket updates may upsert the current open candle.
3. Closed candles should not be overwritten with older websocket payloads.

### 6.4 Store: klineRanges

Purpose: track cached coverage and completeness by market, symbol and interval.

Primary key:

```text
id = market:symbol:interval:startTime:endTime
```

Fields:

1. `schemaVersion`.
2. `market`.
3. `symbol`.
4. `interval`.
5. `startTime`.
6. `endTime`.
7. `source`.
8. `status`: `complete` or `partial`.
9. `createdAt`.
10. `updatedAt`.

Indexes:

1. `[market+symbol+interval]`.
2. `[market+symbol+interval+startTime]`.
3. `[market+symbol+interval+endTime]`.

Completed adjacent or overlapping ranges should be merged.

### 6.5 Store: cacheTasks

Primary key: `id`.

Fields:

1. `schemaVersion`.
2. `id`.
3. `market`.
4. `symbol`.
5. `interval`.
6. `targetStartTime`.
7. `targetEndTime`.
8. `cursorStartTime`.
9. `status`: `queued`, `running`, `paused`, `complete`, `failed`, `quota-paused`, `cancelled`.
10. `priority`: `active`, `visible`, `background`.
11. `attemptCount`.
12. `lastError`.
13. `progressLoaded`.
14. `progressTotalEstimate`.
15. `createdAt`.
16. `updatedAt`.

Indexes:

1. `status`.
2. `priority`.
3. `[market+symbol]`.
4. `[market+symbol+interval]`.

### 6.6 Store: watchlists

Primary key:

```text
[market+symbol]
```

Indexes:

1. `market`.
2. `[market+sortOrder]`.

### 6.7 Store: drawings

Primary key: `id`.

Indexes:

1. `[market+symbol+chartId+interval]`.
2. `[market+symbol+chartId+interval+updatedAt]`.
3. `visible`.
4. `locked`.

Drawings are independent per chart and interval in MVP.

### 6.8 Store: indicatorConfigs

Primary key:

```text
[market+symbol+chartId+interval]
```

Indexes:

1. `[market+symbol]`.
2. `[chartId+interval]`.
3. `updatedAt`.

### 6.9 Store: settings

Primary key: `key`.

Use for settings too large or structured for localStorage.

## 7. Drawing Schema Draft

```ts
type DrawingType =
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'rectangle'
  | 'text'
  | 'measurement';

interface DrawingPoint {
  timestamp: number;
  price: string;
}

interface DrawingStyle {
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed';
  opacity: number;
  textColor?: string;
  textSize?: number;
  fillColor?: string;
  fillOpacity?: number;
}

interface DrawingObject {
  schemaVersion: 1;
  id: string;
  market: MarketType;
  symbol: string;
  chartId: ChartId;
  interval: Interval;
  type: DrawingType;
  points: DrawingPoint[];
  text?: string;
  style: DrawingStyle;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}
```

Type-specific point rules:

1. Trend line: two points.
2. Horizontal line: one point; timestamp is the creation timestamp and price anchors the line.
3. Vertical line: one point; timestamp anchors the line and price may store the creation price for hit/edit context.
4. Rectangle: two diagonal points.
5. Text: one point plus `text`.
6. Measurement: two points.

KLineCharts overlay points should be adapted from `{ timestamp, price }` to KLineCharts point shape `{ timestamp, value }`.

Undo/redo draft:

```ts
interface DrawingHistoryEntry {
  id: string;
  chartKey: string;
  action: 'create' | 'delete' | 'move' | 'resize' | 'style' | 'text';
  before?: DrawingObject;
  after?: DrawingObject;
  createdAt: number;
}
```

History can be in memory for MVP, but persisted drawings must reflect the latest committed state.

## 8. Indicator Config Schema Draft

```ts
type IndicatorId =
  | 'MA'
  | 'EMA'
  | 'BOLL'
  | 'Supertrend'
  | 'Volume'
  | 'MACD'
  | 'RSI'
  | 'ATR'
  | 'KDJ';

type IndicatorPane = 'main' | 'sub';

interface IndicatorSeriesStyle {
  key: string;
  color: string;
  lineWidth: number;
  visible: boolean;
}

interface IndicatorInstanceConfig {
  schemaVersion: 1;
  instanceId: string;
  indicatorId: IndicatorId;
  pane: IndicatorPane;
  order: number;
  visible: boolean;
  params: Record<string, number | string | boolean>;
  styles: IndicatorSeriesStyle[];
  createdAt: number;
  updatedAt: number;
}

interface ChartIndicatorConfig {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  chartId: ChartId;
  interval: Interval;
  indicators: IndicatorInstanceConfig[];
  updatedAt: number;
}
```

Default configs:

1. MA on main pane.
2. Volume on sub pane.

Suggested default params:

1. MA: periods `[5, 10, 20, 60]`.
2. EMA: periods `[7, 25, 99]`.
3. BOLL: period `20`, multiplier `2`.
4. MACD: fast `12`, slow `26`, signal `9`.
5. RSI: periods `[6, 12, 24]`.
6. ATR: period `14`.
7. KDJ: period `9`, k `3`, d `3`.
8. Supertrend: atrPeriod `10`, multiplier `3`.
9. Volume: volume MA periods `[5, 10, 20]`.

Indicator calculations must be pure functions that accept normalized K-lines and params and return arrays aligned by K-line index. Rendering can register KLineCharts custom indicators or use adapter functions around KLineCharts indicator APIs.

## 9. Data Source Abstraction Design

### 9.1 Interfaces

```ts
interface MarketDataProvider {
  getSymbols(market: MarketType): Promise<SymbolInfo[]>;
  getKlines(request: KlineRequest): Promise<Kline[]>;
  getTicker24h(market: MarketType, symbols?: string[]): Promise<Ticker24h[]>;
  getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo>;
  createKlineStream(request: KlineStreamRequest): KlineStream;
}

interface ExchangeAdapter {
  market: MarketType;
  getSymbols(): Promise<SymbolInfo[]>;
  getKlines(request: KlineRequest): Promise<Kline[]>;
  getTicker24h(symbols?: string[]): Promise<Ticker24h[]>;
  findEarliestKlineOpenTime(symbol: string, interval: Interval): Promise<number | null>;
}

interface FuturesInfoProvider {
  getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo>;
}
```

```ts
interface KlineRequest {
  market: MarketType;
  symbol: string;
  interval: Interval;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

interface KlineStreamRequest {
  market: MarketType;
  symbol: string;
  intervals: Interval[];
  onKline: (kline: Kline) => void;
  onStateChange: (state: ConnectionState) => void;
  onError: (error: Error) => void;
}
```

### 9.2 Implementations

MVP direct provider:

1. `BinanceDirectMarketDataProvider`.
2. `BinanceSpotAdapter`.
3. `BinanceUsdMFuturesAdapter`.
4. `BinanceKlineStream`.

Future backend provider:

1. `BackendMarketDataProvider`.
2. Same interface as direct provider.
3. UI remains unchanged.

### 9.3 Binance Endpoint Mapping

Spot:

1. Symbols: `/api/v3/exchangeInfo`.
2. K-lines: `/api/v3/klines`.
3. 24h ticker: `/api/v3/ticker/24hr`.
4. WebSocket kline: `<symbol>@kline_<interval>`.

USD-M Futures:

1. Symbols: `/fapi/v1/exchangeInfo`.
2. K-lines: `/fapi/v1/klines`.
3. 24h ticker: `/fapi/v1/ticker/24hr`.
4. Mark price and funding info: `/fapi/v1/premiumIndex`.
5. WebSocket kline: `<symbol>@kline_<interval>`.

All REST adapters must normalize array-based K-line payloads into `Kline`.

### 9.4 Repository Layer

`KlineRepository` read order:

1. Query IndexedDB for requested range.
2. Detect missing ranges.
3. Fetch only missing ranges from provider.
4. Upsert fetched rows into cache.
5. Return merged, sorted, deduplicated rows.

`TickerRepository` read order:

1. Fetch latest tickers from provider.
2. Cache only short-lived in memory unless later persistence is needed.
3. Expose sorted leaderboard selectors.

## 10. WebSocket Reconnect And Backfill Plan

### 10.1 Stream Scope

Subscribe only to active market, active symbol and active chart intervals:

1. Left interval.
2. Right interval.

If both charts use the same interval, use one subscription.

### 10.2 Message Handling

For each incoming K-line:

1. Normalize into internal `Kline`.
2. Mark `isClosed` from stream close flag when available.
3. Upsert into the chart data set by `openTime`.
4. Upsert into IndexedDB.
5. If candle is closed, append it and prepare the next active candle.
6. Ignore older messages that would replace a newer `updatedAt`.

### 10.3 Reconnect Strategy

State machine:

```text
idle -> connecting -> connected -> reconnecting -> connected
                         |              |
                         v              v
                       error          offline
```

Reconnect plan:

1. On close or network error, set state to `reconnecting`.
2. Retry with exponential backoff plus jitter.
3. Start with 1 second delay.
4. Cap delay at 30 seconds.
5. Reset backoff after stable connection.
6. On reconnect, backfill each active interval from last cached open time minus one interval to now.
7. Deduplicate by `openTime`.

### 10.4 Backfill Rules

Backfill request per active interval:

1. Determine latest cached closed candle.
2. Request from `latestClosedOpenTime - intervalMs` to now.
3. Upsert REST rows.
4. Reapply the newest WebSocket row if it is newer.

This prevents gaps around disconnect windows and avoids out-of-order corruption.

### 10.5 Crosshair Link

Crosshair link algorithm:

1. Active chart emits hover timestamp.
2. Store `linkedCrosshairTimestamp` outside React hot render paths, preferably in a lightweight event bus or zustand selector with shallow updates.
3. Passive chart maps timestamp to nearest visible candle.
4. Passive chart moves crosshair without recursively emitting a new sync event.
5. Throttle with `requestAnimationFrame`.

## 11. K-Line Cache Queue Plan

### 11.1 Cache Trigger

When active market/symbol changes:

1. Ensure active left interval task exists with `active` priority.
2. Ensure active right interval task exists with `active` priority.
3. Enqueue all other supported intervals with `background` priority.
4. Existing complete intervals are skipped.
5. Existing partial intervals are resumed from missing ranges.

### 11.2 Earliest K-Line Discovery

For each market/symbol/interval:

1. Try stored `earliestKlineOpenTime`.
2. If missing, query provider with a very early `startTime` and `limit: 1`.
3. Store the returned first `openTime`.
4. If no row is returned, mark interval as unavailable for that symbol.

Spot and USD-M listing metadata is inconsistent across endpoints, so the earliest actual K-line is the cache boundary source of truth.

### 11.3 Chunking

Chunk size:

1. Spot: max 1000 K-lines per request.
2. USD-M Futures: max 1500 K-lines per request.

Time step:

```text
nextStartTime = lastReturnedOpenTime + intervalMs
```

For variable calendar intervals:

1. `1d`, `3d`, `1w`, `1M` should still rely on returned `openTime` rather than naive fixed month math.
2. The next request starts after the last returned candle open time.

### 11.4 Priority And Concurrency

Initial limits:

1. Global REST cache concurrency: 2.
2. Per-market concurrency: 1.
3. Active visible interval requests may preempt background tasks.
4. User-initiated visible chart requests are never queued behind long background cache work.

These values may be adjusted after measured performance and Binance limit behavior.

### 11.5 Missing Range Detection

For fixed-length intervals:

1. Sort cached candles by `openTime`.
2. Compare adjacent open times.
3. If gap exceeds expected interval duration, record missing range.

For `1M`:

1. Use returned K-line boundaries and cached range metadata.
2. Detect broad range holes from coverage ranges first.
3. Avoid assuming all months have equal milliseconds.

### 11.6 Storage Quota Handling

On quota error:

1. Mark active task `quota-paused`.
2. Pause queue.
3. Preserve completed data.
4. Show storage warning.
5. Link to cache management.
6. Never auto-delete K-lines or user config.

### 11.7 Cache Management Actions

Delete one interval cache:

1. Delete matching `klines`.
2. Delete matching `klineRanges`.
3. Cancel matching `cacheTasks`.
4. Do not delete indicators, drawings or watchlists.

Delete one symbol cache:

1. Delete all intervals for market/symbol from `klines`.
2. Delete all ranges for market/symbol.
3. Cancel all tasks for market/symbol.
4. Preserve user configuration.

Clear all K-line cache:

1. Clear `klines`.
2. Clear `klineRanges`.
3. Cancel or reset `cacheTasks`.
4. Preserve settings, watchlists, drawings and indicators.

## 12. Development Milestone Plan

The project will follow the milestones defined in `KLINEFORGE_GOAL.md`.

### 12.1 Milestone 1: Scaffold And Tooling

Planned work:

1. Create Vite React TypeScript app.
2. Add lint, typecheck, test and build scripts.
3. Add basic i18n, state and persistence foundations.
4. Add Dockerfile and docs skeleton.

Gate commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

### 12.2 Milestone 2: Data Models And Binance Adapters

Planned work:

1. Implement types and adapters.
2. Normalize Spot and Futures payloads.
3. Add tests for conversion, market handling and interval validation.

### 12.3 Milestone 3: IndexedDB K-Line Cache

Planned work:

1. Implement storage schema.
2. Implement cache read/write.
3. Implement missing range detection and completeness logic.
4. Add tests.

### 12.4 Milestone 4: App Shell, Layout And Settings

Planned work:

1. Desktop layout.
2. Collapsible sidebar.
3. Settings panel.
4. Persistence.
5. Browser screenshot verification.

### 12.5 Milestone 5: KLineCharts Integration

Planned work:

1. Mount left and right charts.
2. Load default BTCUSDT USD-M Futures 5m and 1h.
3. Link crosshair.
4. Verify non-blank charts in browser.

### 12.6 Milestone 6: Real-Time WebSocket Updates

Planned work:

1. Subscribe to active K-line streams.
2. Update current candles.
3. Reconnect and backfill.
4. Verify no duplicate candles.

### 12.7 Milestone 7: Watchlist, Search And Leaderboards

Planned work:

1. Symbol search.
2. Leaderboards.
3. Watchlist persistence and reordering.
4. Browser verification.

### 12.8 Milestone 8: Cache Queue And Cache Management

Planned work:

1. Full interval background cache.
2. Progress and task controls.
3. Cache management page.
4. Storage quota behavior.

### 12.9 Milestone 9: Indicators

Planned work:

1. Implement indicator calculation modules.
2. Implement indicator UI and persistence.
3. Render on main and sub panes.
4. Test all calculations.

### 12.10 Milestone 10: Drawing Tools

Planned work:

1. Drawing toolbar.
2. Core drawings.
3. Style edit, lock, hide, delete.
4. Undo/redo.
5. Persistence and browser verification.

### 12.11 Milestone 11: Export And Import

Planned work:

1. Chart PNG export.
2. K-line CSV export.
3. Config JSON import/export with validation.
4. Browser verification.

### 12.12 Milestone 12: Documentation, Polish And Final Verification

Planned work:

1. Complete docs.
2. Run final test suite.
3. Run browser visual checks.
4. Verify Docker static serving.
5. Confirm no scope violations.

## 13. Verification For Milestone 0

Milestone 0 has no application code and no package scripts yet. The applicable verification is document coverage and scope compliance.

Manual checks:

1. This file contains product module design.
2. This file contains page structure.
3. This file contains component structure.
4. This file contains data model draft.
5. This file contains IndexedDB schema draft.
6. This file contains drawing schema draft.
7. This file contains indicator config schema draft.
8. This file contains data source abstraction design.
9. This file contains WebSocket reconnect and backfill plan.
10. This file contains K-line cache queue plan.
11. This file contains development milestone plan.
12. No application code was added.
13. MVP non-goals are preserved.

`npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` are intentionally not run in Milestone 0 because the project has not been scaffolded yet. These commands must be created and enforced in Milestone 1.

## 14. Source Notes

Implementation should verify current API details during later milestones. Milestone 0 used these primary references:

1. Binance Spot market data endpoints for `/api/v3/klines` and `/api/v3/ticker/24hr`.
2. Binance USD-M Futures K-line endpoint for `/fapi/v1/klines`.
3. Binance Spot WebSocket kline streams.
4. Binance USD-M Futures WebSocket kline streams.
5. KLineCharts indicator and overlay documentation.
