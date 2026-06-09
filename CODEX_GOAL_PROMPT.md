# Codex Goal Prompt

Copy the prompt below into Codex Goal mode.

```text
Improve KLineForge according to the full post-MVP project review. Treat this as one end-to-end goal, but execute it milestone by milestone in a controlled order. Do not stop after only one improvement area unless blocked. Keep the existing MVP behavior intact while making the app more reliable, truthful, maintainable, and production-ready.

Project context:
KLineForge is a pure frontend React + TypeScript + Vite crypto charting app for Binance Spot and Binance USD-M Futures. It uses KLineCharts for Canvas rendering, Zustand for state, Dexie/IndexedDB for local persistence and cache, Vitest for tests, Playwright milestone scripts for browser verification, and Docker/Nginx for static deployment.

Current baseline:
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm audit --omit=dev` previously passed.
- The important review findings were:
  1. USD-M symbol search and leaderboards currently degrade to static fallback data in browser environments.
  2. USD-M historical K-line loading can be stale because Public Data monthly archives are preferred and recent REST/backfill gaps are not reliably filled.
  3. Cache tasks currently behave more like "recent archive import" than truthful complete coverage tracking.
  4. Cache range end-time semantics should be made accurate and consistently documented.
  5. `KLineChartHost.tsx` has too many responsibilities and should be split into maintainable hooks/modules without changing behavior.
  6. The main production bundle is above the default Vite warning threshold and should be improved with sensible code splitting.
  7. Config import validation is too shallow and can poison IndexedDB with malformed data.
  8. Static deployment and repo/process hygiene should be improved where practical.

Overall objective:
Make KLineForge significantly more trustworthy as a real charting tool by improving data freshness, true market data fallbacks, cache coverage semantics, chart host maintainability, import safety, bundle size, deployment hygiene, docs, and tests.

Execution rules:
- Work milestone by milestone in the order below.
- Before editing each milestone, inspect the relevant files and existing tests.
- Prefer existing architecture and abstractions over introducing unrelated frameworks.
- Keep changes scoped and avoid unrelated visual redesign.
- Preserve the MVP scope: do not add trading, API keys, accounts, cloud sync, alerts, order book, multi-exchange support, or backend implementation unless a minimal optional provider boundary/stub is needed.
- If a backend/proxy is needed for architecture, implement only the frontend provider boundary/configuration and clear documentation, not a full backend service.
- Maintain Chinese and English UI strings when new user-facing text is added.
- Persisted IndexedDB schema changes must be explicit and migration-safe.
- Do not remove existing tests or verification scripts.
- After every meaningful milestone, run the narrowest useful tests; before completion, run full checks.

Milestone 1: Data provider reliability and USD-M real market data
- Introduce a provider-chain or equivalent strategy so market data reads can try cache/direct REST/configured proxy/public-data/fallback in a clear order.
- Remove the browser-only unconditional static fallback for USD-M search and leaderboards.
- USD-M symbol search, gainers, losers, volume leaderboard, watchlist ticker rows, and market info should attempt real data first and only fall back when data access genuinely fails.
- Errors should be visible or diagnosable without spamming console errors in normal fallback cases.
- Add or update tests for Spot and USD-M success/failure/fallback behavior.

Milestone 2: Recent K-line gap backfill and source truthfulness
- Fix chart initial loading so Public Data monthly archives are not treated as sufficient when they leave a recent gap.
- After reading cache or Public Data, detect the missing range from the last available candle to now and try to fill it with REST or the provider chain.
- Keep WebSocket as live continuation, not the only recent-gap repair mechanism.
- Surface data source state honestly, for example cache/rest/public-data/mixed/fallback if needed.
- Add tests for stale archive data plus recent REST backfill, empty data, REST failure, and fallback behavior.

Milestone 3: Cache task semantics and coverage accuracy
- Redesign cache task semantics so the UI and data model clearly express what period is cached and what remains missing.
- Avoid calling a task "complete" unless its declared range is complete.
- Use accurate K-line range boundaries; do not use only the last candle `openTime` as the coverage end if the interval implies a later close boundary.
- Keep unsupported Public Data intervals understandable to the user instead of opaque failures.
- Update cache docs and tests around range merging, missing-range detection, and task progress.

Milestone 4: Safe config import/export
- Strengthen config import validation before mutating IndexedDB.
- Validate envelope, schema versions, settings shape, session shape, watchlist rows, drawings, drawing points, indicator configs, supported market types, chart IDs, intervals, and indicator names.
- Make import behavior safe: malformed imports should fail before clearing existing data.
- Add tests for valid import, invalid import, partial/malformed arrays, unsupported intervals, bad drawings, and preservation of existing data after failed import.

Milestone 5: Split `KLineChartHost.tsx` safely
- Refactor the large chart host into smaller hooks/modules while preserving behavior:
  - chart instance lifecycle and resize
  - chart data loading and WebSocket subscription
  - chart styles/settings
  - crosshair synchronization
  - indicator application
  - drawing state/history/persistence
  - keyboard shortcuts/debug handles
- Keep public props and UI behavior stable unless a small improvement is clearly needed.
- Add or adjust tests around the extracted pure logic where practical.
- Run existing chart, drawing, indicator, cache, and app tests after this refactor.

Milestone 6: Bundle/code-splitting and deployment hygiene
- Reduce the initial production bundle where practical using dynamic imports for heavy or non-initial features such as cache management, indicator panel, export/import, or ZIP parsing.
- Keep user interactions functional after lazy loading.
- Update Vite config only if needed and avoid hiding warnings without improvement.
- Improve Nginx/static deployment headers where safe, such as basic security headers and correct cache behavior for hashed assets versus `index.html`.
- Re-run production build and document resulting bundle size.

Milestone 7: Documentation and verification
- Update README and docs to accurately describe:
  - data source order and fallback behavior
  - known Binance CORS/regional limitations
  - Public Data archive limitations
  - cache coverage semantics
  - import/export safety
  - deployment notes
- Add a concise implementation note or changelog-style summary for these improvements.
- Run full verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm audit --omit=dev`
- If browser verification scripts require a dev server, run the relevant scripts that cover changed behavior, especially final milestone verification and cache/chart scripts.
- Report any verification that could not be run and why.

Acceptance criteria:
- USD-M market search/leaderboards no longer use static fallback before attempting real data.
- Chart history is not silently stale when Public Data leaves recent gaps.
- Cache management tells the truth about coverage, completion, unsupported intervals, and failures.
- Config import cannot destroy current local data when the imported file is malformed.
- `KLineChartHost.tsx` is materially smaller and responsibilities are split into maintainable modules.
- Production build still succeeds and initial bundle size is improved or the remaining size is justified.
- Docs match actual behavior.
- All relevant tests and checks pass.
```
