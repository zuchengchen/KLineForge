# Milestone 11 Verification

## English

Milestone 11 is complete.

Implemented:

1. Left chart PNG export.
2. Right chart PNG export.
3. K-line CSV export from local cache.
4. CSV incomplete-range warning message.
5. Config JSON export.
6. Config JSON import.
7. Config import schema validation with user-facing errors.
8. Config export excludes K-line cache, K-line ranges and cache tasks.
9. Export/import panel in the left sidebar.
10. Browser download verification for PNG, CSV and JSON files.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-11.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 21 test files and 66 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-11.mjs http://127.0.0.1:5173/`: passed.

Browser artifacts:

1. `artifacts/milestone-11/left-chart.png`
2. `artifacts/milestone-11/right-chart.png`
3. `artifacts/milestone-11/klines.csv`
4. `artifacts/milestone-11/config.json`
5. `artifacts/milestone-11/bad-config.json`
6. `artifacts/milestone-11/export-import.png`

Browser verification coverage:

1. Opens the default BTCUSDT USD-M dual-chart screen.
2. Exports left chart PNG and verifies the file is non-empty.
3. Exports right chart PNG and verifies the file is non-empty.
4. Exports K-line CSV and verifies the required header fields.
5. Exports config JSON and verifies the KLineForge envelope.
6. Verifies config JSON excludes `klines`, `klineRanges` and `cacheTasks`.
7. Imports the exported config JSON and verifies a success message.
8. Imports malformed config JSON and verifies a clear validation error.
9. Captures a desktop screenshot.
10. Fails on browser console errors other than non-actionable static resource 404 noise.

Important scope note:

1. CSV export currently uses the active symbol and left-chart interval with a recent range from the local cache.
2. If the selected CSV range is incomplete, the UI warns the user in the export message instead of silently claiming full coverage.
3. Config import intentionally replaces user configuration tables covered by the export payload: settings, watchlists, drawings and indicator configs.
4. Config import/export does not include market data, cached K-lines, cache coverage ranges or running cache task state.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 11 已完成。

已实现：

1. 左图 PNG 导出。
2. 右图 PNG 导出。
3. 从本地缓存导出 K 线 CSV。
4. CSV 范围不完整时显示提示。
5. 配置 JSON 导出。
6. 配置 JSON 导入。
7. 配置导入 schema 校验和面向用户的错误提示。
8. 配置导出排除 K 线缓存、K 线范围和缓存任务。
9. 左侧栏导出/导入面板。
10. 浏览器下载验证覆盖 PNG、CSV 和 JSON 文件。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-11.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，21 个测试文件，66 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-11.mjs http://127.0.0.1:5173/`：通过。

浏览器产物：

1. `artifacts/milestone-11/left-chart.png`
2. `artifacts/milestone-11/right-chart.png`
3. `artifacts/milestone-11/klines.csv`
4. `artifacts/milestone-11/config.json`
5. `artifacts/milestone-11/bad-config.json`
6. `artifacts/milestone-11/export-import.png`

浏览器验证覆盖：

1. 打开默认 BTCUSDT USD-M 左右双图页面。
2. 导出左图 PNG，并验证文件非空。
3. 导出右图 PNG，并验证文件非空。
4. 导出 K 线 CSV，并验证必需表头字段。
5. 导出配置 JSON，并验证 KLineForge 外层结构。
6. 验证配置 JSON 不包含 `klines`、`klineRanges` 和 `cacheTasks`。
7. 导入刚导出的配置 JSON，并验证成功提示。
8. 导入格式错误的配置 JSON，并验证清晰的校验错误。
9. 截取桌面截图。
10. 除不可操作的静态资源 404 噪音外，浏览器控制台出现 error 时验证失败。

重要范围说明：

1. CSV 导出当前使用活跃交易对和左图周期，并从本地缓存导出最近范围。
2. 如果 CSV 所选范围缓存不完整，UI 会在导出消息里提示用户，而不是静默宣称完整覆盖。
3. 配置导入会替换导出范围内的用户配置表：设置、自选、画线和指标配置。
4. 配置导入/导出不包含市场数据、缓存 K 线、缓存覆盖范围或正在运行的缓存任务状态。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
