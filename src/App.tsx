import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { ChartPane, type ChartPaneMetrics } from './components/ChartPane';
import {
  addWatchlistSymbol,
  clearCache,
  deleteDrawing,
  exportConfig,
  exportKlinesCsv,
  getCacheSummary,
  getChartData,
  getDrawings,
  getHealth,
  getIndicators,
  getLeaderboards,
  getMarketInfo,
  getSettings,
  getSymbols,
  getWatchlist,
  importConfig,
  listenLiveKlineUpdates,
  removeWatchlistSymbol,
  reorderWatchlist,
  runPerformanceBenchmark,
  saveSettings,
  saveDrawing,
  startLiveStream,
  stopLiveStream,
} from './services/backend';
import { createTranslator } from './services/i18n';
import type {
  AppSettings,
  BenchmarkSummary,
  CacheSummary,
  ChartDataResponse,
  ChartId,
  ChartPoint,
  DrawingObject,
  IndicatorSettings,
  KlineRequest,
} from './services/types';
import type { LogicalRange } from 'lightweight-charts';

const intervals = ['1m', '3m', '5m', '15m', '1h', '2h', '4h', '1d', '1W', '1M'];
const backgroundPrefetchIntervals = ['1h', '2h', '4h', '1d', '1W', '1M'];
const maxBackgroundPrefetchRows = 1_500;
const emptyKlineRetryMs = 5_000;

const migrationItems = [
  ['行情 REST', 'complete'],
  ['SQLite K 线缓存', 'complete'],
  ['双图布局', 'complete'],
  ['Lightweight Charts 渲染', 'complete'],
  ['指标计算路径', 'complete'],
  ['WebSocket 实时流', 'complete'],
  ['时间联动', 'complete'],
  ['交易对搜索', 'complete'],
  ['市场信息', 'complete'],
  ['画线持久化', 'complete'],
  ['导入导出', 'complete'],
  ['缓存管理 UI', 'complete'],
  ['中英文 UI', 'complete'],
] as const;
const defaultIndicatorSettings: IndicatorSettings = {
  volume: true,
  ma: true,
  ema: true,
  boll: true,
  macd: true,
  rsi: true,
  atr: true,
  kdj: true,
  supertrend: true,
};
const drawingTypes = [
  'horizontal-line',
  'trend-line',
  'vertical-line',
  'rectangle',
  'text',
  'measurement',
] as const;
type DrawingType = (typeof drawingTypes)[number];

type LiveStatus = Partial<Record<ChartId, { source: string; isClosed: boolean; time: number }>>;
type CrosshairSync = { source: ChartId; time: number; price: number } | null;
type RangeSync = { source: ChartId; range: LogicalRange } | null;
type ChartActions = Partial<Record<ChartId, { exportPng: () => string }>>;
type ChartMetrics = Partial<Record<ChartId, ChartPaneMetrics>>;

export function App() {
  const initialRows = readInitialPerfRows();
  const [settings, { refetch: refetchSettings }] = createResource(getSettings);
  const [health] = createResource(getHealth);
  const [activeSymbol, setActiveSymbol] = createSignal('BTCUSDT');
  const [market, setMarket] = createSignal<'spot' | 'usdM'>('usdM');
  const [leftInterval, setLeftInterval] = createSignal('5m');
  const [rightInterval, setRightInterval] = createSignal('1h');
  const [theme, setTheme] = createSignal('dark');
  const [language, setLanguage] = createSignal('zh');
  const [benchmark, setBenchmark] = createSignal<BenchmarkSummary | null>(null);
  const [benchmarkBusy, setBenchmarkBusy] = createSignal(false);
  const [leftPoints, setLeftPoints] = createSignal<ChartPoint[]>([]);
  const [rightPoints, setRightPoints] = createSignal<ChartPoint[]>([]);
  const [chartLimit, setChartLimit] = createSignal(initialRows);
  const [chartMetrics, setChartMetrics] = createSignal<ChartMetrics>({});
  const [liveStatus, setLiveStatus] = createSignal<LiveStatus>({});
  const [operationStatus, setOperationStatus] = createSignal('Ready');
  const [symbolFilter, setSymbolFilter] = createSignal('');
  const [crosshairSync, setCrosshairSync] = createSignal<CrosshairSync>(null);
  const [rangeSync, setRangeSync] = createSignal<RangeSync>(null);
  const [chartActions, setChartActions] = createSignal<ChartActions>({});
  const [indicatorSettings, setIndicatorSettings] = createSignal<IndicatorSettings>(defaultIndicatorSettings);
  const [drawingType, setDrawingType] = createSignal<DrawingType>('horizontal-line');
  const t = createMemo(() => createTranslator(language()));

  createEffect(() => {
    const loaded = settings();

    if (!loaded) {
      return;
    }

    if (chartLimit() >= 100_000) {
      setMarket('usdM');
      setActiveSymbol('BTCUSDT');
      setLeftInterval('1m');
      setRightInterval('1m');
    } else {
      setMarket(loaded.market);
      setActiveSymbol(loaded.symbol);
      setLeftInterval(loaded.leftInterval);
      setRightInterval(loaded.rightInterval);
    }

    setTheme(loaded.theme);
    setLanguage(loaded.language);
    setIndicatorSettings(normalizeIndicatorSettings(loaded.indicators));
  });

  const persistSettings = async (patch: Partial<AppSettings>) => {
    const next = {
      market: market(),
      symbol: activeSymbol(),
      leftInterval: leftInterval(),
      rightInterval: rightInterval(),
      theme: theme(),
      language: language(),
      indicators: indicatorSettings(),
      ...patch,
    };

    await saveSettings(next);
    await refetchSettings();
  };

  const watchlist = createMemo(() => market());
  const [symbols, { refetch: refetchWatchlist }] = createResource(watchlist, getWatchlist);
  const [symbolDirectory] = createResource(watchlist, getSymbols);
  const [leaderboards] = createResource(watchlist, getLeaderboards);
  const marketInfoRequest = createMemo(() => ({ market: market(), symbol: activeSymbol() }));
  const [marketInfo] = createResource(marketInfoRequest, (request) => getMarketInfo(request.market, request.symbol));
  const leftRequest = createMemo<KlineRequest>(() => ({
    market: market(),
    symbol: activeSymbol(),
    interval: leftInterval(),
    limit: chartLimit(),
  }));
  const rightRequest = createMemo<KlineRequest>(() => ({
    market: market(),
    symbol: activeSymbol(),
    interval: rightInterval(),
    limit: chartLimit(),
  }));
  const leftIndicatorRequest = createMemo<KlineRequest>(() => ({
    ...leftRequest(),
    limit: chartLimit() > 200_000 ? 0 : chartLimit(),
  }));
  const rightIndicatorRequest = createMemo<KlineRequest>(() => ({
    ...rightRequest(),
    limit: chartLimit() > 200_000 ? 0 : chartLimit(),
  }));
  const [leftData, { refetch: refetchLeft }] = createResource(leftRequest, getChartData);
  const [rightData, { refetch: refetchRight }] = createResource(rightRequest, getChartData);
  const [leftIndicators, { refetch: refetchLeftIndicators }] = createResource(leftIndicatorRequest, getIndicators);
  const [rightIndicators, { refetch: refetchRightIndicators }] = createResource(rightIndicatorRequest, getIndicators);
  const [cacheSummary, { refetch: refetchCacheSummary }] = createResource(getCacheSummary);
  const leftDrawingQuery = createMemo(() => ({
    market: market(),
    symbol: activeSymbol(),
    interval: leftInterval(),
    chartId: 'left' as const,
  }));
  const rightDrawingQuery = createMemo(() => ({
    market: market(),
    symbol: activeSymbol(),
    interval: rightInterval(),
    chartId: 'right' as const,
  }));
  const [leftDrawings, { refetch: refetchLeftDrawings }] = createResource(leftDrawingQuery, getDrawings);
  const [rightDrawings, { refetch: refetchRightDrawings }] = createResource(rightDrawingQuery, getDrawings);
  const filteredSymbols = createMemo(() => {
    const query = symbolFilter().trim().toUpperCase();
    const rows = symbolDirectory() ?? [];

    if (!query) {
      return rows.slice(0, 8);
    }

    return rows
      .filter((row) => row.symbol.includes(query) || row.baseAsset.includes(query))
      .slice(0, 8);
  });

  createEffect(() => {
    setLeftPoints(leftData()?.points ?? []);
  });

  createEffect(() => {
    setRightPoints(rightData()?.points ?? []);
  });

  createEffect(() => {
    const request = leftRequest();
    const data = leftData();

    if (!shouldRetryEmptyKlineLoad({ data, loading: leftData.loading, error: leftData.error })) {
      return;
    }

    const key = requestKey(request);
    const timer = window.setInterval(() => {
      if (
        key !== requestKey(leftRequest()) ||
        !shouldRetryEmptyKlineLoad({
          data: leftData(),
          loading: leftData.loading,
          error: leftData.error,
        })
      ) {
        window.clearInterval(timer);
        return;
      }

      void refetchLeft();
    }, emptyKlineRetryMs);

    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    const request = rightRequest();
    const data = rightData();

    if (!shouldRetryEmptyKlineLoad({ data, loading: rightData.loading, error: rightData.error })) {
      return;
    }

    const key = requestKey(request);
    const timer = window.setInterval(() => {
      if (
        key !== requestKey(rightRequest()) ||
        !shouldRetryEmptyKlineLoad({
          data: rightData(),
          loading: rightData.loading,
          error: rightData.error,
        })
      ) {
        window.clearInterval(timer);
        return;
      }

      void refetchRight();
    }, emptyKlineRetryMs);

    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    publishPerformanceState({
      chartLimit: chartLimit(),
      market: market(),
      symbol: activeSymbol(),
      leftInterval: leftInterval(),
      rightInterval: rightInterval(),
      leftRows: leftPoints().length,
      rightRows: rightPoints().length,
      leftSource: leftData()?.source,
      rightSource: rightData()?.source,
      leftCached: leftData()?.cached,
      rightCached: rightData()?.cached,
      metrics: chartMetrics(),
    });
  });

  createEffect((previousKey: string | undefined) => {
    const limit = Math.min(chartLimit(), maxBackgroundPrefetchRows);
    const key = `${market()}:${activeSymbol()}:${leftInterval()}:${rightInterval()}:${limit}`;

    if (key !== previousKey) {
      const requests = createLargePeriodPrefetchRequests({
        market: market(),
        symbol: activeSymbol(),
        leftInterval: leftInterval(),
        rightInterval: rightInterval(),
        limit,
      });

      if (requests.length > 0) {
        void prefetchChartData(requests)
          .then(() => refetchCacheSummary())
          .catch((error: unknown) => {
            console.warn('large-period prefetch failed', error);
          });
      }
    }

    return key;
  }, undefined);

  createEffect((previousKey: string | undefined) => {
    const request = leftRequest();
    const key = requestKey(request);

    if (key !== previousKey) {
      void startLiveStream({ chartId: 'left', ...request });
    }

    return key;
  }, undefined);

  createEffect((previousKey: string | undefined) => {
    const request = rightRequest();
    const key = requestKey(request);

    if (key !== previousKey) {
      void startLiveStream({ chartId: 'right', ...request });
    }

    return key;
  }, undefined);

  onMount(() => {
    let unlisten: (() => void) | undefined;

    void listenLiveKlineUpdates((event) => {
      const updatePoints = event.chartId === 'left' ? setLeftPoints : setRightPoints;
      updatePoints((points) => mergeChartPoint(points, event.point, Math.max(chartLimit(), 5_000)));
      setLiveStatus((status) => ({
        ...status,
        [event.chartId]: {
          source: event.source,
          isClosed: event.isClosed,
          time: event.point.time,
        },
      }));

      if (event.isClosed) {
        void (event.chartId === 'left' ? refetchLeftIndicators() : refetchRightIndicators());
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    onCleanup(() => {
      unlisten?.();
      void stopLiveStream('left');
      void stopLiveStream('right');
    });
  });

  const updateMarket = async (value: 'spot' | 'usdM') => {
    setMarket(value);
    await persistSettings({ market: value });
    await refetchWatchlist();
    await Promise.all([refetchLeft(), refetchRight()]);
  };

  const updateSymbol = async (symbol: string) => {
    setActiveSymbol(symbol);
    await persistSettings({ symbol });
    await Promise.all([refetchLeft(), refetchRight()]);
  };

  const addActiveToWatchlist = async () => {
    await addWatchlistSymbol({ market: market(), symbol: activeSymbol() });
    setOperationStatus(`Watchlist added: ${activeSymbol()}`);
    await refetchWatchlist();
  };

  const removeActiveFromWatchlist = async () => {
    await removeWatchlistSymbol({ market: market(), symbol: activeSymbol() });
    setOperationStatus(`Watchlist removed: ${activeSymbol()}`);
    await refetchWatchlist();
  };

  const moveWatchlistSymbol = async (symbol: string, direction: -1 | 1) => {
    const current = symbols() ?? [];
    const index = current.indexOf(symbol);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= current.length) {
      return;
    }

    const next = current.slice();
    [next[index], next[target]] = [next[target], next[index]];
    await reorderWatchlist({ market: market(), symbols: next });
    setOperationStatus(`Watchlist reordered: ${symbol}`);
    await refetchWatchlist();
  };

  const runBenchmark = async () => {
    setBenchmarkBusy(true);
    setOperationStatus('Running benchmark...');
    try {
      const result = await runPerformanceBenchmark({ ...leftRequest(), limit: 1500 });
      setBenchmark(result);
      setOperationStatus(`Benchmark complete: ${result.fetchedRows} rows`);
    } finally {
      setBenchmarkBusy(false);
    }
  };

  const downloadCurrentCsv = async () => {
    setOperationStatus('Preparing CSV...');
    const result = await exportKlinesCsv({ ...leftRequest(), limit: 10_000 });
    downloadText(result.fileName, result.content, 'text/csv;charset=utf-8');
    setOperationStatus(`CSV exported: ${result.rowCount} rows`);
  };

  const downloadConfig = async () => {
    setOperationStatus('Preparing config...');
    downloadText('klineforge-config.json', await exportConfig(), 'application/json;charset=utf-8');
    setOperationStatus('Config exported');
  };

  const uploadConfig = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setOperationStatus('Importing config...');
    const result = await importConfig(await file.text());
    setOperationStatus(`Config imported: ${result.watchlistCount} symbols, ${result.drawingCount} drawings`);
    await Promise.all([refetchSettings(), refetchWatchlist(), refetchLeft(), refetchRight(), refetchCacheSummary()]);
  };

  const clearCurrentCache = async () => {
    setOperationStatus('Clearing cache...');
    const result = await clearCache({
      market: market(),
      symbol: activeSymbol(),
    });
    setOperationStatus(`Cache cleared: ${result.deletedRows} rows`);
    await Promise.all([refetchCacheSummary(), refetchLeft(), refetchRight()]);
  };

  const clearCacheRow = async (row: CacheSummary) => {
    setOperationStatus(`Clearing cache: ${row.market} ${row.symbol} ${row.interval}`);
    const result = await clearCache({
      market: row.market,
      symbol: row.symbol,
      interval: row.interval,
    });
    setOperationStatus(`Cache cleared: ${row.symbol} ${row.interval}, ${result.deletedRows} rows`);
    await Promise.all([refetchCacheSummary(), refetchLeft(), refetchRight()]);
  };

  const addDrawing = async (chartId: ChartId) => {
    const points = chartId === 'left' ? leftPoints() : rightPoints();
    const latest = points.at(-1);
    const previous = points.at(-24) ?? points.at(0);

    if (!latest) {
      setOperationStatus('No candle loaded for drawing');
      return;
    }

    const interval = chartId === 'left' ? leftInterval() : rightInterval();
    const type = drawingType();
    const payload = createDrawingPayload(type, activeSymbol(), latest, previous);
    const drawing: DrawingObject = {
      id: `${chartId}-${Date.now()}`,
      market: market(),
      symbol: activeSymbol(),
      interval,
      chartId,
      drawingType: type,
      payload,
      updatedAt: Date.now(),
    };

    await saveDrawing(drawing);
    setOperationStatus(`Drawing saved: ${chartId} ${type}`);
    await (chartId === 'left' ? refetchLeftDrawings() : refetchRightDrawings());
  };

  const downloadChartPng = (chartId: ChartId) => {
    const url = chartActions()[chartId]?.exportPng();

    if (!url) {
      setOperationStatus('Chart export is not ready');
      return;
    }

    downloadUrl(`${activeSymbol()}-${chartId}-${chartId === 'left' ? leftInterval() : rightInterval()}.png`, url);
    setOperationStatus(`PNG exported: ${chartId}`);
  };

  const removeDrawing = async (drawing: DrawingObject) => {
    await deleteDrawing(drawing.id);
    setOperationStatus(`Drawing deleted: ${drawing.chartId}`);
    await (drawing.chartId === 'left' ? refetchLeftDrawings() : refetchRightDrawings());
  };

  const updateIndicatorSetting = async (key: keyof IndicatorSettings, value: boolean) => {
    const next = {
      ...indicatorSettings(),
      [key]: value,
    };

    setIndicatorSettings(next);
    await persistSettings({ indicators: next });
  };

  const updateChartLimit = async (value: number) => {
    setChartLimit(value);

    if (value >= 100_000) {
      setMarket('usdM');
      setActiveSymbol('BTCUSDT');
      setLeftInterval('1m');
      setRightInterval('1m');
      setOperationStatus(`Large-data mode: ${value.toLocaleString()} BTCUSDT 1m rows`);
    } else {
      setOperationStatus(`Chart window: ${value.toLocaleString()} rows`);
    }
  };

  return (
    <main class={`app app--${theme()}`}>
      <aside class="sidebar">
        <div class="brand">
          <strong>{t()('appName')}</strong>
          <span>{t()('subtitle')}</span>
        </div>

        <section class="panel">
          <h2>{t()('watchlist')}</h2>
          <div class="segmented">
            <button classList={{ active: market() === 'usdM' }} onClick={() => void updateMarket('usdM')}>
              USD-M
            </button>
            <button classList={{ active: market() === 'spot' }} onClick={() => void updateMarket('spot')}>
              Spot
            </button>
          </div>
          <div class="watchlist">
            <For each={symbols() ?? []}>
              {(symbol) => (
                <div class="watchlist-row">
                  <button classList={{ active: activeSymbol() === symbol }} onClick={() => void updateSymbol(symbol)}>
                    {symbol}
                  </button>
                  <button onClick={() => void moveWatchlistSymbol(symbol, -1)}>↑</button>
                  <button onClick={() => void moveWatchlistSymbol(symbol, 1)}>↓</button>
                </div>
              )}
            </For>
          </div>
          <div class="watchlist-actions">
            <button onClick={() => void addActiveToWatchlist()}>{t()('add')}</button>
            <button onClick={() => void removeActiveFromWatchlist()}>{t()('remove')}</button>
          </div>
        </section>

        <section class="panel">
          <h2>{t()('symbolSearch')}</h2>
          <input
            value={symbolFilter()}
            placeholder="BTC, ETH, SOL"
            onInput={(event) => setSymbolFilter(event.currentTarget.value)}
          />
          <div class="symbol-results">
            <For each={filteredSymbols()}>
              {(symbol) => (
                <button onClick={() => void updateSymbol(symbol.symbol)}>
                  <strong>{symbol.symbol}</strong>
                  <span>{symbol.status}</span>
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="panel">
          <h2>{t()('settings')}</h2>
          <label>
            {t()('language')}
            <select
              value={language()}
              onChange={(event) => {
                setLanguage(event.currentTarget.value);
                void persistSettings({ language: event.currentTarget.value });
              }}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t()('theme')}
            <select
              value={theme()}
              onChange={(event) => {
                setTheme(event.currentTarget.value);
                void persistSettings({ theme: event.currentTarget.value });
              }}
            >
              <option value="dark">{t()('dark')}</option>
              <option value="light">{t()('light')}</option>
            </select>
          </label>
        </section>

        <section class="panel">
          <h2>{t()('indicators')}</h2>
          <IndicatorToggle label="Volume" checked={indicatorSettings().volume} onChange={(value) => void updateIndicatorSetting('volume', value)} />
          <IndicatorToggle label="MA" checked={indicatorSettings().ma} onChange={(value) => void updateIndicatorSetting('ma', value)} />
          <IndicatorToggle label="EMA" checked={indicatorSettings().ema} onChange={(value) => void updateIndicatorSetting('ema', value)} />
          <IndicatorToggle label="BOLL" checked={indicatorSettings().boll} onChange={(value) => void updateIndicatorSetting('boll', value)} />
          <IndicatorToggle label="MACD" checked={indicatorSettings().macd} onChange={(value) => void updateIndicatorSetting('macd', value)} />
          <IndicatorToggle label="RSI" checked={indicatorSettings().rsi} onChange={(value) => void updateIndicatorSetting('rsi', value)} />
          <IndicatorToggle label="ATR" checked={indicatorSettings().atr} onChange={(value) => void updateIndicatorSetting('atr', value)} />
          <IndicatorToggle label="KDJ" checked={indicatorSettings().kdj} onChange={(value) => void updateIndicatorSetting('kdj', value)} />
          <IndicatorToggle
            label="Supertrend"
            checked={indicatorSettings().supertrend}
            onChange={(value) => void updateIndicatorSetting('supertrend', value)}
          />
        </section>

        <section class="panel">
          <h2>{t()('backend')}</h2>
          <dl class="status-list">
            <dt>{t()('backend')}</dt>
            <dd>{health()?.backend ?? '...'}</dd>
            <dt>{t()('database')}</dt>
            <dd>{health()?.databaseReady ? t()('ready') : t()('notReady')}</dd>
          </dl>
        </section>
      </aside>

      <section class="workspace">
        <header class="toolbar">
          <div class="toolbar__group">
            <label>
              {t()('symbol')}
              <input
                value={activeSymbol()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void updateSymbol(event.currentTarget.value.toUpperCase());
                  }
                }}
              />
            </label>
            <IntervalSelect
              label={`${t()('interval')} L`}
              value={leftInterval()}
              onChange={(value) => {
                setLeftInterval(value);
                void persistSettings({ leftInterval: value });
              }}
            />
            <IntervalSelect
              label={`${t()('interval')} R`}
              value={rightInterval()}
              onChange={(value) => {
                setRightInterval(value);
                void persistSettings({ rightInterval: value });
              }}
            />
            <RowLimitSelect label={t()('rows')} value={chartLimit()} onChange={(value) => void updateChartLimit(value)} />
          </div>
          <div class="toolbar__group toolbar__group--meta">
            <MarketInfoBar info={marketInfo()} />
            <DataBadge label={t()('source')} data={leftData()} />
            <button disabled={benchmarkBusy()} onClick={() => void runBenchmark()}>
              {benchmarkBusy() ? '...' : t()('runBenchmark')}
            </button>
          </div>
        </header>

        <section class="chart-grid">
          <ChartPane
            title={`${activeSymbol()} ${leftInterval()}`}
            points={leftPoints}
            indicators={() => leftIndicators() ?? []}
            indicatorSettings={indicatorSettings}
            drawings={() => leftDrawings() ?? []}
            liveStatus={() => liveStatus().left}
            resetKey={() => chartDataResetKey(leftRequest())}
            syncCrosshair={() =>
              crosshairSync()?.source === 'right'
                ? { time: crosshairSync()?.time ?? 0, price: crosshairSync()?.price ?? 0 }
                : null
            }
            syncRange={() => (rangeSync()?.source === 'right' ? rangeSync()?.range ?? null : null)}
            onCrosshairMove={(point) =>
              setCrosshairSync(point ? { source: 'left', ...point } : crosshairSync()?.source === 'left' ? null : crosshairSync())
            }
            onVisibleRangeChange={(range) => {
              if (range) {
                setRangeSync({ source: 'left', range });
              }
            }}
            onReady={(actions) => setChartActions((current) => ({ ...current, left: actions }))}
            onPerformanceUpdate={(metrics) => setChartMetrics((current) => ({ ...current, left: metrics }))}
            theme={theme}
          />
          <ChartPane
            title={`${activeSymbol()} ${rightInterval()}`}
            points={rightPoints}
            indicators={() => rightIndicators() ?? []}
            indicatorSettings={indicatorSettings}
            drawings={() => rightDrawings() ?? []}
            liveStatus={() => liveStatus().right}
            resetKey={() => chartDataResetKey(rightRequest())}
            syncCrosshair={() =>
              crosshairSync()?.source === 'left'
                ? { time: crosshairSync()?.time ?? 0, price: crosshairSync()?.price ?? 0 }
                : null
            }
            syncRange={() => (rangeSync()?.source === 'left' ? rangeSync()?.range ?? null : null)}
            onCrosshairMove={(point) =>
              setCrosshairSync(point ? { source: 'right', ...point } : crosshairSync()?.source === 'right' ? null : crosshairSync())
            }
            onVisibleRangeChange={(range) => {
              if (range) {
                setRangeSync({ source: 'right', range });
              }
            }}
            onReady={(actions) => setChartActions((current) => ({ ...current, right: actions }))}
            onPerformanceUpdate={(metrics) => setChartMetrics((current) => ({ ...current, right: metrics }))}
            theme={theme}
          />
        </section>

        <footer class="bottom-dock">
          <section class="dock-panel">
            <h2>{t()('migration')}</h2>
            <div class="migration-grid">
              <For each={migrationItems}>
                {([label, status]) => (
                  <span class={`migration-pill migration-pill--${status}`}>
                    {label}
                    <small>
                      {status === 'complete' ? t()('complete') : status === 'degraded' ? t()('degraded') : t()('pending')}
                    </small>
                  </span>
                )}
              </For>
            </div>
          </section>
          <section class="dock-panel dock-panel--ops">
            <h2>{t()('workflows')}</h2>
            <label class="inline-select">
              {t()('drawingTool')}
              <select value={drawingType()} onChange={(event) => setDrawingType(event.currentTarget.value as DrawingType)}>
                <For each={drawingTypes}>{(type) => <option value={type}>{type}</option>}</For>
              </select>
            </label>
            <div class="action-row">
              <button data-perf-action="export-csv" onClick={() => void downloadCurrentCsv()}>
                {t()('exportCsv')}
              </button>
              <button onClick={() => void downloadConfig()}>{t()('exportConfig')}</button>
              <label class="file-action">
                {t()('importConfig')}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void uploadConfig(event.currentTarget.files?.[0])}
                />
              </label>
              <button data-perf-action="clear-cache" onClick={() => void clearCurrentCache()}>
                {t()('clearCache')}
              </button>
              <button onClick={() => void refetchCacheSummary()}>{t()('refresh')}</button>
              <button data-perf-action="draw-left" onClick={() => void addDrawing('left')}>
                {t()('drawLeft')}
              </button>
              <button onClick={() => void addDrawing('right')}>{t()('drawRight')}</button>
              <button data-perf-action="png-left" onClick={() => downloadChartPng('left')}>
                {t()('pngLeft')}
              </button>
              <button onClick={() => downloadChartPng('right')}>{t()('pngRight')}</button>
            </div>
            <p class="operation-status">{operationStatus()}</p>
            <div class="drawing-list">
              <For each={[...(leftDrawings() ?? []), ...(rightDrawings() ?? [])].slice(0, 4)}>
                {(drawing) => (
                  <button onClick={() => void removeDrawing(drawing)}>
                    {drawing.chartId} {drawing.drawingType} {drawing.payload.text ?? ''}
                  </button>
                )}
              </For>
            </div>
            <div class="cache-list">
              <For each={(cacheSummary() ?? []).slice(0, 8)} fallback={<span>{t()('emptyCache')}</span>}>
                {(row) => (
                  <button onClick={() => void clearCacheRow(row)}>
                    {row.market} {row.symbol} {row.interval}: {row.rowCount.toLocaleString()}
                  </button>
                )}
              </For>
            </div>
            <div class="leaderboards">
              <Leaderboard title={t()('gainers')} rows={leaderboards()?.gainers ?? []} onSelect={updateSymbol} />
              <Leaderboard title={t()('volume')} rows={leaderboards()?.volume ?? []} onSelect={updateSymbol} />
            </div>
          </section>
          <section class="dock-panel dock-panel--benchmark">
            <h2>{t()('benchmark')}</h2>
            <Show when={benchmark()} fallback={<p>BTCUSDT 1m real-data benchmark pending.</p>}>
              {(result) => (
                <dl class="benchmark-grid">
                  <dt>Rows</dt>
                  <dd>{result().fetchedRows}</dd>
                  <dt>Fetch</dt>
                  <dd>{result().fetchMs} ms</dd>
                  <dt>SQLite write</dt>
                  <dd>{result().sqliteWriteMs} ms</dd>
                  <dt>SQLite read</dt>
                  <dd>{result().sqliteReadMs} ms</dd>
                  <dt>Indicators</dt>
                  <dd>{result().indicatorMs} ms</dd>
                  <dt>Chart rows</dt>
                  <dd>{leftPoints().length.toLocaleString()}</dd>
                  <dt>Rendered</dt>
                  <dd>{chartMetrics().left?.renderedRows.toLocaleString() ?? '--'}</dd>
                  <dt>LOD</dt>
                  <dd>{chartMetrics().left?.lodApplied ? 'on' : 'off'}</dd>
                </dl>
              )}
            </Show>
          </section>
        </footer>
      </section>
    </main>
  );
}

function normalizeIndicatorSettings(settings: Partial<IndicatorSettings> | undefined): IndicatorSettings {
  return {
    ...defaultIndicatorSettings,
    ...settings,
  };
}

function createDrawingPayload(type: DrawingType, symbol: string, latest: ChartPoint, previous?: ChartPoint): DrawingObject['payload'] {
  const start = previous ?? latest;
  const color = type === 'measurement' ? '#38bdf8' : type === 'rectangle' ? '#22ab94' : '#f6c343';

  if (type === 'horizontal-line') {
    return {
      price: latest.close,
      text: `${symbol} ${latest.close.toFixed(2)}`,
      color,
    };
  }

  if (type === 'vertical-line') {
    return {
      startTime: latest.time,
      startPrice: latest.low,
      endTime: latest.time,
      endPrice: latest.high,
      text: `${symbol} ${new Date(latest.time * 1000).toISOString().slice(0, 16)}`,
      color,
    };
  }

  if (type === 'text') {
    return {
      startTime: latest.time,
      startPrice: latest.close,
      endTime: latest.time,
      endPrice: latest.close,
      text: `${symbol} note`,
      color: '#fb7185',
    };
  }

  const movePercent = start.close === 0 ? 0 : ((latest.close - start.close) / start.close) * 100;
  const text =
    type === 'measurement'
      ? `${movePercent >= 0 ? '+' : ''}${movePercent.toFixed(2)}%`
      : `${symbol} range`;

  return {
    startTime: start.time,
    startPrice: start.close,
    endTime: latest.time,
    endPrice: latest.close,
    text,
    color,
  };
}

function RowLimitSelect(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(event) => props.onChange(Number(event.currentTarget.value))}>
        <option value={1000}>1,000</option>
        <option value={100000}>100,000</option>
        <option value={1000000}>1,000,000</option>
      </select>
    </label>
  );
}

function IntervalSelect(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        <For each={intervals}>{(interval) => <option value={interval}>{interval}</option>}</For>
      </select>
    </label>
  );
}

function IndicatorToggle(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label class="toggle-row">
      <span>{props.label}</span>
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.currentTarget.checked)} />
    </label>
  );
}

function DataBadge(props: { label: string; data?: ChartDataResponse }) {
  return (
    <span class="data-badge">
      {props.label}: {props.data?.source ?? '...'} {props.data?.cached ? 'cache' : ''}
    </span>
  );
}

function MarketInfoBar(props: { info: Awaited<ReturnType<typeof getMarketInfo>> | undefined }) {
  return (
    <span class="market-info">
      {props.info?.ticker.symbol ?? '...'} {props.info?.ticker.lastPrice ?? '--'}{' '}
      <b class={Number(props.info?.ticker.priceChangePercent ?? 0) >= 0 ? 'up' : 'down'}>
        {props.info?.ticker.priceChangePercent ?? '0'}%
      </b>
      <Show when={props.info?.futures}>
        {(futures) => (
          <>
            {' '}Mark {futures().markPrice} Funding {futures().fundingRate}
          </>
        )}
      </Show>
    </span>
  );
}

function Leaderboard(props: {
  title: string;
  rows: { symbol: string; priceChangePercent: string; quoteVolume: string }[];
  onSelect: (symbol: string) => Promise<void>;
}) {
  return (
    <div>
      <strong>{props.title}</strong>
      <For each={props.rows.slice(0, 4)}>
        {(row) => (
          <button onClick={() => void props.onSelect(row.symbol)}>
            {row.symbol} {row.priceChangePercent}%
          </button>
        )}
      </For>
    </div>
  );
}

function requestKey(request: KlineRequest) {
  return `${request.market}:${request.symbol}:${request.interval}`;
}

export function shouldRetryEmptyKlineLoad(params: {
  data: ChartDataResponse | undefined;
  loading: boolean;
  error: unknown;
}) {
  if (params.loading) {
    return false;
  }

  return params.error !== undefined || (params.data?.points.length ?? 0) === 0;
}

export function createLargePeriodPrefetchRequests(params: {
  market: KlineRequest['market'];
  symbol: string;
  leftInterval: string;
  rightInterval: string;
  limit: number;
}): KlineRequest[] {
  const visibleIntervals = new Set([params.leftInterval, params.rightInterval]);

  return backgroundPrefetchIntervals
    .filter((interval) => !visibleIntervals.has(interval))
    .map((interval) => ({
      market: params.market,
      symbol: params.symbol,
      interval,
      limit: params.limit,
    }));
}

async function prefetchChartData(requests: KlineRequest[]) {
  for (const request of requests) {
    await getChartData(request);
  }
}

function chartDataResetKey(request: KlineRequest) {
  return `${requestKey(request)}:${request.limit ?? 'all'}:${request.startTime ?? 'open'}:${request.endTime ?? 'latest'}`;
}

function mergeChartPoint(points: ChartPoint[], point: ChartPoint, maxRows = 5_000): ChartPoint[] {
  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const current = points[mid];

    if (current.time === point.time) {
      const next = points.slice();
      next[mid] = point;
      return next;
    }

    if (current.time < point.time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const next = points.slice();
  next.splice(low, 0, point);

  return next.length > maxRows ? next.slice(next.length - maxRows) : next;
}

function downloadText(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  downloadUrl(fileName, url);
  URL.revokeObjectURL(url);
}

function downloadUrl(fileName: string, url: string) {
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
}

function readInitialPerfRows() {
  if (typeof window === 'undefined') {
    return 1_000;
  }

  const rows = Number(new URLSearchParams(window.location.search).get('perfRows'));

  if (rows >= 1_000_000) {
    return 1_000_000;
  }

  if (rows >= 100_000) {
    return 100_000;
  }

  return 1_000;
}

function publishPerformanceState(state: {
  chartLimit: number;
  market: string;
  symbol: string;
  leftInterval: string;
  rightInterval: string;
  leftRows: number;
  rightRows: number;
  leftSource?: string;
  rightSource?: string;
  leftCached?: boolean;
  rightCached?: boolean;
  metrics: ChartMetrics;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  (
    window as Window & {
      __KLINEFORGE_PERF__?: typeof state;
    }
  ).__KLINEFORGE_PERF__ = state;
}
