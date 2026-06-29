import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { ChartPane, type ChartPaneMetrics } from './components/ChartPane';
import {
  addWatchlistSymbol,
  clearCache,
  deleteDrawing,
  deleteIndicatorInstance,
  exportConfig,
  exportKlinesCsv,
  getCacheSummary,
  getChartData,
  getDrawings,
  getHealth,
  getIndicators,
  getLeaderboards,
  getMarketInfo,
  getPreviewIndicatorDebugState,
  getSettings,
  getSymbols,
  getWatchlist,
  importConfig,
  listIndicatorInstances,
  listenLiveKlineUpdates,
  removeWatchlistSymbol,
  reorderWatchlist,
  runPerformanceBenchmark,
  saveIndicatorInstance,
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
  IndicatorInstance,
  IndicatorKind,
  IndicatorLineStyle,
  IndicatorParams,
  IndicatorStyle,
  IndicatorSettings,
  IndicatorScope,
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
type IndicatorEditorState = {
  mode: 'add' | 'edit';
  instance: IndicatorInstance;
  periodsText: string;
  error: string;
};

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
  const [indicatorConfigChart, setIndicatorConfigChart] = createSignal<ChartId>('left');
  const [indicatorEditor, setIndicatorEditor] = createSignal<IndicatorEditorState | null>(null);
  const [lastIndicatorDataRefresh, setLastIndicatorDataRefresh] = createSignal<Partial<Record<ChartId, string>>>({});
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
  const leftIndicatorRequest = createMemo(() => ({
    chartId: 'left' as const,
    request: {
      ...leftRequest(),
      limit: chartLimit() > 200_000 ? 0 : chartLimit(),
    },
    maxRows: 200_000,
  }));
  const rightIndicatorRequest = createMemo(() => ({
    chartId: 'right' as const,
    request: {
      ...rightRequest(),
      limit: chartLimit() > 200_000 ? 0 : chartLimit(),
    },
    maxRows: 200_000,
  }));
  const [leftData, { refetch: refetchLeft }] = createResource(leftRequest, getChartData);
  const [rightData, { refetch: refetchRight }] = createResource(rightRequest, getChartData);
  const [leftIndicators, { refetch: refetchLeftIndicators }] = createResource(leftIndicatorRequest, getIndicators);
  const [rightIndicators, { refetch: refetchRightIndicators }] = createResource(rightIndicatorRequest, getIndicators);
  const [cacheSummary, { refetch: refetchCacheSummary }] = createResource(getCacheSummary);
  const indicatorScope = createMemo<IndicatorScope>(() => ({
    chartId: indicatorConfigChart(),
    interval: indicatorConfigChart() === 'left' ? leftInterval() : rightInterval(),
  }));
  const [indicatorInstances, { refetch: refetchIndicatorInstances }] = createResource(
    indicatorScope,
    listIndicatorInstances,
  );
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
    const data = leftData();
    setLeftPoints(data?.points ?? []);

    if (data?.points.length) {
      const key = `${chartDataResetKey(leftRequest())}:${data.points.length}:${data.source}`;
      if (lastIndicatorDataRefresh().left !== key) {
        setLastIndicatorDataRefresh((current) => ({ ...current, left: key }));
        void refetchLeftIndicators();
      }
    }
  });

  createEffect(() => {
    const data = rightData();
    setRightPoints(data?.points ?? []);

    if (data?.points.length) {
      const key = `${chartDataResetKey(rightRequest())}:${data.points.length}:${data.source}`;
      if (lastIndicatorDataRefresh().right !== key) {
        setLastIndicatorDataRefresh((current) => ({ ...current, right: key }));
        void refetchRightIndicators();
      }
    }
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

  createEffect(() => {
    const _scope = indicatorScope();
    const _instances = indicatorInstances();
    const _left = leftIndicators();
    const _right = rightIndicators();
    publishIndicatorState();
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
    setOperationStatus(
      `Config imported: ${result.watchlistCount} symbols, ${result.drawingCount} drawings, ${result.indicatorCount} indicators`,
    );
    await Promise.all([
      refetchSettings(),
      refetchWatchlist(),
      refetchLeft(),
      refetchRight(),
      refetchLeftIndicators(),
      refetchRightIndicators(),
      refetchIndicatorInstances(),
      refetchCacheSummary(),
    ]);
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

  const refreshIndicatorScope = async (chartId = indicatorConfigChart()) => {
    await Promise.all([
      refetchIndicatorInstances(),
      chartId === 'left' ? refetchLeftIndicators() : refetchRightIndicators(),
    ]);
  };

  const openAddIndicator = () => {
    const scope = indicatorScope();
    const params: IndicatorParams = { kind: 'ma', periods: [5, 10, 30] };
    const instance = createIndicatorDraft({
      chartId: scope.chartId,
      interval: scope.interval,
      params,
      position: indicatorInstances()?.length ?? 0,
    });

    setIndicatorEditor({
      mode: 'add',
      instance,
      periodsText: '5,10,30',
      error: '',
    });
  };

  const openEditIndicator = (instance: IndicatorInstance) => {
    setIndicatorEditor({
      mode: 'edit',
      instance: cloneIndicatorInstance(instance),
      periodsText: periodsTextForParams(instance.params),
      error: '',
    });
  };

  const saveIndicatorEditor = async () => {
    const editor = indicatorEditor();

    if (!editor) {
      return;
    }

    try {
      const instance = normalizeEditorInstance(editor);
      await saveIndicatorInstance(instance);
      setIndicatorEditor(null);
      setOperationStatus(`Indicator saved: ${indicatorName(instance.params)}`);
      await refreshIndicatorScope(instance.chartId);
    } catch (error) {
      setIndicatorEditor({
        ...editor,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const toggleIndicatorInstance = async (instance: IndicatorInstance, enabled: boolean) => {
    await saveIndicatorInstance({
      ...instance,
      enabled,
    });
    setOperationStatus(`${enabled ? 'Indicator shown' : 'Indicator hidden'}: ${instance.name}`);
    await refreshIndicatorScope(instance.chartId);
  };

  const removeIndicatorInstance = async (instance: IndicatorInstance) => {
    await deleteIndicatorInstance(instance.id);
    setOperationStatus(`Indicator deleted: ${instance.name}`);
    await refreshIndicatorScope(instance.chartId);
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
          <div class="indicator-scope">
            <div class="segmented">
              <button
                classList={{ active: indicatorConfigChart() === 'left' }}
                onClick={() => setIndicatorConfigChart('left')}
                data-indicator-scope="left"
              >
                Left
              </button>
              <button
                classList={{ active: indicatorConfigChart() === 'right' }}
                onClick={() => setIndicatorConfigChart('right')}
                data-indicator-scope="right"
              >
                Right
              </button>
            </div>
            <span>
              {indicatorScope().chartId} · {indicatorScope().interval}
            </span>
          </div>
          <Show when={chartLimit() > 200_000}>
            <p class="indicator-skip" data-indicator-skip>
              Indicators skipped above 200,000 rows.
            </p>
          </Show>
          <div class="indicator-list" data-indicator-list>
            <For each={indicatorInstances() ?? []} fallback={<span class="indicator-empty">No indicators</span>}>
              {(instance) => (
                <div class="indicator-row" data-indicator-row={instance.name}>
                  <button
                    class="indicator-row__name"
                    classList={{ muted: !instance.enabled }}
                    onClick={() => openEditIndicator(instance)}
                  >
                    {instance.name}
                  </button>
                  <button
                    title={instance.enabled ? 'Hide' : 'Show'}
                    aria-label={instance.enabled ? `Hide ${instance.name}` : `Show ${instance.name}`}
                    onClick={() => void toggleIndicatorInstance(instance, !instance.enabled)}
                    data-indicator-toggle={instance.name}
                  >
                    {instance.enabled ? '●' : '○'}
                  </button>
                  <button
                    title="Edit"
                    aria-label={`Edit ${instance.name}`}
                    onClick={() => openEditIndicator(instance)}
                    data-indicator-edit={instance.name}
                  >
                    ✎
                  </button>
                  <button
                    title="Delete"
                    aria-label={`Delete ${instance.name}`}
                    onClick={() => void removeIndicatorInstance(instance)}
                    data-indicator-delete={instance.name}
                  >
                    ×
                  </button>
                </div>
              )}
            </For>
          </div>
          <button
            class="indicator-add"
            disabled={(indicatorInstances()?.length ?? 0) >= 20}
            onClick={openAddIndicator}
            data-indicator-add
          >
            Add indicator
          </button>
          <Show when={(indicatorInstances()?.length ?? 0) >= 20}>
            <p class="indicator-skip" data-indicator-limit>
              Maximum 20 indicators in this chart and interval.
            </p>
          </Show>
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
            indicators={() => leftIndicators()?.series ?? []}
            indicatorInstances={() => leftIndicators()?.instances ?? []}
            indicatorStatus={() => leftIndicators()?.skippedReason}
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
            indicators={() => rightIndicators()?.series ?? []}
            indicatorInstances={() => rightIndicators()?.instances ?? []}
            indicatorStatus={() => rightIndicators()?.skippedReason}
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
      <Show when={indicatorEditor()}>
        {(editor) => (
          <IndicatorEditorDialog
            editor={editor()}
            onChange={(next) => setIndicatorEditor(next)}
            onClose={() => setIndicatorEditor(null)}
            onSave={() => void saveIndicatorEditor()}
          />
        )}
      </Show>
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

function IndicatorEditorDialog(props: {
  editor: IndicatorEditorState;
  onChange: (editor: IndicatorEditorState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const instance = () => props.editor.instance;
  const params = () => instance().params;
  const updateParams = (params: IndicatorParams) => {
    props.onChange({
      ...props.editor,
      periodsText: params.kind === 'ma' || params.kind === 'ema' ? params.periods.join(',') : props.editor.periodsText,
      instance: {
        ...instance(),
        params,
        kind: params.kind,
        name: indicatorName(params),
        styles: normalizeEditorStyles(params, instance().styles),
      },
      error: '',
    });
  };
  const updatePeriodsText = (periodsText: string) => {
    const currentParams = params();
    const nextParams: IndicatorParams =
      currentParams.kind === 'ma' || currentParams.kind === 'ema'
        ? {
            ...currentParams,
            periods: parsePeriodsLenient(periodsText),
          }
        : currentParams;

    props.onChange({
      ...props.editor,
      periodsText,
      instance: {
        ...instance(),
        params: nextParams,
      },
      error: '',
    });
  };
  const updateStyle = (key: string, patch: Partial<IndicatorStyle>) => {
    props.onChange({
      ...props.editor,
      instance: {
        ...instance(),
        styles: {
          ...instance().styles,
          [key]: {
            ...instance().styles[key],
            ...patch,
          },
        },
      },
      error: '',
    });
  };

  return (
    <div class="modal-backdrop" data-indicator-modal>
      <div class="indicator-dialog" role="dialog" aria-modal="true">
        <header>
          <h2>{props.editor.mode === 'add' ? 'Add indicator' : 'Edit indicator'}</h2>
          <button onClick={props.onClose} aria-label="Close indicator editor">
            ×
          </button>
        </header>
        <div class="indicator-dialog__body">
          <label>
            Type
            <select
              value={params().kind}
              onChange={(event) => updateParams(defaultParamsForKind(event.currentTarget.value as IndicatorKind))}
              data-indicator-kind
            >
              <For each={indicatorKinds}>{(kind) => <option value={kind}>{indicatorKindLabel(kind)}</option>}</For>
            </select>
          </label>
          <label>
            Name
            <input value={indicatorName(params())} readOnly data-indicator-name />
          </label>
          <div class="indicator-param-grid">
            <IndicatorParamFields
              params={params()}
              periodsText={props.editor.periodsText}
              onPeriodsText={updatePeriodsText}
              onParams={updateParams}
            />
          </div>
          <section class="indicator-style-editor">
            <h3>Style</h3>
            <For each={seriesKeysForParams(params())}>
              {(key) => (
                <div class="indicator-style-row">
                  <span>{key}</span>
                  <input
                    type="color"
                    value={toColorInputValue(instance().styles[key]?.color ?? '#ffffff')}
                    onInput={(event) => updateStyle(key, { color: event.currentTarget.value })}
                    data-indicator-style-color={key}
                  />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={instance().styles[key]?.lineWidth ?? 1}
                    onInput={(event) => updateStyle(key, { lineWidth: Number(event.currentTarget.value) })}
                    data-indicator-style-width={key}
                  />
                  <select
                    value={instance().styles[key]?.lineStyle ?? 'solid'}
                    onChange={(event) => updateStyle(key, { lineStyle: event.currentTarget.value as IndicatorLineStyle })}
                    data-indicator-style-line={key}
                  >
                    <For each={lineStyles}>{(style) => <option value={style}>{style}</option>}</For>
                  </select>
                </div>
              )}
            </For>
          </section>
          <Show when={props.editor.error}>
            <p class="indicator-error" data-indicator-error>
              {props.editor.error}
            </p>
          </Show>
        </div>
        <footer>
          <button onClick={props.onClose}>Cancel</button>
          <button onClick={props.onSave} data-indicator-save>
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}

function IndicatorParamFields(props: {
  params: IndicatorParams;
  periodsText: string;
  onPeriodsText: (value: string) => void;
  onParams: (params: IndicatorParams) => void;
}) {
  const numberInput = (label: string, value: number, onValue: (value: number) => void) => (
    <label>
      {label}
      <input
        type="number"
        min="1"
        max="500"
        value={value}
        onInput={(event) => onValue(Number(event.currentTarget.value))}
        data-indicator-param={label}
      />
    </label>
  );
  const decimalInput = (label: string, value: number, onValue: (value: number) => void) => (
    <label>
      {label}
      <input
        type="number"
        min="0.1"
        max="20"
        step="0.1"
        value={value}
        onInput={(event) => onValue(Number(event.currentTarget.value))}
        data-indicator-param={label}
      />
    </label>
  );

  return (
    <Switch>
      <Match when={props.params.kind === 'volume'}>
        <span class="indicator-param-note">Volume uses candle volume.</span>
      </Match>
      <Match when={props.params.kind === 'ma' || props.params.kind === 'ema'}>
        <label>
          Periods
          <input
            value={props.periodsText}
            onInput={(event) => props.onPeriodsText(event.currentTarget.value)}
            data-indicator-param="periods"
          />
        </label>
      </Match>
      <Match when={props.params.kind === 'boll'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'boll' }>;

          return (
            <>
              {numberInput('period', params.period, (period) => props.onParams({ ...params, period }))}
              {decimalInput('multiplier', params.multiplier, (multiplier) => props.onParams({ ...params, multiplier }))}
            </>
          );
        })()}
      </Match>
      <Match when={props.params.kind === 'macd'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'macd' }>;

          return (
            <>
              {numberInput('shortPeriod', params.shortPeriod, (shortPeriod) => props.onParams({ ...params, shortPeriod }))}
              {numberInput('longPeriod', params.longPeriod, (longPeriod) => props.onParams({ ...params, longPeriod }))}
              {numberInput('signalPeriod', params.signalPeriod, (signalPeriod) => props.onParams({ ...params, signalPeriod }))}
            </>
          );
        })()}
      </Match>
      <Match when={props.params.kind === 'rsi'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'rsi' }>;

          return numberInput('period', params.period, (period) => props.onParams({ ...params, period }));
        })()}
      </Match>
      <Match when={props.params.kind === 'atr'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'atr' }>;

          return numberInput('period', params.period, (period) => props.onParams({ ...params, period }));
        })()}
      </Match>
      <Match when={props.params.kind === 'kdj'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'kdj' }>;

          return (
            <>
              {numberInput('period', params.period, (period) => props.onParams({ ...params, period }))}
              {numberInput('kSmoothing', params.kSmoothing, (kSmoothing) => props.onParams({ ...params, kSmoothing }))}
              {numberInput('dSmoothing', params.dSmoothing, (dSmoothing) => props.onParams({ ...params, dSmoothing }))}
            </>
          );
        })()}
      </Match>
      <Match when={props.params.kind === 'supertrend'}>
        {(() => {
          const params = props.params as Extract<IndicatorParams, { kind: 'supertrend' }>;

          return (
            <>
              {numberInput('period', params.period, (period) => props.onParams({ ...params, period }))}
              {decimalInput('multiplier', params.multiplier, (multiplier) => props.onParams({ ...params, multiplier }))}
            </>
          );
        })()}
      </Match>
    </Switch>
  );
}

const indicatorKinds: IndicatorKind[] = ['volume', 'ma', 'ema', 'boll', 'macd', 'rsi', 'atr', 'kdj', 'supertrend'];
const lineStyles: IndicatorLineStyle[] = ['solid', 'dotted', 'dashed', 'large-dashed', 'sparse-dotted'];

function createIndicatorDraft(params: {
  chartId: ChartId;
  interval: string;
  params: IndicatorParams;
  position: number;
}): IndicatorInstance {
  return {
    id: `${params.chartId}-${params.interval}-${params.params.kind}-${Date.now()}`,
    chartId: params.chartId,
    interval: params.interval,
    kind: params.params.kind,
    name: indicatorName(params.params),
    enabled: true,
    position: params.position,
    params: params.params,
    styles: defaultStylesForParams(params.params),
    updatedAt: 0,
  };
}

function cloneIndicatorInstance(instance: IndicatorInstance): IndicatorInstance {
  return JSON.parse(JSON.stringify(instance)) as IndicatorInstance;
}

function normalizeEditorInstance(editor: IndicatorEditorState): IndicatorInstance {
  const params =
    editor.instance.params.kind === 'ma' || editor.instance.params.kind === 'ema'
      ? {
          ...editor.instance.params,
          periods: parsePeriodsStrict(editor.periodsText),
        }
      : editor.instance.params;

  validateIndicatorParams(params);

  return {
    ...editor.instance,
    kind: params.kind,
    name: indicatorName(params),
    params,
    styles: normalizeEditorStyles(params, editor.instance.styles),
  };
}

function defaultParamsForKind(kind: IndicatorKind): IndicatorParams {
  switch (kind) {
    case 'volume':
      return { kind: 'volume' };
    case 'ma':
      return { kind: 'ma', periods: [5, 10, 30] };
    case 'ema':
      return { kind: 'ema', periods: [12, 26] };
    case 'boll':
      return { kind: 'boll', period: 20, multiplier: 2 };
    case 'macd':
      return { kind: 'macd', shortPeriod: 12, longPeriod: 26, signalPeriod: 9 };
    case 'rsi':
      return { kind: 'rsi', period: 14 };
    case 'atr':
      return { kind: 'atr', period: 14 };
    case 'kdj':
      return { kind: 'kdj', period: 9, kSmoothing: 3, dSmoothing: 3 };
    case 'supertrend':
      return { kind: 'supertrend', period: 10, multiplier: 3 };
  }
}

export function indicatorName(params: IndicatorParams): string {
  switch (params.kind) {
    case 'volume':
      return 'Volume';
    case 'ma':
      return `MA(${params.periods.join(',')})`;
    case 'ema':
      return `EMA(${params.periods.join(',')})`;
    case 'boll':
      return `BOLL(${params.period},${formatIndicatorNumber(params.multiplier)})`;
    case 'macd':
      return `MACD(${params.shortPeriod},${params.longPeriod},${params.signalPeriod})`;
    case 'rsi':
      return `RSI(${params.period})`;
    case 'atr':
      return `ATR(${params.period})`;
    case 'kdj':
      return `KDJ(${params.period},${params.kSmoothing},${params.dSmoothing})`;
    case 'supertrend':
      return `Supertrend(${params.period},${formatIndicatorNumber(params.multiplier)})`;
  }
}

function indicatorKindLabel(kind: IndicatorKind) {
  return kind === 'ma'
    ? 'MA'
    : kind === 'ema'
      ? 'EMA'
      : kind === 'boll'
        ? 'BOLL'
        : kind === 'macd'
          ? 'MACD'
          : kind === 'rsi'
            ? 'RSI'
            : kind === 'atr'
              ? 'ATR'
              : kind === 'kdj'
                ? 'KDJ'
                : kind === 'supertrend'
                  ? 'Supertrend'
                  : 'Volume';
}

function periodsTextForParams(params: IndicatorParams) {
  return params.kind === 'ma' || params.kind === 'ema' ? params.periods.join(',') : '';
}

function parsePeriodsLenient(value: string) {
  const parsed = value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return parsed.length > 0 ? parsed : [1];
}

function parsePeriodsStrict(value: string) {
  const periods = value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => item > 0);

  if (periods.length < 1 || periods.length > 8 || periods.some((period) => !Number.isInteger(period))) {
    throw new Error('periods must contain 1 to 8 integer values');
  }

  if (new Set(periods).size !== periods.length) {
    throw new Error('periods must not contain duplicates');
  }

  periods.forEach((period) => validatePeriod(period, 'period'));

  return periods;
}

function validateIndicatorParams(params: IndicatorParams) {
  switch (params.kind) {
    case 'volume':
      return;
    case 'ma':
    case 'ema':
      parsePeriodsStrict(params.periods.join(','));
      return;
    case 'boll':
      validatePeriod(params.period, 'period');
      validateMultiplier(params.multiplier, 'multiplier');
      return;
    case 'macd':
      validatePeriod(params.shortPeriod, 'shortPeriod');
      validatePeriod(params.longPeriod, 'longPeriod');
      validatePeriod(params.signalPeriod, 'signalPeriod');
      if (params.shortPeriod >= params.longPeriod) {
        throw new Error('shortPeriod must be lower than longPeriod');
      }
      return;
    case 'rsi':
    case 'atr':
      validatePeriod(params.period, 'period');
      return;
    case 'kdj':
      validatePeriod(params.period, 'period');
      validatePeriod(params.kSmoothing, 'kSmoothing');
      validatePeriod(params.dSmoothing, 'dSmoothing');
      return;
    case 'supertrend':
      validatePeriod(params.period, 'period');
      validateMultiplier(params.multiplier, 'multiplier');
      return;
  }
}

function validatePeriod(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new Error(`${label} must be between 1 and 500`);
  }
}

function validateMultiplier(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0.1 || value > 20) {
    throw new Error(`${label} must be between 0.1 and 20`);
  }
}

function normalizeEditorStyles(params: IndicatorParams, styles: Record<string, IndicatorStyle>) {
  const defaults = defaultStylesForParams(params);
  const normalized: Record<string, IndicatorStyle> = {};

  for (const key of seriesKeysForParams(params)) {
    const style = styles[key] ?? defaults[key];

    normalized[key] = {
      color: normalizeColor(style.color),
      lineWidth: Math.min(Math.max(Math.round(style.lineWidth), 1), 5),
      lineStyle: lineStyles.includes(style.lineStyle) ? style.lineStyle : 'solid',
    };
  }

  return normalized;
}

function defaultStylesForParams(params: IndicatorParams): Record<string, IndicatorStyle> {
  const palette = defaultPalette(params.kind);

  return Object.fromEntries(
    seriesKeysForParams(params).map((key, index) => [
      key,
      {
        color: palette[index % palette.length],
        lineWidth: params.kind === 'supertrend' ? 2 : 1,
        lineStyle: 'solid' as const,
      },
    ]),
  );
}

function seriesKeysForParams(params: IndicatorParams): string[] {
  switch (params.kind) {
    case 'volume':
      return ['volume'];
    case 'ma':
    case 'ema':
      return params.periods.map(String);
    case 'boll':
      return ['up', 'mid', 'down'];
    case 'macd':
      return ['dif', 'dea', 'histogram'];
    case 'rsi':
      return ['rsi'];
    case 'atr':
      return ['atr'];
    case 'kdj':
      return ['k', 'd', 'j'];
    case 'supertrend':
      return ['supertrend'];
  }
}

function defaultPalette(kind: IndicatorKind) {
  switch (kind) {
    case 'volume':
      return ['#4b78ff'];
    case 'ma':
      return ['#f6c343', '#38bdf8', '#fb7185', '#a3e635'];
    case 'ema':
      return ['#8b5cf6', '#14b8a6', '#f97316', '#60a5fa'];
    case 'boll':
      return ['#94a3b8', '#64748b', '#94a3b8'];
    case 'macd':
      return ['#f6c343', '#38bdf8', '#22ab94'];
    case 'rsi':
      return ['#fb7185'];
    case 'atr':
      return ['#14b8a6'];
    case 'kdj':
      return ['#f6c343', '#38bdf8', '#fb7185'];
    case 'supertrend':
      return ['#22ab94'];
  }
}

function normalizeColor(color: string) {
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color) ? color : '#ffffff';
}

function toColorInputValue(color: string) {
  return normalizeColor(color).slice(0, 7);
}

function formatIndicatorNumber(value: number) {
  return Number(value.toFixed(2)).toString();
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

function publishIndicatorState() {
  if (typeof window === 'undefined') {
    return;
  }

  (
    window as Window & {
      __KLINEFORGE_INDICATORS__?: ReturnType<typeof getPreviewIndicatorDebugState>;
    }
  ).__KLINEFORGE_INDICATORS__ = getPreviewIndicatorDebugState();
}
