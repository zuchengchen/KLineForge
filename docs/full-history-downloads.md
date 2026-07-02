# Full-History Downloads

## Purpose

Full-history downloads let KLineForge build a durable local SQLite cache for every market/symbol/interval scope that matters to the current chart workflow. Switching a chart interval still renders the current `chartLimit` window first; full-history work runs in the background.

## Triggering

When a user changes the left or right chart interval, the frontend enqueues:

1. The newly selected visible interval.
2. The existing large-period prefetch intervals: `1h`, `2h`, `4h`, `1d`, `1W`, `1M`.

Duplicate intervals are collapsed before enqueueing. Browser preview mode does not perform real downloads and reports that desktop runtime is required.

## Backend Shape

Rust owns the queue in `src-tauri/src/history_tasks.rs`.

The queue is process-local and bounded to two concurrent workers. Task state is durable in SQLite:

1. `cache_tasks` stores one full-history task per `market + symbol + interval`.
2. `payload_json` stores phase, message, row count, source, first/last open time, archive month count and REST page count.
3. `kline_ranges` records completed archive and REST ranges.
4. `klines` stores the actual candle rows with the existing upsert key.

On desktop startup, any stale `running` tasks from a previous app session are marked `cancelled`.

## Task State

Task statuses:

1. `queued`: waiting for a worker.
2. `running`: actively discovering, downloading or writing data.
3. `complete`: full-history task completed with at least one cached row.
4. `failed`: download or write failed.
5. `cancelled`: user cancelled the task or the app restarted while it was running.

Phases are more granular and include `starting`, `archive`, `rest`, `complete`, `failed` and `cancelled`.

## Data Source Order

Each task first probes Binance REST for the latest K-line so it knows the current upper bound.

Then it walks completed Binance Public Data monthly archive files from newest completed month backwards. Archive URLs use:

```text
https://data.binance.vision/data/<scope>/monthly/klines/<SYMBOL>/<interval>/<SYMBOL>-<interval>-<YYYY>-<MM>.zip
```

`scope` is `spot` for Spot and `futures/um` for USD-M futures.

After archive ingestion, REST pagination fills:

1. Early history before the earliest archived/cached row.
2. Latest data after the last archived/cached row.
3. Any source gaps encountered when archive files are unavailable.

Before a task is marked complete, Rust also scans the stored K-lines for internal gaps. Fixed-size intervals compare adjacent `open_time` values against the configured interval length; monthly `1M` history compares natural calendar months. Any gap is force-filled with REST pagination even if `kline_ranges` already says the range is complete.

Archive misses are not immediately fatal because Binance publishes monthly files after month close and coverage differs by symbol and interval. If REST fallback also fails, the task becomes `failed` and the UI shows the error.

## Resume Behavior

Retries reuse:

1. Existing `klines` rows via upsert.
2. Existing `kline_ranges` entries with `status = complete`.
3. Existing first/last cached row bounds.

This means retries normally skip completed archive months and continue with missing archive or REST ranges.

On desktop startup, existing cached scopes are also queued for the same background integrity check. This catches old cache files where the range metadata and the actual K-line rows disagree.

## UI

The cache panel shows recent cache summary rows plus full-history task rows. Each task displays scope, status, percent, cached row count, latest message, cancel and retry controls.

Cancel sets an in-memory cancellation flag for running tasks and removes queued tasks before they start. Retry requeues failed or cancelled tasks for the same scope.

## Verification

Routine verification includes:

```bash
npm run typecheck
npm run lint
npm run test
npm run rust:fmt
npm run rust:clippy
npm run rust:test
```

The required real-data validation is:

```bash
npm run verify:full-history
```

That command runs the Rust `klineforge-full-history` binary for `usdM BTCUSDT 1h`, writes evidence to `artifacts/performance/full-history-usdm-btcusdt-1h.json`, and uses the same full-history downloader as the desktop queue.

## Limits

The task uses Binance public endpoints only and does not use API keys. Large downloaded data is local runtime state and must not be committed to Git.

The completion standard requires real Binance Public Data and REST access. If this machine cannot reach those endpoints, implementation may be correct but the goal must be treated as blocked until the external network condition is resolved.
