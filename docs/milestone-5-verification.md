# Milestone 5 Verification

## English

Milestone 5 is complete.

Implemented:

1. KLineCharts mounts in both left and right chart panes.
2. Default symbol is BTCUSDT with USD-M Futures market selected.
3. Left chart defaults to 5m.
4. Right chart defaults to 1h.
5. Historical K-lines load through the market-data layer, not directly from React UI components.
6. Browser-first USD-M historical loading uses Binance Public Data monthly K-line archives from `data.binance.vision`.
7. Loaded K-lines are written into IndexedDB, so subsequent opens can load from local cache.
8. KLineCharts data loading is protected against stale async effects in React StrictMode.
9. Basic time-linked crosshair plumbing is in place through KLineCharts `onCrosshairChange`.
10. The browser verification script checks for ready chart state, data source labels, and actual red/green candle pixels in both chart panes.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 11 test files and 34 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-5/dual-chart.png`

Data source notes:

1. Direct browser access to Binance USD-M Futures REST (`https://fapi.binance.com/fapi/v1/klines`) returned HTTP 451 / CORS fetch failures in the current environment.
2. The MVP remains pure frontend. No backend or dev proxy was introduced.
3. The chart data loader uses Binance Public Data monthly USD-M Futures K-line ZIP archives from `https://data.binance.vision`.
4. The loader starts from the previous complete monthly archive to avoid predictable current-month 404s.
5. The future backend proxy abstraction remains reserved through the market-data provider architecture.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 5 已完成。

已实现：

1. 左右两个图表面板都挂载了 KLineCharts。
2. 默认市场为 USD-M Futures，默认交易对为 BTCUSDT。
3. 左图默认周期为 5m。
4. 右图默认周期为 1h。
5. 历史 K 线通过行情数据层加载，React UI 组件不直接请求 Binance URL。
6. 浏览器环境下的 USD-M 历史 K 线优先使用 `data.binance.vision` 的 Binance Public Data 月度 K 线归档。
7. 加载后的 K 线会写入 IndexedDB，后续打开可从本地缓存读取。
8. KLineCharts 数据加载已处理 React StrictMode 下的过期异步 effect 问题。
9. 已通过 KLineCharts `onCrosshairChange` 预留并实现基础时间联动逻辑。
10. 浏览器验证脚本会检查图表 ready 状态、数据源标记，并确认左右两张图都有真实红绿蜡烛像素。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，11 个测试文件，34 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-5/dual-chart.png`

数据源说明：

1. 当前环境中，浏览器直连 Binance USD-M Futures REST (`https://fapi.binance.com/fapi/v1/klines`) 会遇到 HTTP 451 / CORS fetch 失败。
2. MVP 仍保持纯前端，没有引入后端，也没有引入开发代理。
3. 图表数据加载器使用 `https://data.binance.vision` 的 Binance Public Data 月度 USD-M Futures K 线 ZIP 归档。
4. 加载器从上一个完整月份开始探测，避免当前月份归档尚未生成导致可预期的 404。
5. 未来后端行情代理仍通过 market-data provider 架构预留。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
