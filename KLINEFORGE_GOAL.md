# KLineForge Goal Specification

Project name: **KLineForge**

English subtitle:

> Open-source crypto charting, indicators and multi-timeframe analysis platform.

Chinese subtitle:

> 开源的加密货币看盘、画图与自定义指标平台。

## Recommended Codex Goal

Use this short goal text in Codex Goal mode:

```text
Implement the KLineForge MVP according to KLINEFORGE_GOAL.md. Work milestone by milestone, keep scope frozen, and do not advance past any milestone until its required tests, build checks, and acceptance criteria pass.
```

If `/goal` is unavailable in Codex, enable the feature first:

```bash
codex features enable goals
```

## Final Objective

Build **KLineForge**, a desktop-first, open-source, pure frontend crypto charting and technical analysis platform for Binance Spot and Binance USD-M Futures.

The MVP must provide:

1. Binance Spot and USD-M Futures market data.
2. Left/right dual-chart multi-timeframe viewing.
3. Real-time K-line updates.
4. Time-linked crosshair between the two charts.
5. Watchlist with add, delete, reorder and local persistence.
6. Symbol search with gainers, losers and quote-volume leaderboards.
7. Core drawing tools.
8. Built-in indicators.
9. Full local multi-interval K-line cache.
10. Cache management page.
11. Local settings and layout persistence.
12. Config import/export.
13. K-line CSV export.
14. Chart PNG export.
15. Chinese and English UI.
16. Basic docs and tests.
17. Dockerfile for static Nginx deployment.

The MVP is complete only when all acceptance gates in this file pass.

## Scope Freeze

Do not implement these features in the MVP:

1. Real order placement.
2. Binance API key management.
3. Account assets, positions, orders or PnL.
4. User account system.
5. Cloud sync.
6. Order book.
7. Latest trades panel.
8. Alerts.
9. Custom indicator editor.
10. Pine Script or TradingView indicator import.
11. Multiple workspaces.
12. 2x2 or freeform multi-chart layouts.
13. Tick, raw trade or aggTrade storage.
14. Backend service.
15. Binance COIN-M Futures.
16. Exchanges other than Binance.

If a later implementation step seems to require one of these features, stop and report the reason instead of expanding scope silently.

## Technology Stack

Use:

1. React.
2. TypeScript.
3. Vite.
4. KLineCharts for high-performance Canvas K-line charting.
5. Zustand for frontend state.
6. IndexedDB for K-line cache, drawings, watchlists and indicator configuration. Dexie may be used as a wrapper.
7. localStorage only for small preferences and launch state.
8. fetch and WebSocket for Binance public market data.
9. CSS Variables plus CSS Modules or an equivalent lightweight styling approach.
10. Vitest for unit tests.
11. Playwright for browser-level checks where UI behavior must be verified.
12. Dockerfile using Nginx to serve the production static build.

Performance rules:

1. React must not render K-line candles directly.
2. Chart rendering must be handled by the Canvas chart layer.
3. WebSocket updates must not trigger full-page re-renders.
4. IndexedDB reads and writes must be asynchronous, batched where needed and non-blocking.
5. Background cache jobs must run at lower priority than active chart interaction.
6. Indicator calculation must be modular and ready for future Web Worker execution.

## Default Startup State

On first launch:

1. Market: Binance USD-M Futures.
2. Symbol: BTCUSDT.
3. Left chart interval: 5m.
4. Right chart interval: 1h.
5. Theme: dark.
6. Price color mode: green up, red down.
7. Language: Chinese when browser language is Chinese, otherwise English.

On later launches, restore:

1. Last market.
2. Last symbol.
3. Left chart interval.
4. Right chart interval.
5. Theme.
6. Language.
7. Price color mode.
8. Sidebar collapsed or expanded state.
9. Per-chart indicator configuration.
10. Chart preference settings.

## Supported Markets

Support:

1. Binance Spot.
2. Binance USD-M Futures.

Do not support in MVP:

1. Binance COIN-M Futures.
2. OKX.
3. Bybit.
4. Gate.
5. Bitget.
6. Other exchanges.

## Supported Intervals

Support these intervals:

1. 1m.
2. 3m.
3. 5m.
4. 15m.
5. 30m.
6. 1h.
7. 2h.
8. 4h.
9. 6h.
10. 8h.
11. 12h.
12. 1d.
13. 3d.
14. 1w.
15. 1M.

Do not support 1s in MVP.

## Product Layout

The main screen is:

```text
+------------------+----------------------+----------------------+
| collapsible      | left chart           | right chart          |
| watchlist/search | same symbol, 5m      | same symbol, 1h      |
| sidebar          | or selected interval | or selected interval |
+------------------+----------------------+----------------------+
```

Left sidebar:

1. Spot / USD-M Futures market switch.
2. Symbol search entry.
3. Watchlist.
4. Cache status entry.
5. Settings entry.

Main area:

1. Top market information bar.
2. Left K-line chart.
3. Right K-line chart.
4. Vertical drawing toolbar on chart left side.
5. Per-chart interval switch.
6. Per-chart indicator button.
7. Per-chart screenshot button.
8. Per-chart fullscreen button.

Dual-chart rules:

1. Both charts always use the same market and symbol in MVP.
2. Each chart may use a different interval.
3. Switching symbol switches both charts.
4. Crosshair time is linked between both charts.
5. Both charts update in real time.
6. Indicator configuration is independent per chart.
7. Drawing data is independent per chart.
8. Left and right charts cannot select different symbols in MVP.

Single-chart fullscreen:

1. The active chart can enter fullscreen inside the app.
2. Shortcut: F.
3. Esc or the exit button restores dual-chart mode.
4. Fullscreen must preserve interval controls, indicators, drawing tools, screenshot export and real-time updates.

## Market Information Bar

Spot displays:

1. Symbol.
2. Last price.
3. 24h price change percentage.
4. 24h high.
5. 24h low.
6. 24h base volume.
7. 24h quote volume.

USD-M Futures additionally displays:

1. Funding rate.
2. Next funding time.
3. Mark price.
4. Index price.

## Watchlist

Watchlist requirements:

1. Add symbol.
2. Delete symbol.
3. Drag to reorder.
4. Persist locally.
5. Click item to switch the active symbol.
6. Keep Spot and USD-M Futures watchlists separate.

Watchlist row fields:

1. Symbol.
2. Latest price.
3. 24h change percentage.

## Symbol Search And Leaderboards

The symbol search panel must support:

1. Searching symbols.
2. Switching Spot / USD-M Futures context.
3. Gainers leaderboard.
4. Losers leaderboard.
5. Quote-volume leaderboard.
6. Adding a symbol to watchlist.
7. Switching the active symbol.

Leaderboard fields:

1. Symbol.
2. Latest price.
3. 24h change percentage.
4. 24h quote volume.

Do not build a general command palette in MVP.

## Indicators

MVP supports only built-in indicators. Do not implement custom indicator editing, Pine Script import, TradingView import or source-code editing.

Main-chart indicators:

1. MA.
2. EMA.
3. BOLL.
4. Supertrend.

Sub-chart indicators:

1. Volume.
2. MACD.
3. RSI.
4. ATR.
5. KDJ.

Default:

1. Main chart: MA.
2. Sub chart: Volume.

Indicator panel:

1. Open from an "Indicators" button.
2. Group by main-chart and sub-chart indicators.
3. Search by indicator name.
4. Add to active chart.
5. Delete from active chart.
6. Hide or show.
7. Edit parameters.
8. Edit colors.
9. Edit line width.
10. Persist left and right chart indicator configs independently.

## Drawing Tools

Use a vertical drawing toolbar on the chart left side.

Tools:

1. Select / cursor.
2. Trend line.
3. Horizontal line.
4. Vertical line.
5. Rectangle.
6. Text.
7. Measurement tool.
8. Delete.
9. Undo.
10. Redo.

Drawing rules:

1. Drawing tools operate on the active chart.
2. Drawing anchors must be stored as timestamp plus price, never screen coordinates.
3. Left and right chart drawings are independent.
4. Drawings are not shared across intervals in MVP.
5. No drawing object manager in MVP.
6. Drawings persist locally and restore after reload.

Supported drawing operations:

1. Create.
2. Select.
3. Move.
4. Drag endpoints.
5. Delete.
6. Lock.
7. Hide.
8. Edit style.
9. Edit text content.

Drawing style fields:

1. Line color.
2. Line width.
3. Line style: solid or dashed.
4. Opacity.
5. Text color.
6. Text size.
7. Rectangle fill opacity.

Undo and redo apply only to drawing operations:

1. Create drawing.
2. Delete drawing.
3. Move drawing.
4. Adjust endpoints.
5. Edit style.
6. Edit text.

Undo and redo must not apply to:

1. Symbol switching.
2. Interval switching.
3. Indicator changes.
4. Theme changes.
5. Language changes.
6. Watchlist changes.
7. Cache deletion.

## Chart Settings

Create a basic chart settings panel.

Settings:

1. Theme: dark / light.
2. Language: Chinese / English.
3. Price color mode: green up red down / red up green down.
4. Chart style: candle / hollow candle / line.
5. Grid lines: show / hide.
6. Latest price line: show / hide.
7. Crosshair: show / hide.
8. Sidebar: expanded / collapsed.

All settings must persist locally.

## Keyboard Shortcuts

Implement:

1. `/`: open symbol search.
2. Esc: close dialog, cancel current drawing, or exit fullscreen.
3. Delete / Backspace: delete selected drawing.
4. Ctrl+Z / Cmd+Z: undo drawing operation.
5. Ctrl+Y / Cmd+Shift+Z: redo drawing operation.
6. F: toggle active chart fullscreen.
7. H: horizontal line tool.
8. T: trend line tool.
9. R: rectangle tool.
10. V: vertical line tool.
11. M: measurement tool.

Shortcuts must not fire while the user is typing in inputs, textareas or editable code/text fields.

## K-Line Cache

MVP must implement full local multi-interval K-line caching. Do not store Tick, raw trade or aggTrade data.

Cache behavior:

1. When a symbol is opened, the current left and right chart intervals load first.
2. In the background, cache all supported intervals for that market and symbol.
3. Cache range is from the symbol listing time or earliest available K-line to current time.
4. Background caching must not block current chart display.
5. Cache jobs must limit request concurrency.
6. Cache jobs must support retry.
7. Cache jobs must support pause and resume.
8. Cache jobs must show progress.
9. Cache jobs must detect completeness.
10. Cache jobs must detect missing ranges and repair them.
11. K-line data is stored in IndexedDB.

Cache priority:

1. Show current left and right charts as soon as possible.
2. Fill current left and right interval history.
3. Cache all remaining intervals in the background.

When local storage quota is insufficient:

1. Do not auto-delete data.
2. Pause background cache tasks.
3. Preserve existing cached data.
4. Show a storage warning.
5. Provide a cache management entry.
6. Let the user delete cache manually.

## Cache Management Page

Build a cache management page.

Display:

1. Market.
2. Symbol.
3. Interval.
4. Cached start time.
5. Cached end time.
6. Completeness.
7. Status: not started / caching / complete / failed / paused.
8. Estimated size.
9. Last updated time.

Actions:

1. Pause cache.
2. Resume cache.
3. Retry failed task.
4. Delete one symbol cache.
5. Delete one interval cache.
6. Clear all K-line cache.

Manual deletion must never remove user settings, watchlists, drawings or indicator configuration unless the user explicitly imports or resets configuration.

## Export Features

### Chart PNG Export

Support:

1. Export left chart.
2. Export right chart.
3. Export active fullscreen chart.
4. Format: PNG.
5. Include K-lines, indicators, drawings, symbol, interval and time information.

### K-Line CSV Export

Support:

1. Select market.
2. Select symbol.
3. Select interval.
4. Select time range.
5. Export from local cache first.
6. If the selected range is incomplete, prompt the user to fill cache first.

CSV fields:

1. openTime.
2. open.
3. high.
4. low.
5. close.
6. volume.
7. closeTime.
8. quoteVolume.
9. tradeCount.
10. takerBuyBaseVolume.
11. takerBuyQuoteVolume.
12. market.
13. symbol.
14. interval.

## Configuration Import And Export

Support JSON import/export.

Export:

1. Watchlists.
2. Drawings.
3. Left and right chart indicator configs.
4. Theme setting.
5. Language setting.
6. Price color setting.
7. Last page state.
8. Chart preference settings.

Do not export:

1. K-line cache.
2. Market data.
3. Temporary WebSocket state.
4. Running cache task state.

Export schema:

```json
{
  "schemaVersion": 1,
  "app": "KLineForge",
  "exportedAt": "2026-06-09T00:00:00.000Z",
  "data": {}
}
```

Import must validate schema version and reject malformed or incompatible files with a clear user-facing error.

## Internationalization

Support Chinese and English.

Rules:

1. All UI strings must use i18n.
2. Do not hard-code Chinese or English strings inside components.
3. Chinese browser language defaults to Chinese.
4. Other browser languages default to English.
5. Manual language selection persists locally.
6. README must be bilingual.
7. Docs should be bilingual or English-first with Chinese explanations.

## Documentation

Create:

1. README.md.
2. docs/development.md.
3. docs/cache.md.
4. docs/architecture.md.

Documentation must cover:

1. Project introduction.
2. English and Chinese subtitles.
3. MVP scope.
4. Explicit non-goals.
5. Technology stack.
6. Local development.
7. Production build.
8. Docker deployment.
9. Binance data source notes.
10. K-line cache mechanism.
11. Local persistence.
12. Indicator system.
13. Drawing data model.
14. CSV export.
15. Contribution notes.

## Code Rules

1. Use English for code names, variables, functions, types and filenames.
2. Use English comments only when comments are necessary.
3. Keep comments short and useful.
4. All user-facing UI text must go through i18n.
5. Local persisted data schemas must include a schema version.
6. Do not place Binance request logic in React UI components.
7. Do not save drawings as screen coordinates.
8. Do not let background caching block active chart interaction.
9. Do not implement real trading.
10. Do not silently expand scope.

## Data Model Requirements

Design schemas before implementation.

Required schema families:

1. Market type.
2. Symbol metadata.
3. K-line row.
4. Ticker row.
5. Futures mark/funding information.
6. Cache task.
7. Cache coverage range.
8. Watchlist.
9. Drawing object.
10. Indicator config.
11. Chart settings.
12. Last session state.
13. Exported config.

K-line data must retain:

1. openTime.
2. open.
3. high.
4. low.
5. close.
6. volume.
7. closeTime.
8. quoteVolume.
9. tradeCount.
10. takerBuyBaseVolume.
11. takerBuyQuoteVolume.
12. market.
13. symbol.
14. interval.

## Data Source Architecture

Do not couple UI components directly to Binance endpoints.

Create abstractions such as:

1. MarketDataProvider.
2. ExchangeAdapter.
3. BinanceSpotAdapter.
4. BinanceUsdMFuturesAdapter.
5. KlineRepository.
6. TickerRepository.
7. FuturesInfoProvider.
8. IndexedDbKlineCache.
9. BinanceDirectMarketDataProvider.

Future backend migration should require adding a BackendMarketDataProvider rather than rewriting UI.

## WebSocket Requirements

Real-time chart updates must:

1. Subscribe to the active symbol and active intervals.
2. Update the currently forming K-line.
3. Append newly closed K-lines.
4. Reconnect automatically after disconnection.
5. Backfill missing K-lines after reconnect.
6. Display connection state.
7. Avoid duplicate rows.
8. Avoid out-of-order corruption.

## Strict Testing Policy

Every milestone must pass its own tests before moving forward.

Never mark a milestone complete when:

1. Tests are skipped without explanation.
2. Build fails.
3. Type checks fail.
4. Lint fails when lint is configured.
5. Browser verification is required but not performed.
6. A known bug is left untracked.
7. The implementation silently changes project scope.

When tests cannot be run, record:

1. Which command could not be run.
2. Why it could not be run.
3. What risk remains.
4. What manual verification was done instead.

Preferred verification commands after the project is scaffolded:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

If a command does not exist yet, create it during the appropriate milestone instead of relying on ad hoc checks.

## Required Test Coverage

Unit tests must cover:

1. Binance K-line data conversion.
2. Spot / USD-M Futures market type handling.
3. Interval parsing and validation.
4. K-line cache write.
5. K-line cache read.
6. Cache missing-range detection.
7. Cache completeness calculation.
8. MA calculation.
9. EMA calculation.
10. BOLL calculation.
11. MACD calculation.
12. RSI calculation.
13. ATR calculation.
14. KDJ calculation.
15. Supertrend calculation.
16. Config export schema validation.
17. Config import schema validation.
18. Drawing serialization.
19. Drawing deserialization.

Browser or integration tests should cover:

1. App launches without console errors.
2. Default screen shows USD-M BTCUSDT dual charts.
3. Left chart default interval is 5m.
4. Right chart default interval is 1h.
5. Sidebar can collapse and expand.
6. Symbol search opens.
7. Watchlist item can be added and persists after reload.
8. Settings can switch theme and price color mode.
9. Active chart fullscreen toggles and exits.
10. Cache management page renders.

Visual verification is required for chart UI milestones:

1. Run the dev server.
2. Open the app in a browser.
3. Capture desktop screenshots.
4. Verify charts are non-blank.
5. Verify text does not overlap.
6. Verify controls fit their containers.
7. Verify dark and light themes are legible.

## Milestones And Gates

### Milestone 0: Project Design And Repo Plan

Deliver:

1. Product module design.
2. Page structure.
3. Component structure.
4. Data model draft.
5. IndexedDB schema draft.
6. Drawing schema draft.
7. Indicator config schema draft.
8. Data source abstraction design.
9. WebSocket reconnect and backfill plan.
10. K-line cache queue plan.
11. Development milestone plan.

Gate:

1. No application code beyond docs and planning unless needed for project bootstrap.
2. Design must explicitly preserve all MVP scope rules.
3. User or goal owner can inspect and approve the plan before implementation continues.

### Milestone 1: Scaffold And Tooling

Deliver:

1. Vite + React + TypeScript project.
2. Package scripts.
3. Typecheck command.
4. Lint command.
5. Test command.
6. Build command.
7. Basic app shell.
8. i18n foundation.
9. Zustand store foundation.
10. IndexedDB/Dexie foundation.
11. Dockerfile with Nginx static serving.
12. Initial README and docs skeleton.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Gate:

1. All commands pass.
2. Production build exists.
3. App can start locally.

### Milestone 2: Data Models And Binance Adapters

Deliver:

1. Market and interval types.
2. Binance Spot adapter.
3. Binance USD-M Futures adapter.
4. K-line REST fetching.
5. Ticker fetching.
6. Futures funding/mark/index info fetching.
7. Data normalization into internal models.
8. Unit tests for conversion and validation.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Gate:

1. Unit tests prove Spot and Futures K-line conversion.
2. Unit tests prove interval validation.
3. UI components do not call Binance endpoints directly.

### Milestone 3: IndexedDB K-Line Cache

Deliver:

1. K-line storage schema.
2. Cache coverage schema.
3. Cache write/read APIs.
4. Missing-range detection.
5. Completeness calculation.
6. Cache repair planning.
7. Unit tests for cache logic.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Gate:

1. Cache can store and retrieve K-lines by market, symbol, interval and time range.
2. Missing ranges are detected correctly.
3. No duplicate K-lines for same market, symbol, interval and openTime.

### Milestone 4: App Shell, Layout And Settings

Deliver:

1. Desktop-first layout.
2. Collapsible left sidebar.
3. Top market information bar placeholder.
4. Dual-chart container.
5. Settings panel.
6. Dark/light themes.
7. Green-up/red-down and red-up/green-down modes.
8. Chinese/English switch.
9. Last-session persistence.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Launch dev server.
2. Capture screenshot at desktop viewport.
3. Verify no obvious overlap.
4. Verify theme switching.
5. Verify sidebar collapse/expand.

Gate:

1. Desktop UI is usable.
2. Settings persist after reload.
3. i18n works for visible shell text.

### Milestone 5: KLineCharts Integration

Deliver:

1. KLineCharts mounted in both left and right chart panes.
2. Default BTCUSDT USD-M Futures charts.
3. Left default interval 5m.
4. Right default interval 1h.
5. Historical K-lines loaded from cache or Binance.
6. Basic zoom and pan behavior.
7. Time-linked crosshair.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Charts render non-blank.
2. Left chart shows 5m.
3. Right chart shows 1h.
4. Crosshair link works by time.
5. No layout overlap in dark theme.
6. No layout overlap in light theme.

Gate:

1. Both charts render real Binance K-line data.
2. React does not re-render the full app on every chart tick.

### Milestone 6: Real-Time WebSocket Updates

Deliver:

1. Active K-line WebSocket subscriptions.
2. Current candle updates.
3. Closed candle append.
4. Connection state display.
5. Auto reconnect.
6. REST backfill after reconnect.
7. Duplicate and out-of-order protection.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Live price/K-line updates occur.
2. Connection status is visible.
3. Forced reconnect does not duplicate candles.

Gate:

1. Real-time updates work for Spot.
2. Real-time updates work for USD-M Futures.

### Milestone 7: Watchlist, Search And Leaderboards

Deliver:

1. Symbol search panel.
2. Spot/Futures search context.
3. Gainers leaderboard.
4. Losers leaderboard.
5. Quote-volume leaderboard.
6. Watchlist add/delete/reorder.
7. Watchlist local persistence.
8. Watchlist live price and 24h change.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Search opens with `/`.
2. Search switches symbol.
3. Watchlist add works.
4. Watchlist persists after reload.
5. Reorder persists after reload.

Gate:

1. Switching symbol updates both charts.
2. Left and right intervals remain unchanged after symbol switch.

### Milestone 8: Cache Queue And Cache Management

Deliver:

1. Background cache queue.
2. Full interval caching for opened symbol.
3. Concurrency limits.
4. Pause/resume.
5. Retry failed tasks.
6. Progress display.
7. Storage quota handling.
8. Cache management page.
9. Manual cache deletion.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Cache progress appears.
2. Cache management page renders.
3. Pause/resume works.
4. Manual delete does not delete settings or drawings.

Gate:

1. Active chart remains responsive while background cache runs.
2. Cache tasks do not start unlimited Binance requests.

### Milestone 9: Indicators

Deliver:

1. Indicator calculation modules.
2. MA.
3. EMA.
4. BOLL.
5. Supertrend.
6. Volume.
7. MACD.
8. RSI.
9. ATR.
10. KDJ.
11. Indicator add/search panel.
12. Per-chart indicator configs.
13. Parameter/color/line width editing.
14. Indicator persistence.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Gate:

1. All indicator calculation unit tests pass.
2. Indicators render on correct main or sub chart area.
3. Left/right chart indicator configs remain independent.

### Milestone 10: Drawing Tools

Deliver:

1. Vertical drawing toolbar.
2. Trend line.
3. Horizontal line.
4. Vertical line.
5. Rectangle.
6. Text.
7. Measurement tool.
8. Select/edit behavior.
9. Move and endpoint editing.
10. Style editing.
11. Lock.
12. Hide.
13. Delete.
14. Undo/redo for drawing operations only.
15. Drawing persistence.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Create each drawing type.
2. Move and edit drawings.
3. Reload and verify drawings restore.
4. Verify drawing anchors remain time/price based after pan/zoom.
5. Verify undo/redo.
6. Verify locked drawings cannot be edited.
7. Verify hidden drawings disappear without deletion.

Gate:

1. Drawing storage never uses screen coordinates as primary anchors.
2. Left/right chart drawings remain independent.

### Milestone 11: Export And Import

Deliver:

1. Chart PNG export.
2. K-line CSV export.
3. Config JSON export.
4. Config JSON import.
5. Schema validation and user-facing errors.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Export PNG from left chart.
2. Export PNG from right chart.
3. Export CSV from cached range.
4. Export config JSON.
5. Import config JSON.
6. Malformed import is rejected clearly.

Gate:

1. Config export excludes K-line cache.
2. CSV export warns when selected range is incomplete.

### Milestone 12: Documentation, Polish And Final Verification

Deliver:

1. Complete README.md.
2. Complete docs/development.md.
3. Complete docs/cache.md.
4. Complete docs/architecture.md.
5. Final UI polish.
6. Final performance check.
7. Final Docker build check.

Required tests:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Required browser verification:

1. Desktop dark theme screenshot.
2. Desktop light theme screenshot.
3. Default launch state screenshot.
4. Dual-chart screenshot.
5. Cache management screenshot.
6. Settings screenshot.
7. No visible text overlap.
8. Charts are non-blank.

Final acceptance:

1. All required commands pass.
2. All milestone acceptance criteria are satisfied.
3. README and docs explain the MVP and non-goals.
4. No MVP scope violations were added.
5. The app can be run locally.
6. The app can be built for production.
7. The static production build can be served by Docker/Nginx.

## Completion Rule

Only mark the Codex goal complete when:

1. The implemented application satisfies the final objective.
2. Every milestone gate is satisfied.
3. The full final verification suite passes.
4. Any unavoidable limitations are documented.
5. No required work remains.

If the project becomes blocked, record the exact blocker, the repeated failed attempts and the smallest user decision needed to continue.
