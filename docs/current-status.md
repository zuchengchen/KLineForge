# Current Status

This page summarizes the active `v0.1.0-tauri` desktop slice.

| Area | Status | Notes |
| --- | --- | --- |
| Tauri desktop shell | Complete | Tauri 2 config and Rust entrypoint are active. |
| Solid UI shell | Complete | Dense desktop workspace, sidebar, toolbar and dock panels. |
| Binance Spot market | Complete | REST K-line, symbol list, market info and live kline smoke path exist. |
| Binance USD-M Futures market | Complete | Default market, REST K-line, mark/index/funding and live kline smoke path exist. |
| Dual-chart layout | Complete | Two Lightweight Charts panes render side by side. |
| Independent intervals | Complete | Left and right interval controls are separate. |
| Historical K-line load | Complete | Rust REST fetch plus SQLite write/read path. |
| Live WebSocket updates | Complete | Rust supervises one Binance kline stream per chart and emits `kline://update` events. |
| Time-linked crosshair | Complete | Crosshair time is bridged between panes while zoom/pan stays independent. |
| Watchlist | Complete | SQLite-backed seeding, reading, add, remove and reorder. |
| Symbol search and leaderboards | Complete | Rust symbol list and 24h leaderboards with compact Solid UI. |
| Market info bar | Complete | 24h ticker plus USD-M mark/index/funding display. |
| Built-in indicators | Complete | Rust calculates Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend. |
| Indicator instances | Complete | Per-chart interval instances support add/edit/delete, enable state, parameters and styles. |
| Drawing tools | Partial | Creation/loading/deletion covers horizontal line, trend line, vertical line, rectangle, text and measurement annotations. Rich editing remains future work. |
| Cache management | Partial | Summary, current-symbol clear and per cached interval clear actions are implemented. Full range task controls remain future work. |
| Chart PNG export | Complete | Screenshot export is wired for both panes. |
| K-line CSV export | Complete | Rust exports the current chart request. |
| Config import/export | Complete | Current JSON schema covers settings, watchlist, drawings and indicator instances. |
| Themes | Complete | Dark/light control implemented. |
| Session restore | Complete | Settings persist through SQLite. |
| Chinese/English UI | Complete | Bilingual dictionary exists for the current shell. |
| CI | Partial | Workflow runs frontend/Rust/Tauri checks, prepares 100k archive data and runs render plus 100k chart smoke. |
| Performance benchmark | Complete | Archive-based benchmark paths exist for 100k and 1M rows. |

Core viewing capabilities that must not be removed without approval: Binance public data, dual charts, interval switching, live updates, pan/zoom, indicators, local cache, export/import and Chinese/English UI.

## Latest Performance Evidence

Local artifacts under `artifacts/performance/`:

| Scenario | Rows | Data source | Chart behavior |
| --- | ---: | --- | --- |
| 100k full interaction | 100,000 | Binance Public Data monthly archive | Full rows, indicators, drawing, PNG and CSV workflows |
| 1M basic browsing | 1,000,000 | Binance Public Data monthly archive | LOD to a smaller rendered candle set per pane, overlay indicators best effort |
| Production render smoke | 1,000 default rows | Preview-generated browser data or Tauri data in desktop runtime | Dual Lightweight Charts panes |

Accepted first-stage limits: richer drawing editing, full range-completeness cache task UI and 1M overlay indicators as a non-gating best-effort path.
