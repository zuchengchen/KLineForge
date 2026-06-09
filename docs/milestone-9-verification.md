# Milestone 9 Verification

## English

Milestone 9 is complete.

Implemented:

1. Pure indicator calculation modules for MA, EMA, BOLL, Supertrend, Volume, MACD, RSI, ATR and KDJ.
2. Indicator definition registry with pane metadata, default parameters and default styles.
3. IndexedDB persistence for per-chart indicator configurations.
4. Default indicators per chart: MA on the main pane and VOL on a sub pane.
5. Indicator add/search panel.
6. Active indicator rows with parameter, color, line width, visibility and delete controls.
7. Left and right chart indicator configurations remain independent.
8. KLineCharts integration for built-in indicators and custom KLineForge ATR/Supertrend registration.
9. Browser verification for indicator add, hide and persistence.
10. IndexedDB schema upgrade fix so `indicatorConfigs` is introduced in database version 2 without changing existing primary keys.
11. K-line cache writes are chunked to avoid long IndexedDB write starvation while users edit indicator settings.
12. Indicator setting actions have timeout/error feedback instead of leaving controls disabled indefinitely.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-9.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 17 test files and 57 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-9.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-9/indicators.png`

Browser verification coverage:

1. Opens the default BTCUSDT USD-M dual-chart screen.
2. Opens the left chart indicator panel.
3. Verifies default MA and VOL configurations exist.
4. Adds MACD from the indicator catalog.
5. Verifies MACD appears in the active indicator list.
6. Verifies MACD is persisted in IndexedDB for the left chart.
7. Hides the left chart MA indicator and verifies the hidden state is persisted.
8. Reloads the application.
9. Verifies the left chart MACD and hidden MA states persisted after reload.
10. Verifies the right chart did not receive the left chart's MACD config.
11. Captures a desktop screenshot.
12. Fails on browser console errors other than non-actionable static resource 404 noise.

Important scope note:

1. First-version custom indicator source editing is intentionally not implemented.
2. Pine Script and TradingView indicator imports are intentionally not implemented.
3. The calculation and definition layers are separated so a later custom indicator system can be added without rewriting the chart integration surface.
4. Indicator rendering depends on KLineCharts built-ins where available, with KLineForge custom registrations covering ATR and Supertrend.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 9 已完成。

已实现：

1. MA、EMA、BOLL、Supertrend、Volume、MACD、RSI、ATR、KDJ 的纯计算模块。
2. 指标定义注册表，包含主/副图分类、默认参数和默认样式。
3. 每张图独立的指标配置 IndexedDB 持久化。
4. 每张图默认指标：主图 MA，副图 VOL。
5. 指标添加/搜索面板。
6. 已启用指标行，支持参数、颜色、线宽、显示/隐藏和删除。
7. 左右图指标配置保持独立。
8. 接入 KLineCharts 内置指标，并注册 KLineForge 自定义 ATR/Supertrend。
9. 浏览器验证覆盖指标添加、隐藏和持久化。
10. 修复 IndexedDB schema 升级：`indicatorConfigs` 在数据库 v2 新增，不修改旧表主键。
11. K 线缓存写入改为分块写入，避免长时间占用 IndexedDB 导致用户编辑指标设置被饿住。
12. 指标设置操作加入超时和错误反馈，避免控件无限禁用。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-9.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，17 个测试文件，57 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-9.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-9/indicators.png`

浏览器验证覆盖：

1. 打开默认 BTCUSDT USD-M 左右双图页面。
2. 打开左图指标面板。
3. 验证默认 MA 和 VOL 配置存在。
4. 从指标目录添加 MACD。
5. 验证 MACD 出现在已启用指标列表。
6. 验证左图 MACD 已写入 IndexedDB。
7. 隐藏左图 MA，并验证隐藏状态已持久化。
8. 重新加载应用。
9. 验证重载后左图 MACD 和隐藏 MA 状态仍然存在。
10. 验证右图没有收到左图的 MACD 配置。
11. 截取桌面截图。
12. 除不可操作的静态资源 404 噪音外，浏览器控制台出现 error 时验证失败。

重要范围说明：

1. 第一版仍然不实现自定义指标源码编辑。
2. 第一版仍然不实现 Pine Script 或 TradingView 指标导入。
3. 当前计算层和定义层已经拆开，后续添加自定义指标系统时不需要重写图表集成入口。
4. 指标渲染优先使用 KLineCharts 内置指标，ATR 和 Supertrend 由 KLineForge 自定义注册补齐。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
