# Goal: Indicator Instance Configuration

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-29-indicator-instance-config.md`; implement chart/interval-scoped configurable indicator instances for KLineForge, complete only when the verification section passes, and stop to ask only if a listed hard blocker occurs.

## Full Prompt

### Objective

Implement a full TradingView-style indicator instance system for the current KLineForge Tauri/Solid app: each `chartId + interval` has independent persisted indicator instances; users can add, edit, hide/show, delete, and style indicators; all currently supported indicators can have freely configurable validated parameters; chart rendering uses dynamic indicator series rather than the current fixed-field indicator result model.

### Context

KLineForge is a Tauri/Rust/Solid/SQLite crypto charting app in `/home/czc/projects/working/stock/KLineForge`.

Current indicator behavior:
- `src/App.tsx` has one global `indicatorSettings` boolean object shared by both charts and all intervals.
- `src/services/types.ts` defines fixed `IndicatorSettings` booleans and fixed `IndicatorValue` fields such as `ma5`, `ma10`, `bollMid`, `macdDif`, `rsi14`, etc.
- `src-tauri/src/commands.rs` exposes `get_indicators` using only `KlineRequest`.
- `src-tauri/src/indicators.rs` calculates hard-coded defaults: Volume, MA(5,10,30), EMA(12,26), BOLL(20,2), MACD(12,26,9), RSI(14), ATR(14), KDJ(9,3,3), and Supertrend(10,3).
- `src/components/ChartPane.tsx` renders a fixed set of indicator series from the fixed fields.
- App settings currently persist global `settings.indicators`; existing users may have some global indicator booleans disabled.

The requested behavior is much larger than toggles: different period charts must have independent indicator setups, and each indicator must allow user-defined parameters and complete style configuration.

### Brainstorming Direction

Approved direction: build the full indicator instance system.

Use `chartId + interval` as the configuration scope. Do not scope indicator instances by market or symbol: for example, `left + 1h` uses the same indicator instance set across Spot/USD-M and across symbols.

Use a dynamic indicator-result model. The Rust backend should compute indicator output based on explicit indicator instance definitions and return series data keyed by instance/series identifiers. The Solid frontend should dynamically create/update/remove chart series based on those returned series and each instance's style.

This is a larger rewrite than a local toggle UI change, but it aligns with the desired TradingView-style behavior and avoids trying to force multiple configurable indicator instances through the current fixed `IndicatorValue` fields.

### Discovery Summary

Answered:
- Supported indicators: all currently available indicators must be instance-capable in the first version: Volume, MA, EMA, BOLL, MACD, RSI, ATR, KDJ, Supertrend.
- Scope isolation: indicator configs are isolated by `chartId + interval`.
- Market/symbol isolation: not included.
- UI: use a modal/dialog for adding and editing indicator instances.
- Instance naming: automatically generated names such as `MA(5,10,30)` or `MACD(12,26,9)`; no custom display name in this version.
- Parameters: users may input parameters freely within reasonable validated bounds.
- Persistence: add a SQLite table for indicator instances/configuration.
- Config import/export: include indicator instances.
- Defaults: preserve current visible behavior by generating default instances equivalent to current defaults. For existing settings, migrate from old global `settings.indicators` booleans: true creates the default instance, false omits it.
- Styles: support color, line width, and line style configuration.
- Data model: dynamic indicator series is allowed and preferred.
- Limit: at most 20 indicator instances per `chartId + interval`.
- Large data: preserve the existing protection that skips indicator calculation/rendering when `chartLimit > 200_000`; add clear UI feedback.
- Verification: use Rust tests, frontend tests/typecheck, and Playwright UI verification for add/edit/delete and left/right + interval isolation.
- Stop condition: ask only for hard blockers such as impossible compilation or equivalent inability to continue.

Defaulted:
- Reasonable parameter bounds should be chosen during implementation by indicator type, with tests covering invalid values.
- Schema migration must preserve existing databases.
- Playwright script file names can follow existing `scripts/verify-*.mjs` conventions.
- Documentation updates should cover the new indicator config model where relevant.

Not applicable or out of scope:
- Binance market data retrieval, K-line cache fetch policy, WebSocket data flow, and drawing behavior are not target changes except where affected by indicator rendering integration.
- User-custom indicator names are out of scope for this version.
- Market/symbol-specific indicator profiles are out of scope.
- Full mobile redesign is out of scope.

### Scope

In scope:
- Design and implement a persisted indicator instance data model keyed by `chartId + interval`.
- Add SQLite migration(s) for indicator instance persistence.
- Add Rust domain types, validation, database read/write/delete/reorder helpers as needed.
- Add Tauri commands for listing, saving/updating, deleting, and reordering indicator instances, or an equivalent command surface.
- Update config export/import to include indicator instances.
- Migrate old `settings.indicators` boolean settings into default indicator instances for existing users when no instance config exists.
- Replace or adapt `get_indicators` so indicator calculation uses the current chart/interval's indicator instances and returns dynamic series results.
- Support all current indicator types:
  - Volume
  - MA with configurable one or more periods
  - EMA with configurable one or more periods
  - BOLL with configurable period and multiplier
  - MACD with configurable short, long, and signal periods
  - RSI with configurable period
  - ATR with configurable period
  - KDJ with configurable period, K smoothing, and D smoothing
  - Supertrend with configurable period and multiplier
- Support style configuration:
  - colors for each rendered sub-series where applicable, such as MA period lines, BOLL upper/mid/lower, MACD DIF/DEA/histogram, KDJ K/D/J
  - line width
  - line style, mapped as well as Lightweight Charts supports
- Update Solid UI:
  - show indicator instances for the active chart/interval
  - allow selecting which chart/interval is being configured
  - add indicator instance
  - open modal to edit parameters and style
  - hide/show indicator instance
  - delete indicator instance
  - prevent adding more than 20 instances for a chart/interval
  - show clear feedback when indicators are skipped due to large-data mode
- Update `ChartPane` to render dynamic indicator series and clean up stale series when instances change.
- Keep current chart, cache, live data, drawing, and export workflows working.
- Add or update tests and Playwright verification scripts.

Out of scope:
- Custom display names for indicator instances.
- Market/symbol-specific indicator profiles.
- User-defined formula language or custom script indicators.
- Advanced templates, cloud sync, or sharing.
- Full chart layout redesign unrelated to the indicator controls.
- Removing the large-data indicator skip protection.

### Verification

Required automated checks:
- `npm run typecheck`
- `npm test`
- `npm run rust:test`
- Run any relevant targeted Rust tests added for indicator validation, persistence, migration/import/export, and calculations.
- Run any relevant targeted frontend tests added for indicator instance state, UI helpers, and dynamic chart rendering helpers.

Required Playwright/browser verification:
- Add or update a script following the repo's `scripts/verify-*.mjs` style.
- Verify at a normal desktop viewport that:
  - the app opens with default indicator instances equivalent to the current default indicators;
  - the user can add an indicator instance;
  - the user can edit parameters in a modal and the generated instance name updates;
  - the user can edit color, line width, and line style;
  - the user can hide/show an instance;
  - the user can delete an instance;
  - left and right charts maintain independent indicator instances;
  - changing interval on a chart uses that interval's own indicator instances and switching back restores the prior interval's instances;
  - adding/editing an instance on one chart/interval does not alter another chart/interval;
  - attempting to exceed 20 instances is blocked with user-visible feedback;
  - large-data mode still skips indicators and shows clear UI feedback.
- Capture/report evidence via screenshots, DOM assertions, or structured JSON artifacts.

Manual acceptance criteria:
- A user can configure `left + 1h` and `right + 1d` with different indicator sets and parameters.
- A user can switch `left` from `1h` to `4h`, configure different indicators, then switch back to `1h` and see the previous `1h` indicator setup restored.
- A user can configure at least MA, BOLL, MACD, RSI, KDJ, and Supertrend parameters and styles through the UI.
- Existing chart data loading, pan/zoom, live update, drawings, CSV/PNG export, and config import/export remain usable.

Completion standard:
- Do not mark complete until the required automated checks pass and the Playwright verification demonstrates chart/interval-scoped indicator instance behavior.
- If any required verification cannot run, document why and ask the user before changing the completion standard.

### Stop Conditions

Stop and ask the user only if:
- The code cannot be made to compile after reasonable implementation attempts.
- A hard dependency or tool failure prevents continuing the implementation at all.
- Existing repository state makes it impossible to safely apply the necessary migration or command changes.
- Meeting the requested behavior would require removing a core MVP feature such as chart rendering, K-line loading, live updates, drawing persistence, config import/export, or local SQLite persistence.

Otherwise, make reasonable implementation decisions and continue through verification rather than stopping for minor design uncertainty.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
