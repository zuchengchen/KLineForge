# Milestone 12 Verification

## English

Milestone 12 is complete.

Implemented and polished:

1. Completed bilingual `README.md`.
2. Completed bilingual `docs/development.md`.
3. Completed bilingual `docs/cache.md`.
4. Completed bilingual `docs/architecture.md`.
5. Added final browser verification script `scripts/verify-milestone-12.mjs`.
6. Added fuller top market information bar fields.
7. Added full basic chart settings controls: theme, language, price color, chart style, grid, latest price line, crosshair and sidebar expanded state.
8. Added in-app single-chart fullscreen behavior and active-chart `F` / `Esc` handling.
9. Added per-chart PNG buttons inside chart panes.
10. Fixed settings panel stacking so chart canvases cannot intercept settings clicks.
11. Kept MVP scope unchanged: no trading, no API keys, no accounts, no backend service and no tick storage.

Verification commands run on 2026-06-09:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/
docker build -t klineforge-final .
docker run --rm -d --name klineforge-final -p 18080:80 klineforge-final
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1:18080/assets/index-CQXNAbmT.js
curl -I http://127.0.0.1:18080/assets/index-irRNTLdc.css
curl -I http://127.0.0.1:18080/cache
docker stop klineforge-final
```

Results:

1. `npm run typecheck`: passed.
2. `npm run lint`: passed.
3. `npm run test`: passed, 21 test files and 66 tests.
4. `npm run build`: passed.
5. `node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/`: passed.
6. `docker build -t klineforge-final .`: passed.
7. `docker run --rm -d --name klineforge-final -p 18080:80 klineforge-final`: passed.
8. `curl -I http://127.0.0.1:18080/`: passed, Nginx returned `200 OK`.
9. `curl -I http://127.0.0.1:18080/assets/index-CQXNAbmT.js`: passed, static JS returned `200 OK`.
10. `curl -I http://127.0.0.1:18080/assets/index-irRNTLdc.css`: passed, static CSS returned `200 OK`.
11. `curl -I http://127.0.0.1:18080/cache`: passed, SPA fallback returned `200 OK`.
12. `docker stop klineforge-final`: passed.

Docker/Nginx verification:

```text
Image built successfully as klineforge-final:latest.
Temporary container served the production build through nginx/1.29.8 on http://127.0.0.1:18080/.
Index HTML, JS asset, CSS asset and SPA fallback path returned 200 OK.
Temporary container was stopped after verification.
```

Browser artifacts:

1. `artifacts/milestone-12/default-launch-dark.png`
2. `artifacts/milestone-12/dual-chart.png`
3. `artifacts/milestone-12/light-theme.png`
4. `artifacts/milestone-12/settings.png`
5. `artifacts/milestone-12/cache-management.png`

Browser verification coverage:

1. Resets `localStorage` and IndexedDB from `public/reset.html`.
2. Opens the default launch state.
3. Verifies default `BTCUSDT`, left `5m`, right `1h` and USD-M market display.
4. Verifies both charts reach ready state.
5. Performs canvas pixel checks to ensure charts are non-blank.
6. Captures desktop dark theme/default screenshots.
7. Opens settings and toggles chart style, grid, latest price line, crosshair and light theme.
8. Captures settings and light theme screenshots.
9. Verifies active chart fullscreen enters with `F` and exits with `Esc`.
10. Opens cache management and verifies cache tasks render.
11. Checks desktop horizontal overflow to catch obvious visible text/layout overlap.
12. Fails on browser console errors except known non-actionable Binance REST CORS/resource errors in this environment.

Known non-blocking notes:

1. Superseded by post-MVP hardening: production build now splits React, KLineCharts and storage dependencies into separate chunks and no longer reports the default Vite chunk-size warning.
2. Binance USD-M REST ticker calls can emit browser CORS errors in this environment; the app falls back and the limitation is documented.
3. Some Binance Public Data archive intervals are unavailable and can remain failed in cache tasks.
4. Docker legacy builder printed a deprecation notice; the image still built successfully.

## 中文

Milestone 12 已完成。

已实现和打磨：

1. 完成双语 `README.md`。
2. 完成双语 `docs/development.md`。
3. 完成双语 `docs/cache.md`。
4. 完成双语 `docs/architecture.md`。
5. 新增最终浏览器验收脚本 `scripts/verify-milestone-12.mjs`。
6. 补全顶部市场信息栏字段。
7. 补全基础图表设置控件：主题、语言、涨跌色、图表样式、网格线、最新价线、十字光标和侧栏展开状态。
8. 增加应用内单图全屏，以及活跃图表 `F` / `Esc` 处理。
9. 在图表面板内增加单图 PNG 按钮。
10. 修复设置面板层级，避免图表 canvas 拦截设置点击。
11. 保持 MVP 范围不变：不做交易、不做 API Key、不做账号、不做后端服务、不存 Tick。

2026-06-09 执行的验证命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/
docker build -t klineforge-final .
docker run --rm -d --name klineforge-final -p 18080:80 klineforge-final
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1:18080/assets/index-CQXNAbmT.js
curl -I http://127.0.0.1:18080/assets/index-irRNTLdc.css
curl -I http://127.0.0.1:18080/cache
docker stop klineforge-final
```

结果：

1. `npm run typecheck`：通过。
2. `npm run lint`：通过。
3. `npm run test`：通过，21 个测试文件，66 个测试。
4. `npm run build`：通过。
5. `node scripts/verify-milestone-12.mjs http://127.0.0.1:5173/`：通过。
6. `docker build -t klineforge-final .`：通过。
7. `docker run --rm -d --name klineforge-final -p 18080:80 klineforge-final`：通过。
8. `curl -I http://127.0.0.1:18080/`：通过，Nginx 返回 `200 OK`。
9. `curl -I http://127.0.0.1:18080/assets/index-CQXNAbmT.js`：通过，静态 JS 返回 `200 OK`。
10. `curl -I http://127.0.0.1:18080/assets/index-irRNTLdc.css`：通过，静态 CSS 返回 `200 OK`。
11. `curl -I http://127.0.0.1:18080/cache`：通过，SPA fallback 返回 `200 OK`。
12. `docker stop klineforge-final`：通过。

Docker/Nginx 验证：

```text
镜像已成功构建为 klineforge-final:latest。
临时容器通过 nginx/1.29.8 在 http://127.0.0.1:18080/ 服务生产构建。
Index HTML、JS 资源、CSS 资源和 SPA fallback 路径均返回 200 OK。
验证完成后已停止临时容器。
```

浏览器产物：

1. `artifacts/milestone-12/default-launch-dark.png`
2. `artifacts/milestone-12/dual-chart.png`
3. `artifacts/milestone-12/light-theme.png`
4. `artifacts/milestone-12/settings.png`
5. `artifacts/milestone-12/cache-management.png`

浏览器验证覆盖：

1. 通过 `public/reset.html` 重置 `localStorage` 和 IndexedDB。
2. 打开默认启动状态。
3. 验证默认 `BTCUSDT`、左图 `5m`、右图 `1h` 和 U 本位市场显示。
4. 验证两个图表进入 ready 状态。
5. 通过 canvas 像素检查确认图表非空。
6. 截取桌面深色主题和默认状态截图。
7. 打开设置并切换图表样式、网格线、最新价线、十字光标和浅色主题。
8. 截取设置和浅色主题截图。
9. 验证活跃图表可用 `F` 进入全屏，并用 `Esc` 退出。
10. 打开缓存管理并验证缓存任务渲染。
11. 检查桌面横向溢出，覆盖明显文字/布局重叠风险。
12. 除当前环境中已知的 Binance REST CORS/resource 外部错误外，浏览器 console error 会导致验收失败。

已知非阻断说明：

1. Superseded by post-MVP hardening: Vite no longer reports the default chunk-size warning after manual vendor chunking.
2. 当前环境下 Binance USD-M REST/WebSocket 访问可能产生 CORS、451 或资源错误；浏览器验收脚本会过滤这些已知外部网络限制，应用会通过 provider chain 和明确标记的 fallback 继续工作。
3. 部分 Binance Public Data 归档周期不可用，缓存任务中可能保持失败。
4. Docker legacy builder 输出了弃用提示；镜像仍成功构建。
