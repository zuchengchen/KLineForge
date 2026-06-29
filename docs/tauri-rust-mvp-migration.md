# Tauri/Rust MVP Migration Checklist

Status values:

- `Complete`: implemented in the Tauri/Rust/Solid architecture.
- `Degraded`: present with an accepted first-stage limitation.
- `Pending`: still needs migration.
- `Blocked`: cannot proceed without a decision.

| Feature | Status | Notes |
| --- | --- | --- |
| Tauri desktop shell | Complete | Tauri 2 config and Rust entrypoint added. |
| Solid UI shell | Complete | Dense desktop workspace, sidebar, toolbar and dock panels. |
| Binance Spot market | Complete | REST K-line, symbol list, market info and live kline smoke passed. |
| Binance USD-M Futures market | Complete | Default market, REST K-line, mark/index/funding and live kline smoke passed. |
| Dual-chart layout | Complete | Two Lightweight Charts panes are rendered. |
| Independent intervals | Complete | Left and right interval controls are separate. |
| Historical K-line load | Complete | Rust REST fetch plus SQLite write/read path implemented. |
| Live WebSocket updates | Complete | Rust supervises one Binance kline stream per chart and emits `kline://update` events to Solid. |
| Time-linked crosshair | Complete | Lightweight Charts crosshair and visible logical range are bridged between panes. |
| Watchlist | Complete | SQLite-backed watchlist seeding, reading, add, remove and reorder implemented. |
| Symbol search and leaderboards | Complete | Rust symbol list and 24h leaderboards are implemented with compact Solid UI. |
| Market info bar | Complete | Rust 24h ticker plus USD-M mark/index/funding command and toolbar display implemented. |
| Built-in indicators | Complete | Rust calculates MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend. |
| Indicator configuration | Degraded | Global MA/EMA/BOLL/Supertrend visibility toggles persist in settings; full per-chart parameter/style editor pending. |
| Drawing tools | Degraded | SQLite-backed horizontal-line creation/loading/deletion is implemented. Advanced trend/rectangle/text editing remains degraded. |
| Local cache management | Degraded | SQLite K-line cache summary and clear-current-symbol UI implemented; range completeness/tasks pending. |
| Chart PNG export | Complete | Lightweight Charts screenshot export is wired for left and right panes. |
| K-line CSV export | Complete | Rust exports current request from SQLite or fetches latest data before returning CSV content. |
| Config import/export | Complete | New-schema settings, watchlist and drawings JSON import/export implemented. Old config compatibility intentionally out of scope. |
| Themes | Complete | Dark/light control implemented. |
| Session restore | Complete | Settings command persists app settings in SQLite. |
| Chinese/English UI | Complete | Lightweight bilingual dictionary implemented for the new shell. |
| CI | Degraded | Workflow runs frontend/Rust/Tauri checks, prepares 100k real archive data and runs render plus 100k chart smoke. Remote GitHub execution has not been observed locally. |
| Performance benchmark | Complete | Real Binance Public Data archive benchmarks exist for 100k and 1M rows. Scripted chart interaction passed for 100k full workflow and 1M LOD basic browsing. |

The core viewing capabilities that must not be removed without asking are Binance public data, dual charts, interval switching, live updates, pan/zoom, indicators, local cache, export/import and Chinese/English UI.

## Latest Performance Evidence

Local artifacts under `artifacts/performance/`:

| Scenario | Rows | Data source | Chart behavior | Result |
| --- | ---: | --- | --- | --- |
| 100k full interaction | 100,000 | Binance Public Data monthly archive | Full rows, indicators, drawing, PNG and CSV workflows | Passed |
| 1M basic browsing | 1,000,000 | Binance Public Data monthly archive | LOD to 142,858 rendered candles per pane, indicators omitted | Passed |
| Production render smoke | 1,000 default rows | Preview-generated browser data or Tauri data in desktop runtime | Dual Lightweight Charts panes | Passed |

First-stage accepted degradations remain: per-chart indicator parameter/style editing, advanced drawing tools beyond horizontal lines, and full range-completeness cache task UI.
