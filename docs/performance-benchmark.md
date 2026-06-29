# Performance Benchmark Workflow

Benchmark outputs are stored under `artifacts/performance/`.

## Local Command

```bash
npm run benchmark:real
```

The current benchmark slice fetches real Binance USD-M `BTCUSDT` `1m` candles through Rust, writes them to SQLite, reads them back, calculates default indicators and writes JSON output to:

```text
artifacts/performance/latest-benchmark.json
```

Latest local smoke result from the full verification rerun:

```text
market=usdM symbol=BTCUSDT interval=1m rows=1500 fetch=957ms sqlite_write=150ms sqlite_read=26ms indicator=1ms source=binance-rest
```

The default indicator timing now includes MA, EMA, BOLL, MACD, RSI, ATR, KDJ and Supertrend.

Some earlier local runs fell back to the deterministic generated dataset because `https://fapi.binance.com/fapi/v1/klines` failed during TLS connection setup in this environment. That fallback keeps CI/build verification reproducible, but it does not replace the required real-data 100k/1M Public Data evidence.

## Archive Benchmarks

When Binance REST is unavailable, the benchmark CLI can use real Binance Public Data monthly archives:

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin klineforge-benchmark -- --archive-target 100000 --output artifacts/performance/archive-100k-benchmark.json
cargo run --manifest-path src-tauri/Cargo.toml --bin klineforge-benchmark -- --archive-target 1000000 --output artifacts/performance/archive-1m-benchmark.json
npm run prepare:chart-dataset:100k
npm run prepare:chart-dataset:1m
```

`prepare:chart-dataset:*` writes both the benchmark summary and a browser/Tauri-preview chart dataset:

```text
artifacts/performance/chart-dataset-100k.json
artifacts/performance/chart-dataset-1m.json
```

Large chart datasets are ignored by Git and should be distributed through CI artifacts, cache or release artifacts when needed.

Latest local real archive results from June 29, 2026:

```text
100k BTCUSDT USD-M 1m rows: fetch_parse=7306ms sqlite_write=4277ms sqlite_read=1585ms indicators=94ms
1m BTCUSDT USD-M 1m rows: fetch_parse=21525ms sqlite_write=41317ms sqlite_read=16036ms indicators=0ms
```

The 1M chart dataset intentionally omits overlay indicator export for the basic-browsing target. The chart layer applies LOD/downsampling at this size and keeps indicators disabled for that path.

## Large Chart Interaction

The large-chart verification scripts run against the production Vite preview and the real Binance Public Data chart datasets:

```bash
npm run build
npm run preview -- --port 4173
npm run verify:large-chart:100k
npm run verify:large-chart:1m
```

Latest local scripted interaction results from June 29, 2026:

```text
100k: render_ready=3977ms interaction=840ms left_set_data=123ms right_set_data=116ms rows=100000 rendered=100000 lod=false passed=true
1m: render_ready=3240ms interaction=818ms left_set_data=192ms right_set_data=155ms rows=1000000 rendered=142858 lod=true passed=true
```

The 100k script verifies full MVP-relevant chart interaction on real data: dual chart render, pan/zoom, crosshair movement, indicator data handoff, horizontal-line drawing workflow, PNG export and CSV export. The 1M script verifies basic browsing on real data: dual chart render, pan/zoom, crosshair movement and LOD handoff.

Artifacts:

1. `artifacts/performance/large-chart-100k-interaction.json`
2. `artifacts/performance/large-chart-100k.png`
3. `artifacts/performance/large-chart-100k-left.png`
4. `artifacts/performance/large-chart-100k.csv`
5. `artifacts/performance/large-chart-1m-interaction.json`
6. `artifacts/performance/large-chart-1m.png`

## Market Data Smoke

Spot and USD-M market data are verified through the Rust backend client:

```bash
npm run verify:market-data
```

Latest local result from June 29, 2026:

```text
spot: history=10 rows, market_info=ok, symbols=674 rows, live_kline=1879ms
usdM: history=10 rows, market_info=ok, symbols=766 rows, live_kline=910ms
```

Artifact:

1. `artifacts/performance/market-data-smoke.json`

## Render Smoke

The frontend render smoke runs against the production Vite preview with system Chromium:

```bash
npm run build
npm run preview -- --port 4173
npm run verify:render -- http://127.0.0.1:4173/
```

Latest local render result:

```text
render_ready=1816ms chart_panes=2 canvases=14 non_blank_canvases=8 passed=true
```

Artifacts:

1. `artifacts/performance/tauri-render-smoke.json`
2. `artifacts/performance/tauri-render-smoke.png`

## Dataset Policy

The goal requires real Binance historical data. Large benchmark datasets must not be committed directly to Git.

Use scripts, manifests and checksums to prepare fixed datasets in CI cache or release artifacts. The medium target dataset should cover:

1. BTCUSDT and ETHUSDT.
2. Spot and USD-M Futures.
3. Major intervals.
4. Enough rows to exercise 100,000 full-function and 1,000,000 basic-browsing scenarios.

## Acceptance Targets

1. 100,000 real K-lines: full MVP-relevant interaction should be acceptably smooth on the current development machine.
2. 1,000,000 real K-lines: basic browsing should be usable, with LOD/windowing/downsampling allowed if documented.

If exact frame-rate measurement is not practical, record scripted timings plus manual interaction notes.

## Open Benchmark Work

Remaining caveats:

1. GitHub Actions has a workflow that prepares the 100k real archive dataset and runs the large-chart 100k smoke, but this repository-local run cannot prove the remote GitHub workflow has executed.
2. Binance REST remains unstable in this environment; use Public Data archive scripts for required real-data evidence.
3. 1M chart browsing uses LOD/downsampling and omits overlay indicators, which is the approved reduced-overlay behavior for the basic-browsing target.
