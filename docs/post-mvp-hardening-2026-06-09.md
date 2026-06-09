# Post-MVP Hardening Summary - 2026-06-09

## English

This note summarizes the post-MVP reliability and production-readiness pass.

1. Market data reads now use a provider chain: direct Binance REST, optional configured proxy and Public Data where appropriate before UI static fallbacks.
2. USD-M symbol search, leaderboards, watchlist ticker rows and market information no longer short-circuit to static browser fallback before attempting real data.
3. Chart history loading checks for stale cache/Public Data rows and attempts REST/proxy backfill from the last candle close boundary to now.
4. Cache coverage ranges use accurate candle close boundaries. Cache tasks expose target ranges, cached ranges, missing ranges and `partial` status instead of calling recent archive imports complete.
5. Config import validates schema versions and record shapes before mutating IndexedDB, preserving existing data after failed imports.
6. `KLineChartHost.tsx` was split into focused modules for lifecycle/resize, data feed/WebSocket, styles, crosshair sync, indicator application, drawing helpers and debug handles.
7. Production build now lazy-loads non-initial panels and uses manual chunks for React, KLineCharts and storage/ZIP dependencies.
8. Nginx static deployment now sends basic security headers, avoids caching `index.html` and gives hashed assets immutable long-lived cache headers.

Verified build result after code splitting:

```text
dist/assets/index-ByN1fUtd.js        69.44 kB │ gzip: 21.67 kB
dist/assets/storage-BG0xxh60.js     100.68 kB │ gzip: 34.02 kB
dist/assets/charting-CVNZmSBW.js    219.26 kB │ gzip: 56.67 kB
dist/assets/react-BK0NX1fN.js       238.10 kB │ gzip: 75.17 kB
```

## 中文

本文记录 post-MVP 可靠性和生产化改进。

1. 行情读取现在使用 provider chain：直接 Binance REST、可选代理，以及适用时的 Public Data，最后才使用 UI 静态兜底。
2. USD-M 交易对搜索、榜单、自选 ticker 行和市场信息不再在浏览器中先跳到静态兜底，而是先尝试真实数据。
3. 图表历史加载会检查缓存/Public Data 是否过期，并从最后一根蜡烛收盘边界到当前时间尝试 REST/代理回补。
4. 缓存覆盖范围使用准确的蜡烛收盘边界。缓存任务展示目标范围、已缓存范围、缺失范围和 `partial` 状态，不再把最近归档导入直接叫完成。
5. 配置导入在修改 IndexedDB 前校验 schemaVersion 和记录形状，失败导入会保留现有数据。
6. `KLineChartHost.tsx` 已拆分为生命周期/resize、数据 feed/WebSocket、样式、十字光标同步、指标应用、画线 helper 和调试句柄等聚焦模块。
7. 生产构建懒加载非初始面板，并把 React、KLineCharts、存储/ZIP 依赖拆成手动 chunk。
8. Nginx 静态部署新增基础安全响应头，对 `index.html` 禁用缓存，并对带 hash 的资源使用长期 immutable 缓存。
