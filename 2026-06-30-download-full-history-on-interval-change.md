# Goal: Download Full History On Interval Change

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-30-download-full-history-on-interval-change.md`; implement full historical K-line background downloads after interval changes, complete only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

In KLineForge, when a user switches a chart interval, keep the chart's current `chartLimit` loading behavior fast, then enqueue background tasks that download the exchange-available full historical K-line data for the active `market + symbol + interval` scopes into local SQLite. The queue must include the switched visible interval and the existing large-period prefetch intervals, support progress, cancellation, retry, and resumable gap filling, and expose task status in the existing cache area.

### Context

The repo is `/home/czc/projects/working/stock/KLineForge`, a Tauri + Solid app. Frontend interval switching currently lives in `src/App.tsx` around `updateChartInterval`, chart data loading uses `getChartData`, and large-period prefetch uses `createLargePeriodPrefetchRequests`. Rust commands live in `src-tauri/src/commands.rs`; SQLite access is in `src-tauri/src/db.rs`; Binance access is in `src-tauri/src/binance.rs`; schema migrations live in `src-tauri/migrations/`. Existing tables include `klines`, `kline_ranges`, and `cache_tasks`, but full range task management is currently incomplete.

### Brainstorming Direction

Use automatic background completion: after interval changes, render the normal recent chart data first, then run a bounded background queue for full historical downloads. Prefer Binance Public Data monthly archives for bulk history, use REST pagination to fill archive gaps and latest data, and keep task controls in the cache panel.

### Discovery Summary

Answered: exchange-available full history, automatic trigger, visible plus prefetch intervals, max 2 concurrent tasks, resumable gap filling, Public Data first with REST fallback, cache-panel task UI, Tauri desktop as the real runtime, new migrations/API allowed, real `usdM BTCUSDT 1h` validation required, no first-screen loading change, detailed docs required.

Defaulted: use existing project conventions and test scripts; keep large data out of Git; use only Binance public data with no secrets.

Skipped/assumed: exact panel visual design and exact Rust command names may be chosen during implementation if consistent with local patterns.

Not applicable: private data compliance and remote rollout/feature flags, because this is a local desktop public-market-data feature.

### Scope

Implement Rust-side task state, queueing, cancellation, retry, resumable range/gap detection, Public Data archive ingestion, REST fallback pagination, SQLite writes, and structured errors/progress. Add or update Tauri commands and TypeScript types/services. Extend the existing cache UI area to show full-history task rows, progress, status, cancel, and retry. Trigger enqueueing from interval changes and from existing large-period prefetch scope logic. Add or update tests for queue behavior, range/gap logic, commands/services, and UI behavior where practical. Add detailed documentation covering architecture, data sources, limits, resume behavior, controls, and verification.

### Out Of Scope

Do not block chart rendering until full history completes. Do not rewrite unrelated chart, indicator, drawing, watchlist, import/export, or layout behavior. Do not commit large downloaded historical datasets. Do not add private Binance credentials, paid APIs, or non-public data sources unless the user explicitly approves. Do not silently relax the real-download verification requirement.

### Verification

Run the relevant local quality checks, including:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run rust:fmt`
- `npm run rust:clippy`
- `npm run rust:test`

Also perform a real end-to-end desktop/backend validation that downloads full available history for `market=usdM`, `symbol=BTCUSDT`, `interval=1h`, proving that Public Data archive ingestion runs first and REST fills missing/latest ranges. Record the command or manual steps used, row counts, first/last open time, task final status, and any artifact path. The goal is not complete until this real Binance validation succeeds.

### Stop Conditions

Stop and ask the user instead of guessing if Binance Public Data or REST access is blocked and the required `usdM BTCUSDT 1h` full-history validation cannot complete. Stop if implementing the feature would require private credentials, a proxy/mirror, committing large data files, destructive database resets, or broad unrelated refactors. Stop if the existing dirty worktree contains conflicting edits that make this feature unsafe to apply without user direction.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
