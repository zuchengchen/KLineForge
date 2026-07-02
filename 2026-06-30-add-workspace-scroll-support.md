# Goal: Add Workspace Scroll Support

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-30-add-workspace-scroll-support.md`; complete the task only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

In the KLineForge frontend, make the main chart/workspace area support vertical mouse-wheel scrolling so content that does not fit on shorter screens remains reachable, while preserving the existing independent scrolling behavior of the sidebar and keeping both charts rendered correctly.

### Context

The repo is `/home/czc/projects/working/stock/KLineForge`, a Solid/Vite/Tauri app. The relevant files are expected to be around `src/App.tsx`, `src/components/ChartPane.tsx`, and `src/styles/app.css`.

Current layout observations:
- `body`, `.app`, and `.workspace` are height-constrained to the viewport and hide overflow.
- `.sidebar` already has `overflow-y: auto`.
- `.workspace` uses a fixed grid with toolbar, chart grid, and bottom dock.
- `.chart-grid` and `.chart-pane` use `min-height: 0`, which makes the charts fit the fixed available space but prevents the main content from becoming scrollable when the viewport is too short.

The user reports that the sidebar has a scrollbar, but the chart/main area does not, causing some content to be inaccessible on screen.

### Brainstorming Direction

Approved direction: make `.workspace` the main vertical scroll container while preserving the sidebar as its own scroll container. Add reasonable minimum heights or responsive sizing for the chart area and bottom dock so the main workspace can exceed the viewport and scroll naturally. Mouse wheel events over charts should prioritize scrolling the main workspace, not chart zoom/pan, for this task.

Trade-off: this is slightly broader than adding overflow only to the chart grid, but it solves both hidden chart-area and bottom-dock content without disrupting sidebar behavior.

### Discovery Summary

Answered:
- Desired outcome: main chart/workspace content is vertically scrollable and no longer hidden on short screens.
- Current pain: sidebar scrolls, chart/workspace does not.
- Target area: frontend layout/CSS and only necessary chart resize handling.
- Desired wheel behavior: wheel over chart should scroll the main workspace first.
- Scope boundary: do not change data loading, indicators, backend, persistence, or market logic.
- Verification: run type checking and perform a small-height browser check for scrolling and nonblank charts.

Defaulted:
- Goal file path: `/home/czc/projects/working/stock/KLineForge/2026-06-30-add-workspace-scroll-support.md`.
- Documentation/release notes are out of scope unless implementation clearly requires a short note.
- No feature flag or rollout switch is needed.

Skipped:
- Exact smallest supported viewport height. Use a practical small-height viewport in verification, such as around `1024x520` or similar.
- Whether to create a permanent Playwright script or use an equivalent temporary verification. Prefer adding a focused script if it fits existing project patterns.

Not applicable:
- Data model, persistence, migrations, secrets, permissions, compliance, concurrency, and external-service dependencies are not involved.
- Backward-compatible data migration is not needed because no stored data format changes.

### Scope

Codex may:
- Inspect and modify frontend layout files, especially `src/styles/app.css`.
- Modify `src/App.tsx` or `src/components/ChartPane.tsx` only if needed for correct resize behavior after the workspace becomes scrollable.
- Add or update a focused verification script if existing scripts cannot check the small-height scrolling behavior.
- Run local build/typecheck/preview/browser verification commands.

Implementation should:
- Preserve independent sidebar scrolling.
- Make the main `.workspace` or equivalent main-content container vertically scrollable.
- Keep toolbar, chart grid, and bottom dock usable on short screens.
- Ensure wheel events over the chart area scroll the workspace vertically for this task.
- Keep chart canvases nonblank and correctly sized after layout changes.
- Avoid layout shifts or overlapping text/UI caused by the scroll changes.

### Out Of Scope

Do not:
- Change backend/Rust/Tauri command behavior.
- Change chart data fetching, caching, indicators, drawings, live stream, persistence, or database schema.
- Redesign the product UI beyond what is necessary for scroll support.
- Add new user settings or persisted configuration.
- Change chart interaction semantics beyond what is needed to prioritize page/workspace scrolling on wheel.

### Verification

Run these checks before marking complete:

1. `npm run typecheck`

2. Run a browser verification against the built or dev-served app. Acceptable path:
   - `npm run build`
   - start preview, for example `npm run preview -- --host 127.0.0.1 --port 4173`
   - use Playwright, an existing script, or a new focused script to verify at a short viewport such as `1024x520`:
     - `.sidebar` remains independently scrollable when its content exceeds its height.
     - `.workspace` has vertical overflow when the content exceeds the viewport.
     - wheel input over a chart surface increases `.workspace.scrollTop`.
     - bottom-dock content can be reached by scrolling the workspace.
     - both chart panes still have canvas elements and the canvases are nonblank.

If an existing verification script is updated or a new script is added, run that script and include its result in the final report.

### Stop Conditions

Stop and ask the user before proceeding if:
- Achieving workspace scroll requires changing backend/data/indicator behavior.
- Lightweight Charts prevents wheel-over-chart workspace scrolling without a more invasive interaction change.
- The implementation would remove or significantly alter existing chart pan/zoom behavior outside the requested scroll priority.
- Verification cannot run because required browser/runtime dependencies are missing.
- A small-height layout fix would require a major redesign rather than scoped CSS/layout changes.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
