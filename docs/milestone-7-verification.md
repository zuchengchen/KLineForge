# Milestone 7 Verification

## English

Milestone 7 is complete.

Implemented:

1. Symbol search panel.
2. `/` shortcut opens the symbol search panel unless the user is typing in an editable field.
3. Search panel uses the current Spot / USD-M Futures market context.
4. Gainers, losers and quote-volume leaderboard tabs.
5. Symbol selection updates both charts.
6. Symbol selection preserves the left and right intervals.
7. Watchlist add, delete and reorder controls.
8. Watchlists are separated by market and persisted in IndexedDB.
9. Watchlist rows show symbol, latest price and 24h change fields.
10. Watchlist persists after reload.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 14 test files and 41 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`: passed as chart regression coverage.
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`: passed as realtime regression coverage.
7. `node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-7/watchlist-search.png`

Browser verification coverage:

1. Clears local app state.
2. Opens search with `/`.
3. Searches and selects `ETHUSDT`.
4. Verifies both chart headers switch to `ETHUSDT`.
5. Verifies left/right intervals remain `5m / 1h`.
6. Adds `BNBUSDT` to the watchlist.
7. Reorders `BNBUSDT` above `ETHUSDT`.
8. Reloads the page.
9. Verifies `ETHUSDT` and `BNBUSDT` persist in the watchlist.
10. Verifies the reordered watchlist order persists.
11. Verifies charts are not left in loading state before screenshot.
12. Fails on browser console errors.

Data source notes:

1. In some browser environments, USD-M Futures ticker REST is blocked by CORS / regional restrictions.
2. Post-MVP hardening removed the browser-only USD-M static short-circuit. USD-M search and leaderboards now try real data first through the provider chain, then use fallback rows only after real data access fails.
3. Spot search can use `data-api.binance.vision` ticker fallback when direct Binance Spot REST is unavailable.
4. Optional proxy configuration is available for Binance-compatible REST paths without implementing a backend in the MVP.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 7 已完成。

已实现：

1. 交易对搜索面板。
2. `/` 快捷键打开交易对搜索面板；用户正在输入时不会触发。
3. 搜索面板使用当前 Spot / USD-M Futures 市场上下文。
4. 涨幅榜、跌幅榜、成交额榜标签。
5. 选择交易对会同时更新左右两个图表。
6. 选择交易对后保留左右图的周期。
7. 自选列表支持添加、删除和排序。
8. 自选列表按市场隔离，并持久化到 IndexedDB。
9. 自选列表行显示交易对、最新价和 24h 涨跌幅字段。
10. 自选列表刷新后仍可恢复。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，14 个测试文件，41 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`：通过，作为图表回归验证。
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`：通过，作为实时更新回归验证。
7. `node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-7/watchlist-search.png`

浏览器验证覆盖：

1. 清空本地应用状态。
2. 用 `/` 打开搜索。
3. 搜索并选择 `ETHUSDT`。
4. 验证左右图表标题都切换为 `ETHUSDT`。
5. 验证左右周期仍保持 `5m / 1h`。
6. 添加 `BNBUSDT` 到自选。
7. 将 `BNBUSDT` 排到 `ETHUSDT` 前面。
8. 刷新页面。
9. 验证 `ETHUSDT` 和 `BNBUSDT` 仍在自选中。
10. 验证自选排序持久化。
11. 截图前验证图表没有停留在 loading 状态。
12. 浏览器控制台出现 error 时验证失败。

数据源说明：

1. 部分浏览器环境下 USD-M Futures ticker REST 会被 CORS / 区域限制阻止。
2. Post-MVP 改进已移除浏览器中 USD-M 静态兜底的前置短路。USD-M 搜索和榜单会先通过 provider chain 尝试真实数据，真实数据失败后才使用兜底行。
3. Spot 搜索在直连 Binance Spot REST 不可用时，可使用 `data-api.binance.vision` 的 ticker fallback。
4. 当前支持可选 Binance 兼容 REST 代理配置，但 MVP 不实现后端服务。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
