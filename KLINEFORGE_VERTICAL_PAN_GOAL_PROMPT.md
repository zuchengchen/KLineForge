# KLineForge Vertical Pan Goal Prompt

Copy the prompt below into Codex Goal mode.

```text
Implement vertical chart-canvas panning for KLineForge.

Project context:
KLineForge is a React + TypeScript + Vite crypto charting app that uses KLineCharts (`klinecharts@10.0.0-beta3`) for canvas K-line rendering. The current chart already supports normal left/right panning through KLineCharts, and it has custom Y-axis wheel zoom plus Y-axis double-click reset in `src/features/chart/useYAxisWheelZoom.ts`.

Problem:
When the user clicks and drags inside the chart, the visible chart can currently move left/right only. Add support for moving the visible price area up/down while dragging, so the chart canvas feels movable in both directions.

Confirmed interaction decisions:
- Vertical movement means price-axis panning: K-lines, indicators, overlays and the visible price scale should move vertically by shifting the manual Y-axis range. Do not move the DOM container with CSS transforms.
- Keep the existing horizontal time-axis panning behavior intact.
- A diagonal drag should allow both behaviors at the same time: KLineCharts may continue handling horizontal panning while the new code applies vertical price-axis panning.
- The new vertical panning trigger area is the main K-line drawing area, not the right Y-axis only.
- Preserve the existing right Y-axis wheel zoom behavior.
- Preserve the existing right Y-axis double-click reset behavior, and make that reset clear both manual Y-axis zoom and manual vertical pan.
- Switching market, symbol, or interval should reset the manual Y-axis range back to automatic KLineCharts behavior.
- Do not add new UI buttons or new visible copy for this feature.
- Drawing interactions have priority over vertical panning. Creating a drawing, dragging an existing drawing, interacting with drawing toolbar controls, chart action buttons, or other UI controls must not be broken by this feature.
- If KLineCharts overlay events cannot reliably distinguish an overlay drag from a chart-canvas drag, prefer disabling vertical panning while a drawing tool is pending or a drawing object is selected rather than risking broken drawing behavior.

Implementation guidance:
- Start by inspecting:
  - `src/features/chart/KLineChartHost.tsx`
  - `src/features/chart/useYAxisWheelZoom.ts`
  - `src/features/chart/useYAxisWheelZoom.test.tsx`
  - `src/features/chart/chartOverlayConstants.ts`
  - KLineCharts typings in `node_modules/klinecharts/dist/index.d.ts`
- Prefer extending or renaming `useYAxisWheelZoom.ts` into a more general Y-axis interaction hook if that keeps the code cohesive. Avoid duplicating manual Y-axis range state in separate hooks.
- Use `chart.overrideYAxis` with the existing candle pane id (`overlayPaneId`, currently `candle_pane`) to apply the manual range.
- Reuse the current manual range model:
  - when no manual range exists, derive the current visible price range with `chart.convertFromPixel` at the top and bottom of the main pane;
  - while dragging vertically, translate that range by the price delta represented by the pointer movement;
  - keep the range span unchanged during pan;
  - keep the existing wheel zoom anchored to the cursor;
  - reset to the default Y-axis gap and automatic `defaultRange` when resetting.
- Attach pointer or mouse listeners to the chart main drawing DOM returned by `chart.getDom(overlayPaneId, 'main')`. Clean them up on unmount.
- Only begin vertical panning from a primary-button pointer/mouse down inside the main drawing area.
- Do not call `preventDefault` or `stopPropagation` in a way that prevents KLineCharts from continuing horizontal panning unless there is no practical alternative. Horizontal panning must continue to work.
- Ignore panning starts from editable/control targets such as inputs, selects, buttons, textareas, links, elements with ARIA button/menu roles, and the existing drawing toolbar/action controls.
- Keep pointer capture and window-level move/up handling robust so panning stops even if the pointer leaves the chart.
- Avoid global state; keep the behavior per chart instance.
- Keep TypeScript strict and avoid broad `any` casts unless KLineCharts typings require a narrow compatibility cast like the existing `overrideYAxis` call.

Tests and verification:
- Add or update focused Vitest coverage around the Y-axis interaction hook.
- Test that wheel zoom still applies a manual range and double-click resets it.
- Test that a vertical drag on the main chart DOM applies a manual Y-axis range whose span is unchanged and whose `from`/`to` are shifted.
- Test cleanup/unmount behavior where practical.
- Test that non-primary-button drags and events from UI/control targets do not start vertical panning if this is implemented inside a pure/helper-friendly path.
- Run the narrowest useful tests first, then run at least:
  - `npm run typecheck`
  - `npm run test -- src/features/chart/useYAxisWheelZoom.test.tsx`
  - `npm run lint`
- If the hook is renamed, run the renamed test file instead and update imports/tests accordingly.

Acceptance criteria:
- Dragging the main chart drawing area vertically moves the visible price range up/down.
- Dragging horizontally still moves the chart left/right as before.
- Diagonal drag does not feel broken; horizontal and vertical movement can both happen.
- Existing Y-axis wheel zoom continues to work.
- Y-axis double-click resets both zoom and vertical pan to automatic scaling.
- Market/symbol/interval changes reset manual vertical pan and zoom.
- Drawing creation, drawing selection, drawing movement, toolbar controls, chart action buttons, and other UI controls still work.
- No new visible UI is added.
- Typecheck, focused tests, and lint pass, or any inability to run them is clearly reported.
```
