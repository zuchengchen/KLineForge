# KLineForge Multi-Chart Layout Goal Prompt

Copy the prompt below into Codex Goal mode.

```text
Implement configurable 1/2/3/4-chart layouts for KLineForge.

Project context:
KLineForge is a React + TypeScript + Vite crypto charting app for Binance Spot and Binance USD-M Futures. It uses KLineCharts (`klinecharts@10.0.0-beta3`) for canvas K-line rendering, Zustand for session/settings state, Dexie/IndexedDB for local persistence, i18next for English/Chinese UI strings, and Vitest for tests.

Current behavior:
- The main chart workspace is hard-coded as a two-chart left/right split.
- `ChartId` is currently only `left | right`.
- Session state currently stores `leftInterval`, `rightInterval`, `activeChartId`, and `fullscreenChartId`.
- `AppShell` renders only the left and right `ChartPane` components.
- Indicators, drawings, PNG export handles, debug handles, crosshair sync, cache task creation, config export/import, and some tests depend on the current chart id model.

Overall objective:
Add a user-facing chart layout setting that supports single-chart, two-chart, three-chart, and four-chart modes while preserving the existing two-chart default and maintaining compatibility with existing persisted `left`/`right` user data.

Confirmed product decisions:
- The default first-launch and migrated layout must remain two charts.
- Add a layout entry in the Settings panel.
- Also add a compact top-market-bar quick switch with buttons/segments labeled `1`, `2`, `3`, `4`.
- The top quick switch should be a compact segmented control, not a large toolbar or card.
- Layout modes:
  - 1 chart: show only chart 1, filling the chart workspace.
  - 2 charts: keep the current left/right split behavior and visual rhythm.
  - 3 charts: show chart 1 as a larger left pane spanning two rows, with chart 2 and chart 3 stacked vertically on the right.
  - 4 charts: show a standard 2x2 grid.
- Switching from more charts to fewer charts must hide extra charts without deleting their intervals, indicators, drawings, or other per-chart state.
- Switching back to more charts should restore those chart panes and their last configured intervals.
- Do not implement arbitrary drag-resize, freeform layouts, multiple workspaces, or detachable panels in this goal.

Implementation guidance:
- Start by inspecting:
  - `src/types/domain.ts`
  - `src/app/defaults.ts`
  - `src/app/stores/sessionStore.ts`
  - `src/persistence/settingsPersistence.ts`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/AppShell.css`
  - `src/features/chart/KLineChartHost.tsx`
  - `src/features/chart/chartExportRegistry.ts`
  - `src/features/chart/chartDebugHandles.ts`
  - `src/features/chart/crosshairSync.ts`
  - `src/features/cache/CacheManagementPage.tsx`
  - `src/features/export/ExportPanel.tsx`
  - `src/features/export/configExport.ts`
  - `src/features/indicators/indicatorConfigRepository.ts`
  - `src/features/drawings/drawingRepository.ts`
  - `src/i18n/resources.ts`
  - existing tests around defaults, session store, config export, chart sync, cache, export, and app behavior.
- Prefer a small shared layout/chart-id helper module if it prevents repeated conditional logic in `AppShell`, the store, export, and cache code.
- Keep existing `left` and `right` chart ids for backwards compatibility.
- Extend the chart id model to support two additional chart ids, for example:
  - `left`
  - `right`
  - `third`
  - `fourth`
- Display these as user-facing chart numbers/names, not as raw internal ids:
  - Chart 1 / 图表 1
  - Chart 2 / 图表 2
  - Chart 3 / 图表 3
  - Chart 4 / 图表 4
- Introduce a typed layout mode such as `ChartLayout = 1 | 2 | 3 | 4`.
- Introduce a typed ordered chart id list and helper functions such as:
  - all chart ids in stable order;
  - visible chart ids for a layout;
  - default interval for each chart id;
  - chart title/label lookup;
  - guard/normalization for valid chart ids and layout values.
- Migrate the session model to support per-chart intervals for up to four charts. Prefer a normalized internal shape such as `chartIntervals: Record<ChartId, Interval>` if it fits cleanly, but keep compatibility with existing `leftInterval` and `rightInterval` persisted sessions/configs.
- If preserving `leftInterval` and `rightInterval` fields alongside a new interval map is simpler for compatibility, make the source of truth explicit and keep behavior deterministic.
- Suggested default intervals:
  - chart 1 / left: `5m`
  - chart 2 / right: `1h`
  - chart 3 / third: `4h`
  - chart 4 / fourth: `1d`
- Persist the selected layout in the same session persistence flow as the current active chart/fullscreen/sidebar state.
- Hydration and import should tolerate older sessions that do not have the new layout or interval fields:
  - missing layout defaults to `2`;
  - missing third/fourth intervals get default intervals;
  - existing `leftInterval` and `rightInterval` are preserved;
  - invalid chart ids/layout values are rejected or normalized safely according to existing validation patterns.
- Avoid a destructive IndexedDB migration unless it is truly necessary. This session/settings data is already stored as settings records and localStorage JSON; prefer tolerant validation/normalization over schema churn.

App shell behavior:
- Refactor `ChartPane` so it receives enough metadata or uses helpers to handle any supported chart id.
- `ChartPane` should read and update the interval for its own chart id.
- The chart workspace should render panes by iterating over the visible chart ids for the selected layout.
- The active chart should always be one of the visible charts:
  - when switching to a layout that hides the current active chart, move active chart to the first visible chart;
  - clicking a visible pane still activates it.
- Fullscreen behavior must remain intact:
  - `F` should fullscreen the active visible chart;
  - `Esc` should exit fullscreen;
  - switching layouts while fullscreen should either exit fullscreen or safely keep fullscreen only if the fullscreen chart remains visible;
  - never render a blank fullscreen state because the fullscreen chart was hidden.
- The market bar metadata should show the current visible chart intervals in a compact way without overflowing obvious desktop widths.
- Cache task creation should include the intervals for currently visible chart panes, not just old left/right intervals.
- Cache management should receive the visible intervals or otherwise operate on the current layout's chart intervals.
- CSV export can remain symbol/interval-oriented, but any UI text/meta must not imply only left/right if more panes are visible.
- PNG export should work for every visible chart. Update `ExportPanel` if it currently exposes only left/right PNG buttons.
- If a hidden chart has no mounted canvas, its PNG export control should not appear or should be disabled with an existing-style safe message.

UI and styling requirements:
- Add a compact segmented layout switch to the top market bar with labels `1`, `2`, `3`, `4`.
- Add a Settings panel layout control with localized text.
- Use existing design language: quiet desktop terminal style, compact controls, no landing-page or marketing UI.
- Do not add card-heavy decorative UI or large explanatory in-app copy.
- Make button labels and selected states fit within the market bar at the current desktop minimum width.
- Keep all new user-facing strings in both English and Chinese in `src/i18n/resources.ts`.
- Suggested i18n keys include:
  - `chartLayout`
  - `chartLayouts.one`
  - `chartLayouts.two`
  - `chartLayouts.three`
  - `chartLayouts.four`
  - `chartNames.left`
  - `chartNames.right`
  - `chartNames.third`
  - `chartNames.fourth`
- CSS guidance:
  - `chart-grid--layout-1`: one pane filling the grid.
  - `chart-grid--layout-2`: two columns, preserving current dual-pane behavior.
  - `chart-grid--layout-3`: two columns and two rows; first visible pane spans both rows on the left; second and third panes stack on the right.
  - `chart-grid--layout-4`: 2x2 grid.
  - Keep `min-width: 0` and `min-height: 0` on grid children so KLineCharts can resize properly.
  - Use stable grid sizing and avoid text/controls resizing panes unexpectedly.

Persistence and compatibility:
- Existing user sessions, settings, drawings, indicators, watchlists, and cache data must continue to load.
- Existing `left` and `right` drawings/indicator configs must remain attached to chart 1 and chart 2.
- New `third` and `fourth` chart ids should be accepted by drawing and indicator persistence/validation where chart ids are validated.
- Config export/import must support the new layout and chart ids.
- Config import should continue to reject malformed chart ids and intervals rather than poisoning IndexedDB.
- Existing exported configs that only contain `leftInterval` and `rightInterval` should still import successfully.
- Exported configs after this change should include enough session data to restore layout and per-chart intervals.

Tests and verification:
- Add or update focused unit tests for:
  - default session layout and default intervals;
  - session hydration from an old two-chart persisted session;
  - changing layout and keeping/restoring per-chart intervals;
  - active chart normalization when the active chart becomes hidden;
  - config export/import validation for `third` and `fourth` chart ids;
  - rejection of invalid chart ids/layout values;
  - visible interval calculation for 1/2/3/4 layouts.
- Add or update component tests around `AppShell` if existing test patterns make that practical:
  - the top quick switch renders `1`, `2`, `3`, `4`;
  - changing layout changes the number of chart panes;
  - Settings panel exposes the layout control.
- Run the narrowest useful tests first, then run at least:
  - `npm run typecheck`
  - `npm run test -- src/app/defaults.test.ts src/app/stores/sessionStore.test.ts src/features/export/configExport.test.ts`
  - `npm run lint`
  - `npm run build`
- If there are existing Playwright or milestone verification scripts that cover layout/chart rendering, run the most relevant one or start a Vite dev server and manually verify with a browser screenshot.
- If any verification cannot be run, report exactly what was skipped and why.

Acceptance criteria:
- The app still opens by default in the existing two-chart layout.
- The Settings panel has a localized chart layout control for 1/2/3/4 charts.
- The top market bar has a compact 1/2/3/4 quick switch.
- Switching to 1 chart shows only chart 1 and it fills the chart workspace.
- Switching to 2 charts preserves the current left/right split experience.
- Switching to 3 charts shows chart 1 large on the left and charts 2/3 stacked on the right.
- Switching to 4 charts shows a 2x2 grid.
- Each visible chart has its own interval selector and changing one chart's interval does not overwrite the others.
- Hidden charts keep their last interval and per-chart state when they are shown again.
- Active-chart outline, `F` fullscreen, `Esc`, indicators, drawings, chart data loading, crosshair sync, and PNG export continue to work for visible charts.
- Cache tasks use the visible layout's intervals.
- Existing persisted `left`/`right` data and old config exports remain compatible.
- Typecheck, focused tests, lint, and build pass, or any remaining issue is clearly documented with file-level detail.
```
