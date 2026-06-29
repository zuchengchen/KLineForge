# Goal: Current Release Audit And Fix

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-29-current-release-audit-fix.md`; perform a release-level audit and fix pass for the current Tauri/Rust/Solid KLineForge version, complete only when the verification section passes or documented external blockers are accepted, and stop only for the listed stop conditions.

## Full Prompt

### Objective

Audit the current KLineForge `v0.1.0-tauri` implementation in `/home/czc/projects/working/stock/KLineForge`, identify and fix release-quality issues in the active Tauri/Rust/Solid version, remove or resolve currently documented first-stage degradations where practical, and verify the result with automated checks, Tauri build validation, core UI smoke coverage, and mandatory 100k large-chart interaction validation.

### Context

KLineForge is currently a Tauri/Rust/Solid/SQLite prerelease rewrite. The old React/Electron implementation under `legacy-src/` is migration reference only and is not a release target for this pass.

The current release documentation lists known first-stage degradations around drawings, indicator configuration, 1M overlays, cache task/range completeness UI, and Linux AppImage packaging environment limits. In this goal, known degradations are treated as issues to fix where they are part of the current app behavior. The 1M overlay degradation should be improved if practical, but 1M verification is not a required completion gate.

### Brainstorming Direction

Approved direction: perform a full release-level current-version audit and fix pass.

Approach:
- Start with automated checks and build validation to find reproducible failures.
- Inspect and exercise the current Tauri/Solid app for release-blocking and user-visible issues.
- Fix current-version code in `src/`, `src-tauri/`, active scripts, config, and release docs.
- Use `legacy-src/` only as reference for intended MVP behavior.
- Prioritize quality: fix all discovered issues where practical, including non-blocking experience problems.
- Do not expand scope into trading, accounts, API keys, cloud sync, non-Binance exchanges, old local data migration, or Web/Docker release support.

### Discovery Summary

Answered:
- Scope: current Tauri/Rust/Solid version only.
- Target areas: `src/`, `src-tauri/`, active scripts/config/docs.
- Verification: TypeScript, lint, tests, build, Rust fmt/clippy/test, Tauri build, UI/render smoke, and 100k chart verification.
- Performance: 100k full interaction is mandatory; 1M is best-effort only.
- Network: attempt real Binance/public-data checks; if failures are external or unstable, document command, error, and impact instead of blocking local fixes.
- Data compatibility: prerelease destructive SQLite/schema changes are allowed if needed, with documentation updates.
- Manual UI smoke: startup, dual charts, interval switching, symbol search/watchlist, market info, indicators, drawings, cache, CSV/PNG/config import/export, theme/language/session restore.
- Output: final concise repair report, not a separate audit report file unless docs must change.
- Goal file path: `/home/czc/projects/working/stock/KLineForge/2026-06-29-current-release-audit-fix.md`.

Assumptions:
- If UI smoke cannot be fully automated, scripted evidence plus concise manual-check notes are acceptable.
- If 1M overlay repair requires disproportionate architecture work, record it as a non-blocking risk, but do not let it weaken the 100k completion gate.
- Local Linux AppImage bundling limitations may be documented as environment/toolchain risk if `tauri build --no-bundle` succeeds and full bundling is not required by current verification.

### Scope

Codex may:
- Inspect and modify current-version files under `src/`, `src-tauri/`, active npm/Rust/Tauri config, verification scripts, README, and release docs.
- Run automated checks, builds, Tauri validation, browser/render smoke scripts, market-data smoke, and 100k large-chart verification.
- Fix TypeScript, Solid UI, Rust, SQLite, Tauri command/event, charting, export/import, cache, indicator, drawing, settings, i18n, and documentation issues found during the audit.
- Update release docs so fixed degradations are removed or reclassified as verified capability, and remaining limitations are accurate.
- Use existing project patterns and dependencies where possible.
- Make prerelease schema/data changes if needed, documenting any reset or migration impact.

### Out Of Scope

- `legacy-src/` as a release target, except as behavior reference.
- Trading, order placement, API keys, account data, PnL, user accounts, or cloud sync.
- Exchanges beyond Binance Spot and Binance USD-M Futures.
- Old IndexedDB/localStorage migration or old config-envelope compatibility.
- Web/Docker static deployment as a release target.
- Mandatory 1M performance verification.
- Adding broad permissions, secrets, private APIs, or external services.

### Verification

Required local checks:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run rust:fmt`
- `npm run rust:clippy`
- `npm run rust:test`
- `npm run tauri:build`

Required release smoke/performance checks:
- Run the current render smoke command if supported, such as `npm run verify:render`.
- Run mandatory 100k large-chart interaction verification, such as `npm run prepare:chart-dataset:100k` followed by `npm run verify:large-chart:100k`, using the app URL expected by the script.
- Attempt relevant market/public-data smoke if it is part of the current release workflow, such as `npm run verify:market-data`.

Required manual or scripted UI acceptance:
- Confirm startup works.
- Confirm dual-chart layout and interval switching work.
- Confirm symbol search and watchlist workflows work.
- Confirm market info renders.
- Confirm indicators can be configured at the intended release level.
- Confirm drawing tools and persistence work beyond the previously documented degradation where practical.
- Confirm cache management exposes intended range/task behavior where practical.
- Confirm CSV export, PNG export, and config import/export work.
- Confirm theme, language, and session restore work.

Completion evidence:
- All required non-network automated checks pass.
- Tauri build validation passes.
- 100k large-chart verification passes.
- Any external-network failures are documented with command, error, and why they are not local release blockers.
- Release docs match the actual fixed/remaining behavior.

### Stop Conditions

Stop and ask the user instead of guessing only if:
- A change would introduce trading, account access, API keys, secrets, private user data services, or broad new permissions.
- A fix requires replacing the core app direction or switching away from Tauri/Rust/Solid/SQLite.
- A core current-version feature must be removed instead of fixed or accurately documented.
- Required local verification cannot run because the environment or toolchain is missing in a way Codex cannot repair.
- A 100k full-interaction target appears unreachable without changing the performance standard.
- The worktree contains unexpected user changes in files that must be heavily rewritten and cannot be safely worked around.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
