# Goal: Tauri Rust Performance Rewrite

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-29-tauri-rust-performance-rewrite.md`; create and work on branch `perf/tauri-rust-rewrite`, complete the Tauri/Rust/Solid/SQLite performance rewrite only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

Create branch `perf/tauri-rust-rewrite` in `/home/czc/projects/working/stock/KLineForge` and directly rewrite KLineForge's core architecture for extreme desktop performance as a `v0.1.0-tauri` prerelease: migrate the full MVP from the current React + KLineCharts + Electron + Dexie/IndexedDB + Web/Docker architecture to a Tauri desktop architecture centered on Rust, Tokio, SQLx/SQLite, Solid, and a mature high-performance charting library, with measurable performance verification for large real Binance K-line datasets.

### Context

KLineForge is currently a desktop-first crypto charting MVP implemented with React, TypeScript, Vite, Electron, KLineCharts, Zustand, Dexie/IndexedDB, Binance public REST/WebSocket data, local K-line cache, indicators, drawings, export/import, Chinese/English UI, unit tests, browser verification scripts, Docker/Nginx static deployment, and Electron desktop packaging.

The existing architecture already avoids rendering candles through React and uses KLineCharts Canvas, but the desired next step is a much larger performance-oriented rewrite. The user explicitly wants a direct core architecture rewrite, allows replacing React, KLineCharts, Electron, Dexie/IndexedDB, Docker/Nginx and Web static deployment, and prioritizes long-term performance ceiling over short-term migration comfort.

The first-stage target is a Tauri desktop app only. Web/Docker static deployment does not need to be preserved in this branch. Old IndexedDB/localStorage/config import compatibility is not required; the new app may start from empty local data.

### Brainstorming Direction

Approved direction: direct core architecture rewrite.

Default technology direction:
- Desktop shell: Tauri.
- Core backend: Rust.
- Async/runtime: Tokio.
- Persistence: SQLite through SQLx.
- UI framework: Solid by default.
- Charting: evaluate and use Lightweight Charts first; uPlot is the backup if Lightweight Charts cannot satisfy performance or core feature needs.
- Binance public market data: hand-written minimal Rust REST/WebSocket clients rather than a Binance SDK.
- Data ownership: Rust side owns REST/WebSocket access, ZIP/CSV parsing, cache reads/writes, indicator calculation, benchmark data preparation and SQLite persistence.
- Frontend ownership: Solid UI, chart interaction, user workflow, and rendering through the selected high-performance charting library.

Key trade-off: this branch may make large, disruptive code and dependency changes to reach a higher performance ceiling, but it must keep the MVP workflow verifiable and must not silently remove core viewing functionality.

### Discovery Summary

Answered:
- Branch: `perf/tauri-rust-rewrite`.
- Goal file path: `/home/czc/projects/working/stock/KLineForge/2026-06-29-tauri-rust-performance-rewrite.md`.
- Main outcome: full MVP migration onto a new Tauri/Rust/Solid/SQLite architecture.
- Performance priorities: chart interaction, data processing, and desktop resource usage all matter; chart interaction is the first priority.
- Runtime target: local Tauri desktop app on the current development machine.
- Large-data target: 100,000 K-lines with full MVP-level interaction and 1,000,000 K-lines with usable basic browsing, allowing LOD/windowing/downsampling for the 1,000,000 case.
- Markets: keep Binance Spot and Binance USD-M Futures.
- Realtime: Rust manages REST and WebSocket; frontend receives structured history/live/status data through Tauri commands/events.
- Persistence: SQLite + Rust data access layer.
- UI: visible redesign is allowed if the core workflows remain usable and performance improves.
- Data compatibility: old local IndexedDB/localStorage and old config import compatibility are not required.
- Deletions: Electron, old Web/Docker deployment, React, KLineCharts and Dexie/IndexedDB code may be removed or replaced on this branch.
- Security: Tauri minimum-permission design; no trading, API keys, accounts, cloud sync or private user data services.
- Verification: Rust tests, frontend tests, type/build checks, Tauri dev/build, CI, performance benchmark and manual acceptance all matter.
- Benchmark data: use real Binance historical data; CI also runs a real-data benchmark, with fixed cached dataset fallback.
- Benchmark dataset policy: medium-sized dataset covering BTCUSDT/ETHUSDT, Spot/USD-M and major intervals; do not commit large data directly, commit scripts plus manifest/checksum and use CI cache or release artifact.
- Performance reports: save benchmark inputs/results/report files under `artifacts/performance/`.
- Documentation: update architecture, development, performance, migration, release and rollback documentation.
- Release target: `v0.1.0-tauri` prerelease.
- Function migration tracking: maintain a full MVP migration checklist with status and notes.

Skipped by user:
- Do not first establish an old-version performance baseline.
- Do not require old local data migration.
- Do not preserve Web/Docker static deployment in the first stage.

Still relevant execution-stage decisions:
- If Lightweight Charts cannot support the required feature/performance surface, evaluate uPlot or stop and ask.
- If Solid blocks the MVP migration, stop and ask whether to switch to Svelte or React.
- If CI real-data benchmark is unstable, implement the approved fixed cached dataset fallback; stop if that still cannot be made reliable.

### Scope

Codex may:
- Create and switch to branch `perf/tauri-rust-rewrite` after confirming the worktree state.
- Add Tauri/Rust project structure, commands, events, capabilities, build config and packaging config.
- Add Rust modules for Binance Spot/USD-M public REST, WebSocket streams, public data archive downloading/parsing, SQLite persistence, cache tasks, indicators, benchmark fixtures and structured errors.
- Add SQLite schema/migrations for K-lines, symbols, watchlists, drawings, indicator configs, settings, cache task/status data and release/version metadata as appropriate.
- Replace the UI with Solid by default, including app shell, watchlist, symbol search, market info, dual chart layout, settings, indicators, drawing controls, cache management and export/import workflows.
- Replace KLineCharts with Lightweight Charts by default, with uPlot as fallback if needed.
- Implement LOD/windowing/downsampling/incremental loading strategies for 100,000 and 1,000,000 K-line cases where appropriate.
- Replace Dexie/IndexedDB storage with SQLite-backed Rust commands/events.
- Remove or replace Electron, old React-only code, old KLineCharts integration, old Dexie cache implementation, Docker/Nginx/static Web deployment files and scripts where they conflict with the new Tauri-only direction.
- Add or update tests, benchmark scripts, CI workflows, documentation and artifacts needed for verification.
- Add third-party dependencies as needed for Tauri, Rust async/networking/WebSocket, SQLx/SQLite, Solid, charting, tests and benchmarks, while documenting important choices and avoiding unrelated dependencies.
- Preserve or recreate the full MVP feature set: Binance Spot/USD-M, dual charts, independent intervals, real history, live updates, time-linked crosshair where supported, watchlist, symbol search, market info, built-in indicators, indicator configuration, drawings with at least core support, local cache, cache management, chart PNG/export where feasible, K-line CSV export, config import/export for the new schema, themes/settings/session restore and Chinese/English UI.

### Out Of Scope

- Trading, order placement, account assets, positions, orders, PnL, API key management or user accounts.
- Cloud sync or remote user configuration storage.
- Exchanges beyond Binance Spot and Binance USD-M Futures.
- Preserving old IndexedDB/localStorage data or old config import compatibility.
- Preserving Web/Docker static deployment in the first stage.
- A fully custom chart rendering engine unless both Lightweight Charts and uPlot fail and the user approves the new direction.
- Committing large benchmark datasets directly to the Git repository.
- Making `v0.1.0-tauri` replace any stable release before the release/rollback documentation and verification are complete.

### Verification

Required automated and build verification:
- Confirm the active branch is `perf/tauri-rust-rewrite`.
- Run Rust formatting/lint/tests appropriate for the introduced Rust workspace, such as `cargo fmt --check`, `cargo clippy --all-targets --all-features`, and `cargo test`, adjusting exact commands to the final workspace layout.
- Run frontend formatting/lint/type/test/build checks appropriate for the selected Solid/Vite/Tauri setup, preserving or replacing existing npm scripts with documented equivalents.
- Run Tauri development/build validation, including at least one command that proves the app can be launched in development and one command that builds/package-validates the Tauri desktop app.
- Add or update CI so it runs Rust checks, frontend checks, Tauri build validation and the approved benchmark flow.
- Run the real Binance historical-data benchmark locally and in CI, using the fixed cached dataset fallback when direct network access is not stable.
- Save benchmark input manifests, checksums, result JSON/Markdown and any relevant notes under `artifacts/performance/`.

Required performance evidence:
- 100,000 real Binance K-lines with full MVP-relevant interactions must be acceptably smooth on the current development machine, including chart load, pan/zoom, crosshair, indicators and representative drawing/cache workflows.
- 1,000,000 real Binance K-lines must support usable basic browsing on the current development machine; LOD/windowing/downsampling or reduced overlay behavior is acceptable for this case if documented.
- Benchmark reports must record at least dataset identity, market, symbol, interval, row count, load/preparation time, chart handoff/render readiness timing where measurable, indicator calculation time, memory/resource observations where available, and notes about any degraded behavior.
- If exact frame-rate measurement is not practical, include reproducible scripted timings plus a manual acceptance checklist for chart interaction smoothness.

Required functional evidence:
- Maintain a full MVP migration checklist and mark each existing MVP feature as complete, intentionally degraded, removed with approval, or blocked.
- Verify Binance Spot and USD-M public market data history and live updates.
- Verify dual-chart workflow with independent intervals and usable crosshair/linked-time behavior if supported by the charting layer.
- Verify watchlist, symbol search, market info, indicators, local cache, cache management, export/import, settings/session behavior and Chinese/English UI.
- Verify drawing data model persistence and core drawing support; advanced drawing editing may be degraded only if documented.
- Verify no API key/account/trading capability is introduced.

Required documentation/release evidence:
- Update architecture and development docs for Tauri/Rust/Solid/SQLite, commands, schema, capabilities and project layout.
- Document important dependency and chart/UI framework choices.
- Document performance benchmark workflow, dataset cache policy, report location and how to refresh benchmark data.
- Document `v0.1.0-tauri` prerelease packaging, migration notes, known degradations and rollback path to the old `main` architecture.

### Stop Conditions

Stop and ask the user instead of guessing if:
- The worktree has uncommitted user changes and large deletion/replacement work would overwrite or obscure them.
- Branch `perf/tauri-rust-rewrite` already exists with unrelated work or conflicts.
- Tauri/Rust/Tokio/SQLx/SQLite toolchain or dependencies cannot be installed or built reliably in this environment.
- Lightweight Charts cannot satisfy the core charting needs and uPlot also appears insufficient, or choosing a different charting strategy would imply a custom renderer.
- Solid significantly blocks full MVP migration and switching to Svelte or React becomes the practical option.
- Any of these core MVP capabilities would need to be removed rather than migrated or documented as an approved degradation: Binance public market data, dual charts, interval switching, live updates, pan/zoom, indicators, local cache, export/import, or Chinese/English UI.
- CI cannot reliably run the real-data benchmark through direct access or the approved fixed cached dataset fallback.
- The 100,000 full-function or 1,000,000 basic-browsing performance targets appear unreachable without changing the target, accepting a larger degradation, or building a custom renderer.
- A new dependency or permission would introduce account access, secrets, trading behavior, broad filesystem access or network scope beyond the agreed minimum-permission Tauri design.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
