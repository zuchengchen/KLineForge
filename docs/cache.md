# K-Line Cache

## English

This document keeps the original MVP cache design for reference. On the active `v0.1.0-tauri` branch, local K-line storage is implemented in SQLite through the Rust backend. The current Tauri UI exposes cache summary, clear-current-symbol and per cached market/symbol/interval clear actions; the full range-completeness/task queue UI remains future work.

KLineForge stores local multi-interval K-line history in IndexedDB. The MVP does not store Tick, raw trade or aggTrade data.

### Goals

1. Show the active left and right charts as quickly as possible.
2. Persist K-line history locally for repeat viewing and CSV export.
3. Cache all supported intervals for the opened market/symbol in the background.
4. Keep background work lower priority than active chart interaction.
5. Let the user manage storage manually instead of deleting data automatically.

### Supported Intervals

The cache supports:

```text
1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
```

`1s` is not supported in the MVP.

### Stored K-Line Fields

Each K-line keeps:

1. `market`
2. `symbol`
3. `interval`
4. `openTime`
5. `open`
6. `high`
7. `low`
8. `close`
9. `volume`
10. `closeTime`
11. `quoteVolume`
12. `tradeCount`
13. `takerBuyBaseVolume`
14. `takerBuyQuoteVolume`
15. `isClosed`
16. `source`
17. `updatedAt`

The primary key is market + symbol + interval + open time, so duplicate candles are upserted instead of duplicated.

### IndexedDB Stores

K-line cache uses:

1. `klines`: candle rows.
2. `klineRanges`: cached coverage ranges.
3. `cacheTasks`: interval-level cache job state.

Manual cache deletion only targets K-line cache stores. It must not delete settings, watchlists, drawings or indicator configurations.

### Cache Task Behavior

When a symbol is opened:

1. The active left and right chart intervals load first.
2. Cache tasks are created for all supported intervals for the same market/symbol.
3. Current chart intervals get higher priority.
4. Remaining intervals are filled in the background.
5. Tasks track status, progress, retries, target range, estimated size, cached start/end times and missing-range count.
6. Tasks can be paused, resumed, retried or deleted from the cache management page.

Task statuses:

1. `not-started`
2. `caching`
3. `complete`
4. `partial`
5. `failed`
6. `paused`

`complete` means the declared target range is fully covered. `partial` means some candles were imported but the declared range still has missing spans. A task must not be labeled complete only because a recent archive import succeeded.

### Range Tracking

`klineRanges` records merged coverage for each market/symbol/interval. A range starts at the first candle `openTime` and ends at the last candle close boundary. For fixed intervals this is `openTime + intervalMs - 1`; if the row has a valid `closeTime`, that close time is used directly. This avoids overstating or understating coverage by treating the last candle open time as the range end.

Range helpers detect:

1. Adjacent or overlapping ranges that can be merged.
2. Missing ranges around known coverage holes.
3. Completeness ratio for a requested range.

This allows CSV export and cache management to report whether a selected or declared range is complete.

### Data Sources

The cache and chart loader can use:

1. Local IndexedDB cache.
2. Binance REST where browser access allows it.
3. An optional configured proxy endpoint using the same Binance-compatible paths.
4. Binance Public Data monthly ZIP archives where supported.
5. Static fallback ticker rows or generated chart fallback candles only after real market data reads fail.
6. WebSocket updates for live active candles.

Binance Public Data is useful when REST access is blocked, but not every interval exists in the archive catalog. Unsupported archive intervals such as some calendar-style intervals may be marked failed in cache tasks. This is a data-source limitation, not a local schema limitation.

Monthly Public Data archives are complete only through past months. Chart initial loading therefore checks the last available candle after reading cache or Public Data and tries to fill the recent gap through REST or the configured proxy. WebSocket updates remain the live continuation, not the only repair path for stale historical archives. If cache, REST/proxy and Public Data all fail, the chart can render generated fallback candles labeled as fallback data so the user can diagnose that real history is unavailable.

### Large Writes

Large K-line imports are written in chunks so IndexedDB work does not starve the UI event loop. After each chunk, the cache writer yields back to the browser before continuing.

### Storage Quota

If browser storage quota is insufficient, the desired behavior is:

1. Do not auto-delete existing data.
2. Pause background cache work.
3. Preserve already cached data.
4. Surface a storage warning in the UI.
5. Let the user manually delete interval, symbol or all K-line cache from the cache management page.

### Cache Management Page

The cache page displays:

1. Market.
2. Symbol.
3. Interval.
4. Status.
5. Progress.
6. Target start/end range.
7. Cached start/end range.
8. Missing-range count.
9. Estimated size.
10. Actions.

Actions:

1. Pause.
2. Resume.
3. Retry.
4. Delete one interval task and its K-line rows.
5. Clear all K-line cache.

### CSV Export

CSV export reads from local cache first. It exports the selected market/symbol/interval/time range and includes market, symbol and interval in each row. If the cache range is incomplete, the app reports that the CSV was exported with incomplete coverage.

### Future Tick Storage

Tick download/storage is intentionally outside the MVP. If added later, it should use separate stores, separate quota warnings and a separate background download option so K-line caching remains predictable.

## 中文

本文保留原 MVP 缓存设计作为参考。在当前 `v0.1.0-tauri` 分支中，本地 K 线存储由 Rust 后端通过 SQLite 实现。当前 Tauri UI 已提供缓存汇总、清理当前交易对和按已缓存 market/symbol/interval 清理的操作；完整范围完整度和任务队列 UI 仍属于后续工作。

KLineForge 使用 IndexedDB 保存本地多周期 K 线历史。MVP 不保存 Tick、raw trade 或 aggTrade 数据。

### 目标

1. 尽快显示当前左右图。
2. 本地持久保存 K 线历史，便于重复查看和 CSV 导出。
3. 打开交易对后，在后台缓存该 market/symbol 的所有支持周期。
4. 后台任务优先级低于当前图表交互。
5. 存储空间不足时不自动删除数据，而是让用户手动管理。

### 支持周期

缓存支持：

```text
1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
```

MVP 不支持 `1s`。

### 保存字段

每根 K 线保存 market、symbol、interval、openTime、open、high、low、close、volume、closeTime、quoteVolume、tradeCount、takerBuyBaseVolume、takerBuyQuoteVolume、isClosed、source 和 updatedAt。

主键为 market + symbol + interval + openTime，因此重复蜡烛会被 upsert，不会重复插入。

### IndexedDB Store

K 线缓存使用：

1. `klines`：蜡烛行。
2. `klineRanges`：缓存覆盖范围。
3. `cacheTasks`：周期级缓存任务状态。

手动删除缓存只影响 K 线缓存相关 store，不能删除设置、自选、画线或指标配置。

### 缓存任务行为

打开交易对后：

1. 优先加载当前左右图周期。
2. 为同一 market/symbol 的所有支持周期创建缓存任务。
3. 当前图表周期优先级更高。
4. 其他周期在后台填充。
5. 任务记录状态、进度、重试次数、目标范围、预估大小、已缓存起止时间和缺失范围数量。
6. 用户可以在缓存管理页暂停、恢复、重试或删除任务。

任务状态包括 `not-started`、`caching`、`complete`、`partial`、`failed` 和 `paused`。

`complete` 表示声明的目标范围已经完整覆盖。`partial` 表示已经导入部分 K 线，但目标范围仍有缺失。缓存任务不能只因为最近月度归档导入成功就标记为完成。

### 范围跟踪

`klineRanges` 记录每个 market/symbol/interval 的合并覆盖范围。范围从第一根蜡烛的 `openTime` 开始，到最后一根蜡烛的收盘边界结束。固定周期使用 `openTime + intervalMs - 1`，如果行数据有有效 `closeTime` 则直接使用该收盘时间。这样不会把最后一根蜡烛的开盘时间误当成覆盖结束。

范围工具会检测可合并的相邻/重叠范围、覆盖缺口和指定范围的完整度。这让 CSV 导出和缓存管理页能够提示所选或声明范围是否完整。

### 数据源

缓存和图表加载器可以使用本地 IndexedDB、Binance REST、可选的 Binance 兼容代理、Binance Public Data 月度 ZIP 归档、真实数据失败后的静态 ticker 兜底行或生成的图表兜底蜡烛，以及 WebSocket 实时更新。Binance Public Data 在 REST 受限时很有用，但不是所有周期都有归档；不支持的归档周期可能在缓存任务中显示失败，这是数据源限制，不是本地 schema 限制。

月度 Public Data 归档只完整覆盖过去月份。图表初始加载在读取缓存或 Public Data 后会检查最后一根可用蜡烛，并通过 REST 或配置的代理补齐到当前时间附近的缺口。WebSocket 只负责实时延续，不再作为修复历史新近缺口的唯一方式。如果缓存、REST/代理和 Public Data 全部失败，图表可以渲染标记为兜底数据的生成蜡烛，方便用户诊断真实历史不可用。

### 大批量写入

大批量 K 线导入会分块写入 IndexedDB。每个分块后会把执行权交还给浏览器，避免缓存写入长期占用事件循环。

### 存储配额

浏览器存储空间不足时，期望行为是：

1. 不自动删除已有数据。
2. 暂停后台缓存。
3. 保留已缓存数据。
4. 在 UI 中提示存储问题。
5. 允许用户在缓存管理页手动删除单周期、单交易对或全部 K 线缓存。

### 缓存管理页

缓存管理页展示市场、交易对、周期、状态、进度、目标范围、已缓存起止范围、缺失范围数量、预估大小和操作。支持暂停、恢复、重试、删除单周期任务及其 K 线、清空全部 K 线缓存。

### CSV 导出

CSV 导出优先读取本地缓存，导出指定 market/symbol/interval/time range，并在每行包含 market、symbol 和 interval。如果所选范围缓存不完整，应用会提示导出结果覆盖不完整。

### 未来 Tick 存储

Tick 下载和存储不属于 MVP。如果未来增加，应使用独立 store、独立配额提示和独立后台下载选项，避免影响 K 线缓存的可预测性。
