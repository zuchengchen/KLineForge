# K-Line Cache

KLineForge stores local multi-interval K-line history in SQLite through the Rust backend. The desktop UI exposes cache summary, current-symbol clear, per cached market/symbol/interval clear actions and full-history download task controls.

## Goals

1. Show the active left and right charts quickly.
2. Persist K-line history locally for repeat viewing and CSV export.
3. Keep cache reads and writes bounded so active chart interaction stays responsive.
4. Download exchange-available full history in background tasks after interval changes.
5. Let users cancel, retry and inspect cache tasks.
6. Keep benchmark dataset generation separate from normal chart interaction.

## SQLite Tables

K-line and cache metadata tables live in `src-tauri/migrations/`.

Important tables:

1. `klines`
2. `kline_ranges`
3. `cache_tasks`
4. `metadata`

Settings, watchlists, drawings and indicator instances use separate tables and must not be removed by K-line-only clear actions.

## Stored K-Line Fields

Each K-line row stores market, symbol, interval, open time, OHLC values, volume, close time, quote volume, trade count, taker buy volumes, close state, source and update time.

The logical key is market + symbol + interval + open time, so duplicate candles are upserted.

## Read Path

Chart history first reads SQLite. A cache hit must contain enough rows for the requested limit. If the local window is too small, Rust fetches the larger range, writes it, and then returns the refreshed result.

This keeps large-chart verification from being blocked by a short local window.

## Full-History Tasks

After a chart interval changes, the desktop app keeps the normal chart request fast and enqueues full-history tasks for the switched interval plus the large-period prefetch intervals. The queue runs at most two tasks concurrently.

Task state is stored in `cache_tasks`. The current implementation uses one task per market/symbol/interval scope, with detailed progress in `payload_json`. Interrupted running tasks are marked cancelled on the next desktop startup.

Each task prefers Binance Public Data monthly archives for completed months, records completed ranges in `kline_ranges`, and uses REST pagination to fill missing archive coverage and latest data. Existing SQLite rows and completed ranges are reused, so retrying a task resumes from cached progress where possible.

On desktop startup, Rust scans cached market/symbol/interval scopes and queues background integrity checks through the same bounded full-history worker pool. The integrity pass verifies adjacent K-line `open_time` continuity, uses calendar-month continuity for `1M`, and force-fetches detected gaps through Binance REST so a stale or incorrect `kline_ranges` completion marker cannot hide missing rows.

The cache panel shows queued/running/complete/failed/cancelled status, progress, row count, messages, cancel and retry controls.

## Data Sources

The Rust backend can use:

1. SQLite local cache.
2. Binance public REST.
3. Binance Public Data monthly archives for supported historical datasets.
4. WebSocket updates for active candles.
5. Generated fallback rows in browser preview mode when real market data is unavailable.

Monthly archives only cover completed months and not every interval exists in the archive catalog. Unsupported archive intervals are source limitations.

For full-history tasks, archive misses automatically fall back to REST pagination. If REST is blocked or fails, the task is marked failed with the network error.

## Large Writes

Large imports and benchmark preparations must be chunked or otherwise bounded so they do not starve the UI. The 100k dataset is the full-interaction verification target; 1M browsing uses LOD/downsampling and treats heavy overlays as best effort.

## Cache Management

The cache UI reports market, symbol, interval, row count, first/last open time and estimated size. It supports:

1. Clearing the active symbol.
2. Clearing one cached market/symbol/interval scope.
3. Refreshing the summary after clears.
4. Viewing full-history task progress.
5. Cancelling queued/running full-history tasks.
6. Retrying failed/cancelled full-history tasks.

## CSV Export

CSV export reads the current chart request from the backend and includes the selected market, symbol, interval and candle fields. The backend should report clear errors if requested data cannot be read.
