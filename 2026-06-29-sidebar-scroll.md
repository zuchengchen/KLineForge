# Goal: Sidebar Scroll Support

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-29-sidebar-scroll.md`; complete the KLineForge sidebar scroll fix only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

Update the current KLineForge Tauri/Solid frontend so the chart-left sidebar supports mouse-wheel vertical scrolling when its content exceeds the viewport height, while keeping the overall app page fixed and preserving chart workspace stability.

### Context

KLineForge is currently a Tauri/Rust/Solid/SQLite desktop charting app in `/home/czc/projects/working/stock/KLineForge`.

The current UI has a left sidebar rendered in `src/App.tsx` around the `<aside class="sidebar">` element. The sidebar contains brand, watchlist, symbol search, settings, indicators, and backend/database status panels. The global page/body is fixed with `overflow: hidden` in `src/styles/app.css`, and `.sidebar` currently does not provide its own vertical scrolling. In shorter windows, sidebar panels can be clipped so some items cannot be reached.

The primary issue to fix is that in a `1024x700` viewport, the current sidebar content should be scrollable from the top brand area down to the bottom backend/database status panel.

### Brainstorming Direction

Approved direction: use a minimal CSS/layout fix. Keep the app page fixed and make the sidebar itself vertically scrollable. Also inspect and, if clearly necessary, make small localized fixes for obvious clipping in the top toolbar or bottom dock. Do not redesign or restructure the full app layout.

Trade-off: this keeps the chart workspace stable and avoids broad layout risk, while solving the immediate accessibility/usability issue.

### Discovery Summary

Answered:
- Desired outcome: the left sidebar supports mouse-wheel vertical scrolling and all current sidebar items can be reached.
- Current problem: the sidebar has many items and shorter windows hide lower items.
- Target modules: `src/App.tsx`, `src/styles/app.css`, and optionally a small verification script under `scripts/`.
- User-facing behavior: the app page remains fixed; local UI regions scroll internally when needed.
- Scope: sidebar is primary; toolbar/bottom dock obvious clipping may be fixed if local and low risk.
- Verification: use automated commands plus browser/Playwright screenshot or interaction checks at `1024x700` and `1440x900`.
- Acceptance: at `1024x700`, scrolling the sidebar reaches the bottom backend/database status panel.
- Goal file path: `/home/czc/projects/working/stock/KLineForge/2026-06-29-sidebar-scroll.md`.
- Stop condition: stop and ask if verification fails and the cause cannot be located.

Defaulted:
- Use the smallest CSS/layout change that fits existing app patterns.
- Use existing test/build commands and add one small Playwright-style verification script if helpful.
- Keep current visual design, spacing, colors, and panel structure.

Not applicable:
- Data model, SQLite migrations, backend API changes, market data logic, security/permissions, feature flags, and release migration are not involved.

### Scope

In scope:
- Inspect the current sidebar, workspace, toolbar, and bottom dock layout in `src/App.tsx` and `src/styles/app.css`.
- Add or adjust CSS so `.sidebar` has stable height constraints, `min-height: 0` where needed, and `overflow-y: auto` or equivalent.
- Preserve horizontal layout, chart sizing, and existing panels.
- If necessary, add a small verification script following the repo's `scripts/verify-*.mjs` style to launch/inspect the app at the target viewports and confirm sidebar scrollability.
- Run formatting/type/test commands relevant to the touched frontend files.

Out of scope:
- Redesigning the sidebar, changing which panels exist, adding collapse/accordion behavior, or rearranging product workflows.
- Changing chart data fetching, Binance/Rust/SQLite behavior, indicators, drawings, cache semantics, or settings schema.
- Broad responsive redesign or mobile layout work.
- Changing desktop packaging or Tauri backend commands.

### Verification

Required automated verification:
- Run `npm run typecheck`.
- Run relevant frontend tests, at minimum `npm test -- src/App.test.tsx`, unless the implementation only changes CSS and no existing test is relevant; if skipped, state why.
- If a verification script is added, run it and require it to pass.

Required browser/Playwright verification:
- Start the local app in a way appropriate for this repo, such as Vite preview/dev server if needed.
- Verify at `1024x700` that:
  - the overall app page does not scroll;
  - the left `.sidebar` can be scrolled with wheel or equivalent;
  - the top brand area and bottom backend/database status panel are both reachable;
  - the chart workspace remains visible and stable.
- Verify at `1440x900` that:
  - the layout still looks normal;
  - no obvious toolbar, sidebar, chart, or bottom dock overlap is introduced.
- Capture or report evidence from screenshots, DOM metrics, or Playwright assertions.

Completion standard:
- Do not mark complete until the automated verification passes and the two viewport checks have been performed or an explicit user-approved verification change is recorded.

### Stop Conditions

Stop and ask the user before continuing if:
- The fix appears to require a broad layout rewrite rather than a localized CSS/layout change.
- Making the sidebar scrollable would break chart interaction, resize behavior, or fixed-page behavior in a way that is not clearly repairable.
- Verification fails and the cause cannot be located after reasonable debugging.
- Any unrelated dirty worktree changes conflict with the sidebar fix and cannot be safely worked around.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
