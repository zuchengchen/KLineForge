# Milestone 8 Verification

## English

Milestone 8 is complete for the first cache-queue slice.

Implemented:

1. Persistent cache task records in IndexedDB.
2. Background cache queue runner.
3. Task creation for all supported intervals when a symbol is opened.
4. Priority for the current left and right chart intervals.
5. Concurrency limit of 2 active cache jobs.
6. Pause, resume and retry task actions.
7. Manual interval delete and clear-all K-line cache actions.
8. Cache management page.
9. Task status, progress, cached range, estimated size and last status display.
10. Manual cache clearing preserves settings.
11. Unsupported Binance Public Data archive intervals are failed without repeatedly requesting missing ZIP files.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-8.mjs http://127.0.0.1:5173/
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 15 test files and 45 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`: passed as chart regression coverage.
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`: passed as realtime regression coverage.
7. `node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/`: passed as watchlist/search regression coverage.
8. `node scripts/verify-milestone-8.mjs http://127.0.0.1:5173/`: passed.

Browser artifact:

1. `artifacts/milestone-8/cache-management.png`

Browser verification coverage:

1. Opens the default BTCUSDT USD-M screen.
2. Opens cache management from the left sidebar.
3. Verifies cache task rows are created.
4. Verifies cache progress appears.
5. Pauses and resumes a cache task.
6. Switches theme to light, then clears all K-line cache.
7. Verifies cache clearing does not delete chart settings.
8. Captures a desktop screenshot.
9. Fails on browser console errors.

Important scope note:

1. This milestone implements the queue, management page, actions, progress and bounded execution required for the cache system.
2. Current browser-accessible downloading uses Binance Public Data recent monthly K-line archives.
3. Full "from listing date to current time" historical backfill remains constrained by public browser-accessible data availability and will need either archive iteration expansion or the future backend proxy abstraction.
4. No backend service or dev proxy was introduced.

Known non-blocking warning:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.

## 中文

Milestone 8 的第一版缓存队列切片已完成。

已实现：

1. IndexedDB 中持久化缓存任务记录。
2. 后台缓存队列 runner。
3. 打开交易对时为所有支持周期创建缓存任务。
4. 当前左右图周期优先。
5. 缓存任务并发限制为 2。
6. 支持暂停、恢复和重试任务。
7. 支持删除单周期缓存和清空全部 K 线缓存。
8. 缓存管理页面。
9. 显示任务状态、进度、缓存范围、预估大小和操作。
10. 手动清空 K 线缓存不会删除设置。
11. 对 Binance Public Data 中不存在归档的周期直接标记失败，避免重复请求不存在的 ZIP。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/
node scripts/verify-milestone-8.mjs http://127.0.0.1:5173/
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，15 个测试文件，45 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-5.mjs http://127.0.0.1:5173/`：通过，作为图表回归验证。
6. `node scripts/verify-milestone-6.mjs http://127.0.0.1:5173/`：通过，作为实时更新回归验证。
7. `node scripts/verify-milestone-7.mjs http://127.0.0.1:5173/`：通过，作为自选和搜索回归验证。
8. `node scripts/verify-milestone-8.mjs http://127.0.0.1:5173/`：通过。

浏览器截图：

1. `artifacts/milestone-8/cache-management.png`

浏览器验证覆盖：

1. 打开默认 BTCUSDT USD-M 页面。
2. 从左侧栏打开缓存管理。
3. 验证缓存任务行已创建。
4. 验证缓存进度可见。
5. 暂停并恢复一个缓存任务。
6. 切换浅色主题，然后清空全部 K 线缓存。
7. 验证清空缓存不会删除图表设置。
8. 截取桌面截图。
9. 浏览器控制台出现 error 时验证失败。

重要范围说明：

1. 本里程碑实现了缓存系统所需的队列、管理页、操作、进度和有限并发执行。
2. 当前浏览器可访问的下载路径使用 Binance Public Data 最近完整月份的 K 线归档。
3. “从上市以来到当前时间”的全量历史回填仍受浏览器可访问公开数据限制，后续需要扩展归档迭代或接入预留的后端代理抽象。
4. 没有引入后端服务或开发代理。

已知非阻断警告：

1. 已由 post-MVP 改进替代：生产构建会把 React、KLineCharts 和存储依赖拆成独立 chunk，不再报告默认 Vite chunk-size warning。
