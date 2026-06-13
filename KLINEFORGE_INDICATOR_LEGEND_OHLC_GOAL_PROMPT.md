# KLineForge Indicator Legend and OHLC Hover Goal Prompt

Copy the prompt below into Codex Goal mode.

```text
Implement TradingView-style indicator legends, clickable indicator settings, and OHLC hover legends for KLineForge.

Project context:
KLineForge is a React + TypeScript + Vite crypto charting app for Binance Spot and Binance USD-M Futures. It uses KLineCharts (`klinecharts@10.0.0-beta3`) for canvas K-line rendering, Zustand for session/settings state, Dexie/IndexedDB for local persistence, i18next for English/Chinese UI strings, and Vitest for tests. Recent work may already support configurable 1/2/3/4 chart layouts with chart ids such as `left`, `right`, `third`, and `fourth`; inspect the current worktree and use the current implementation as authoritative.

Current behavior:
- Indicators are configured mainly through the existing `IndicatorPanel`.
- Indicator configs currently store basic fields such as `chartId`, `market`, `symbol`, `interval`, `name`, `pane`, `visible`, `calcParams`, `color`, and `lineWidth`.
- `useChartIndicators` applies configured indicators to KLineCharts, currently with simple line styling.
- `KLineChartHost` owns chart instance wiring, data feed state, indicators, drawings, crosshair sync, export, and chart chrome.
- The chart has drawing overlays and crosshair synchronization, but it does not yet have a TradingView-style in-chart OHLC/indicator legend.
- K-line hover/crosshair information is not yet shown as a fixed top-left OHLC legend.
- Clicking an indicator line on the canvas does not yet select that indicator or expose settings.

Overall objective:
Add a TradingView-style chart legend experience:
- A fixed OHLC legend in the top-left of each chart pane that shows the latest candle by default, updates to the hovered candle under the crosshair, and restores the latest candle when the pointer leaves.
- Indicator legend rows inside the chart, with main-pane indicator legends below the OHLC line and sub-pane indicator legends in the top-left of their own indicator pane.
- Clicking an indicator legend row or the actual rendered indicator line selects that indicator.
- The selected indicator exposes compact legend actions such as show/hide, settings, and delete.
- Clicking the settings action opens a TradingView-style indicator settings dialog with tabs for Inputs, Style, and Templates.
- Indicator configs must support full editable inputs and styles, including per-series colors, line widths, line styles, calculation source, visibility, deletion, and global templates by indicator type.

Confirmed product decisions:
- Indicator settings use a TradingView-like click-to-configure model.
- Hovering an indicator may highlight it or show light affordances, but hover must not immediately open full editing controls.
- The primary stable path is clicking the in-chart indicator legend name/actions.
- Clicking the actual indicator line should also select that indicator where technically feasible.
- If KLineCharts does not expose exact indicator-line hit testing, implement reasonable pixel-distance approximation based on mouse position, chart data, indicator values, and pane geometry. Keep the legend click path reliable even if line hit testing has to be approximate.
- Clicking indicator lines must not break existing chart interactions such as crosshair movement, scroll/zoom, vertical pan, fullscreen, drawing tools, or drawing selection.
- Indicator settings UI should be reached through the chart legend:
  - legend row displays indicator name and current key inputs, for example `EMA 9`, `MA 5 10 30 60`, `BOLL 20 2`, `MACD 12 26 9`;
  - selected or hovered rows expose actions such as eye/show-hide, gear/settings, and delete;
  - gear opens the full settings dialog.
- K-line hover information is shown in a fixed top-left OHLC legend, not as a mouse-following tooltip.
- The OHLC legend shows the latest candle when the mouse is not hovering a candle.
- When hovering/crosshairing a historical candle, the OHLC legend shows that candle.
- When the pointer leaves the chart, the OHLC legend restores the latest candle.
- The displayed percentage value is amplitude/range, calculated as `(High - Low) / Low`, not close-vs-open and not previous-close-vs-close.
- The OHLC legend should include at least `O`, `H`, `L`, `C`, and amplitude/range percentage.
- Layout of the top-left legend:
  - first row: OHLC/amplitude information;
  - following rows in the main pane: main-pane indicator legends such as EMA, MA, BOLL, SUPERTREND;
  - sub-pane indicators such as VOL, MACD, RSI, ATR, KDJ show their legends in the top-left of their own panes.
- Indicator settings dialog uses a TradingView-like tab structure:
  - Inputs / 参数;
  - Style / 样式;
  - Templates / 模板.
- Full indicator settings are in scope:
  - editable indicator parameters for all existing indicators (`MA`, `EMA`, `BOLL`, `SUPERTREND`, `VOL`, `MACD`, `RSI`, `ATR`, `KDJ`);
  - per-line/per-series colors, for example MA period lines, BOLL upper/mid/lower, MACD DIF/DEA/histogram, KDJ K/D/J;
  - line width;
  - line style such as solid/dashed;
  - calculation source: `close`, `open`, `high`, `low`, `hl2`, `hlc3`, `ohlc4`;
  - show/hide;
  - delete.
- Indicator templates are global and saved by indicator type:
  - templates are not bound to chart id, market, symbol, or interval;
  - templates store inputs, source, per-series style, visibility, and other style/calculation fields;
  - templates can be applied to any chart and any symbol/timeframe;
  - users can save, apply, delete, and set a default template for a given indicator type;
  - config export/import should include indicator templates.

Implementation guidance:
- Start by inspecting:
  - `src/types/domain.ts`
  - `src/features/chart/KLineChartHost.tsx`
  - `src/features/chart/useChartIndicators.ts`
  - `src/features/chart/klineChartAdapter.ts`
  - `src/features/chart/chartStyles.ts`
  - `src/features/chart/crosshairSync.ts`
  - `src/features/chart/linkedCrosshairHighlight.ts`
  - `src/features/chart/useKLineChartInstance.ts`
  - `src/features/indicators/IndicatorPanel.tsx`
  - `src/features/indicators/indicatorDefinitions.ts`
  - `src/features/indicators/indicatorConfigRepository.ts`
  - `src/features/indicators/klineIndicatorRegistry.ts`
  - `src/features/indicators/calculations.ts`
  - `src/features/export/configExport.ts`
  - `src/persistence/database.ts`
  - `src/i18n/resources.ts`
  - existing tests for chart indicators, indicator config repository, calculations, config export/import, crosshair sync, and app behavior.
- Keep existing chart ids, sessions, drawings, indicators, and old configs compatible.
- Prefer adding small focused modules/hooks rather than making `KLineChartHost.tsx` much larger.
- Suggested new modules, adjust names to fit the codebase:
  - `chartOhlcLegend.ts` or `useChartOhlcLegend.ts`;
  - `IndicatorLegendOverlay.tsx`;
  - `IndicatorSettingsDialog.tsx`;
  - `indicatorSeriesStyles.ts`;
  - `indicatorTemplatesRepository.ts`;
  - `indicatorHitTesting.ts`;
  - focused tests beside these modules.
- Do not build a large decorative UI. Keep the existing quiet desktop terminal/charting style.
- Do not add a landing page, marketing copy, or unrelated redesign.
- Keep all new user-facing strings localized in both English and Chinese.

Data model and compatibility requirements:
- Extend `IndicatorConfig` in a migration-tolerant way. Existing persisted rows with only `color` and `lineWidth` must continue to load.
- Make the new source of truth explicit. A reasonable shape could include fields like:
  - `source?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4'`;
  - `seriesStyles?: Record<string, { color: string; lineWidth: number; lineStyle: 'solid' | 'dashed'; visible: boolean }>`;
  - optional `settingsVersion` or normalization helper if useful.
- Preserve `color` and `lineWidth` or normalize them into default series styles for backwards compatibility.
- Add helper functions that define per-indicator input metadata and series metadata, for example:
  - MA series keys derived from each period;
  - EMA single line;
  - BOLL `up`, `mid`, `down`;
  - MACD `dif`, `dea`, `macd`;
  - RSI period lines if multiple params are supported;
  - KDJ `k`, `d`, `j`;
  - SUPERTREND `supertrend`;
  - VOL volume and average lines if available.
- If KLineCharts built-in indicators only support some style shapes, map the richer app config as fully as possible and document any unavoidable limitation in code/tests.
- Do not perform destructive IndexedDB migrations unless truly necessary. Prefer tolerant normalization when reading indicator configs/templates.
- If a Dexie version migration is needed for template storage or indexes, make it explicit and safe.
- Config export/import must:
  - include indicator templates;
  - validate the richer indicator config shape;
  - validate template rows before mutating IndexedDB;
  - continue to import old exports that have only the old `IndicatorConfig` shape;
  - reject malformed indicator names, chart ids, intervals, series style keys, colors, line widths, line styles, sources, and template payloads.

OHLC legend behavior:
- The OHLC legend should be per chart instance and reflect that chart's market, symbol, interval, and data.
- Default state after data load: latest candle.
- Crosshair/hover state: candle under the crosshair.
- Mouse leave: latest candle again.
- Show placeholders only before any candle data is available.
- Format price values using the chart/symbol precision already available in the app where practical.
- Format amplitude as `((high - low) / low) * 100`, with sensible guards for zero/invalid lows.
- Use price-color mode where useful, but do not make the UI noisy.
- Avoid occluding important controls and avoid text overflow in 1/2/3/4 chart layouts.
- The OHLC legend must work independently for each visible chart pane.

Indicator legend behavior:
- Main-pane indicator legends appear beneath the OHLC row in the candle pane.
- Sub-pane indicator legends appear in the corresponding indicator pane's top-left area.
- Rows should be compact and stable:
  - display indicator name plus key params;
  - selected/hovered row shows action buttons;
  - use familiar icons or compact text consistent with the existing UI if an icon library is not present;
  - buttons must have accessible labels and localized tooltips/aria labels.
- Actions:
  - show/hide toggles the indicator config visibility and re-applies indicators;
  - settings opens the tabbed settings dialog for that config;
  - delete removes the config and re-applies indicators.
- Selecting an indicator should visually distinguish the legend row and, where feasible, the rendered series.
- The legend must remain usable in fullscreen and multi-chart layouts.
- Hidden charts do not need legends mounted; when shown again, their indicators and legend state should restore from persisted config.

Indicator settings dialog requirements:
- Opened from the legend settings action, and optionally from line hit testing if the user clicks the rendered line.
- Must be scoped to the selected chart id, market, symbol, interval, and indicator config.
- Tabs:
  - Inputs:
    - edit all existing indicator parameters with validation;
    - edit calculation source where applicable;
    - validate positive periods and reasonable numeric bounds;
    - prevent invalid parameter arrays from being persisted.
  - Style:
    - show one row per series/line/histogram;
    - allow visibility, color, line width, and line style per series where supported;
    - preserve old single-color configs by normalizing them into series styles.
  - Templates:
    - save current settings as a global template for the indicator type;
    - list templates for the indicator type;
    - apply a template to the current config;
    - delete a template;
    - mark/unmark a template as default for the indicator type.
- Use existing compact form styling and avoid a card-heavy design.
- `Esc` closes the dialog without breaking global chart fullscreen behavior.
- Changes should update the chart after save/apply. Decide whether individual field edits apply immediately or on Save, but keep behavior deterministic and test it.

Indicator calculation/source requirements:
- Current calculations mostly use `close`. Add a source-value helper for `open`, `high`, `low`, `close`, `hl2`, `hlc3`, and `ohlc4`.
- Apply source consistently to indicators where source makes sense:
  - MA, EMA, BOLL, RSI, MACD can use the selected source;
  - ATR and SUPERTREND may need OHLC and can either ignore source or expose only applicable inputs. If source is not applicable, make that explicit in metadata/UI.
- Keep existing calculation tests passing and add source-specific tests.
- If KLineCharts built-in indicators cannot accept custom source for every built-in, consider registering app-owned indicators or precomputing values only if that fits the existing architecture. Avoid a huge rewrite unless necessary; document tradeoffs in tests or comments.

Indicator line hit testing:
- Implement legend click first as the reliable path.
- For rendered indicator-line clicks:
  - use KLineCharts conversion APIs and current visible data where possible;
  - compare pointer position to candidate indicator series points in pixel space;
  - use a small tolerance, for example 6-10 px, tuned for usability;
  - ignore hit testing while drawing tools are active or while an editable UI target is being used;
  - do not block normal chart interaction when no indicator is hit.
- Add focused tests for pure hit-testing math if implemented as a pure helper.
- If precise hit testing is blocked by KLineCharts API limitations, implement the best approximation and state the limitation clearly in the final report.

Persistence and templates:
- Add a repository for indicator templates using Dexie if needed.
- Template records should be validated and normalized.
- Template names should be user-editable or generated from indicator type plus timestamp if no name UI is implemented. Keep the UI simple but functional.
- Default templates should be applied when adding a new indicator of that type, unless the existing product flow makes this too surprising. If defaults are applied, add tests.
- Export/import should round-trip templates.

Tests and verification:
- Add or update focused unit tests for:
  - OHLC amplitude calculation `(H - L) / L`;
  - OHLC legend latest/hover/leave state selection;
  - source-value helper for `open`, `high`, `low`, `close`, `hl2`, `hlc3`, `ohlc4`;
  - indicator config normalization from old rows with only `color` and `lineWidth`;
  - per-series style normalization for MA/BOLL/MACD/KDJ or representative multi-series indicators;
  - indicator template repository save/apply/delete/default behavior;
  - config export/import validation for templates and richer indicator configs;
  - rejection of malformed indicator style/source/template data;
  - indicator hit-testing math if line click support uses a pure helper.
- Add or update component tests where practical for:
  - OHLC legend rendering;
  - indicator legend rows rendering in the chart host;
  - legend settings action opens the settings dialog;
  - dialog tabs render Inputs/Style/Templates;
  - editing and saving a field updates the indicator config and re-applies indicators;
  - deleting from legend removes the indicator.
- Run the narrowest useful tests first, then run at least:
  - `npm run typecheck`
  - `npm run test -- src/features/indicators/calculations.test.ts src/features/indicators/indicatorConfigRepository.test.ts src/features/export/configExport.test.ts`
  - `npm run lint`
  - `npm run build`
- Also run the full test suite before completion:
  - `npm run test`
- Start a Vite dev server and use a browser/Playwright screenshot or DOM inspection to verify:
  - OHLC legend is visible;
  - default latest-candle state appears after data load or mock data;
  - moving/crosshairing changes the legend where feasible;
  - indicator legend rows appear for main and sub-pane indicators;
  - settings dialog opens from a legend action;
  - layout remains usable in multi-chart mode.
- If any browser verification cannot be run, report exactly what was skipped and why.

Acceptance criteria:
- Each chart pane shows a compact fixed top-left OHLC legend.
- OHLC legend defaults to the latest candle, updates to hovered/crosshair candle, and restores latest candle on pointer leave.
- OHLC legend displays `O`, `H`, `L`, `C`, and amplitude/range calculated as `(H - L) / L`.
- Main-pane indicators have TradingView-style legend rows under the OHLC line.
- Sub-pane indicators have legend rows in their own pane top-left area.
- Clicking an indicator legend row/action selects that indicator and exposes show/hide, settings, and delete actions.
- Clicking the actual indicator line selects the indicator where feasible, or a documented pixel-distance approximation is implemented without breaking chart interactions.
- Settings dialog has Inputs, Style, and Templates tabs.
- Indicator parameters, calculation source, per-series colors, line widths, line styles, visibility, deletion, and templates are editable/persistent according to the confirmed scope.
- Global templates by indicator type can be saved, applied, deleted, and marked as defaults.
- Existing old indicator configs and old exported configs still load/import safely.
- Config export/import includes and validates indicator templates and richer indicator config fields.
- Existing drawing tools, crosshair sync, fullscreen, PNG export, chart data loading, multi-chart layouts, and indicator rendering continue to work.
- All new user-facing text is localized in English and Chinese.
- Typecheck, focused tests, full tests, lint, and build pass, or any remaining issue is clearly documented with file-level detail.
```
