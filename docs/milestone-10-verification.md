# Milestone 10 Verification

## English

Milestone 10 is complete.

Implemented:

1. Vertical drawing toolbar inside each chart.
2. Core drawing tools: trend line, horizontal line, vertical line, rectangle, text and measurement.
3. Drawing selection state and style editing controls.
4. Style fields: line color, line width and line style.
5. Lock, hide/show and delete actions.
6. Drawing-only undo and redo.
7. IndexedDB persistence for drawings.
8. Drawing anchors are stored as `{ timestamp, price }`, not screen coordinates.
9. Drawings remain independent by market, symbol, chart id and interval.
10. KLineCharts overlay integration for visual rendering and chart-native selection/move behavior.
11. Queued drawing writes so fast UI edits cannot overwrite newer drawing state with stale IndexedDB writes.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-10.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 19 test files and 63 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-10.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-10/drawing-tools.png`

Browser verification coverage:

1. Opens the default BTCUSDT USD-M dual-chart screen.
2. Creates each drawing type on the left chart.
3. Verifies drawing-only undo and redo.
4. Edits the selected drawing style.
5. Locks and hides the selected drawing.
6. Verifies style, lock and hidden state are persisted in IndexedDB.
7. Verifies all drawing anchors use timestamp and price fields and do not store `x` or `y` screen coordinates.
8. Reloads the application.
9. Verifies left chart drawings restore after reload.
10. Verifies right chart drawings remain independent.
11. Captures a desktop screenshot.
12. Fails on browser console errors other than non-actionable static resource 404 noise.

Important scope note:

1. The MVP still does not include a full drawing object manager.
2. Drawings are independent per chart and interval in this version, matching the frozen MVP scope.
3. KLineCharts owns the canvas overlay rendering and native hit testing/movement behavior where available.
4. Browser verification validates persistence and anchor correctness; deeper visual drag editing can be expanded later as a regression suite grows.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 10 已完成。

已实现：

1. 每张图表内的左侧竖向画图工具栏。
2. 核心画图工具：趋势线、水平线、垂直线、矩形、文字、测量。
3. 画线选择状态和样式编辑控件。
4. 样式字段：线条颜色、线宽、线型。
5. 锁定、隐藏/显示和删除操作。
6. 仅作用于画图操作的撤销和重做。
7. IndexedDB 画线持久化。
8. 画线锚点以 `{ timestamp, price }` 保存，不保存屏幕坐标。
9. 画线按市场、交易对、图表 id、周期保持独立。
10. 接入 KLineCharts overlay，用于可视化渲染和图表原生选择/移动行为。
11. 绘图写入使用队列，避免快速编辑时旧 IndexedDB 写入覆盖新状态。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-10.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，19 个测试文件，63 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-10.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-10/drawing-tools.png`

浏览器验证覆盖：

1. 打开默认 BTCUSDT USD-M 左右双图页面。
2. 在左图创建每一种画线类型。
3. 验证仅画线操作的撤销和重做。
4. 编辑选中画线的样式。
5. 锁定并隐藏选中画线。
6. 验证样式、锁定和隐藏状态已写入 IndexedDB。
7. 验证所有画线锚点使用 timestamp 和 price 字段，不保存 `x` 或 `y` 屏幕坐标。
8. 重新加载应用。
9. 验证左图画线在重载后恢复。
10. 验证右图画线保持独立。
11. 截取桌面截图。
12. 除不可操作的静态资源 404 噪音外，浏览器控制台出现 error 时验证失败。

重要范围说明：

1. MVP 仍不包含完整画线对象管理器。
2. 当前版本画线按图表和周期独立保存，符合已冻结的 MVP 范围。
3. KLineCharts 负责 canvas overlay 渲染以及可用的原生命中测试/移动行为。
4. 浏览器验证重点覆盖持久化和锚点正确性；更深入的视觉拖拽编辑可在后续回归套件中扩展。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
