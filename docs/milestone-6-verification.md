# Milestone 6 Verification

## English

Milestone 6 is complete.

Implemented:

1. Active K-line WebSocket subscriptions through the market-data provider layer.
2. KLineCharts `subscribeBar` integration for live candle updates.
3. Current forming candle updates and new closed/new candle append behavior through KLineCharts update callbacks.
4. Visible per-chart live connection state.
5. Auto reconnect after unexpected WebSocket close.
6. Manual forced reconnect hook for browser verification in Vite dev mode only.
7. Duplicate and out-of-order protection through `KlineStreamDeduplicator`.
8. WebSocket K-lines are normalized into the internal `Kline` model and written into IndexedDB.
9. UI components still do not call Binance endpoints directly.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 12 test files and 36 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`: passed as regression coverage.
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-6/live-connection.png`

Browser verification coverage:

1. Waits for both default BTCUSDT USD-M charts to render.
2. Verifies live connection state is visible for both charts.
3. Reads chart data summaries through a dev-only debug hook.
4. Forces left and right live streams to reconnect.
5. Verifies reconnect does not reduce chart data.
6. Verifies reconnect does not append more than a small allowed number of new rows, guarding against duplicate candle appends.
7. Captures a desktop screenshot.
8. Fails on browser console errors.

Known notes:

1. The dev-only debug hook is exposed only when `import.meta.env.DEV` is true and is used only by browser verification scripts.
2. Binance USD-M Futures REST remains restricted in the current environment, so historical chart loading continues to use Binance Public Data archives before live WebSocket updates start.
3. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 6 已完成。

已实现：

1. 通过行情 provider 层订阅活跃 K 线 WebSocket。
2. 接入 KLineCharts `subscribeBar`，用于实时 candle 更新。
3. 通过 KLineCharts update callback 更新当前未收盘 candle，并在新 candle 到来时追加。
4. 每个图表显示实时连接状态。
5. WebSocket 非主动关闭后自动重连。
6. 增加仅 Vite dev 环境可用的强制重连验证钩子。
7. 通过 `KlineStreamDeduplicator` 做重复和乱序保护。
8. WebSocket K 线会标准化为内部 `Kline` 模型，并写入 IndexedDB。
9. UI 组件仍然不直接调用 Binance URL。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，12 个测试文件，36 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`：通过，用作回归验证。
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-6/live-connection.png`

浏览器验证覆盖：

1. 等待默认 BTCUSDT USD-M 左右图渲染完成。
2. 验证两个图表都有可见实时连接状态。
3. 通过仅开发环境启用的 debug hook 读取图表数据摘要。
4. 强制左右两个实时流重连。
5. 验证重连后图表数据没有减少。
6. 验证重连后没有异常追加大量 candle，从而防止重复 append。
7. 截取桌面截图。
8. 如果浏览器控制台出现 error，则验证失败。

已知说明：

1. debug hook 仅在 `import.meta.env.DEV` 为 true 时暴露，只用于浏览器验证脚本。
2. 当前环境中 Binance USD-M Futures REST 仍受限制，因此历史图表加载继续使用 Binance Public Data 归档，之后再启动实时 WebSocket 更新。
3. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
