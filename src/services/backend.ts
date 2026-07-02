import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  AppSettings,
  BenchmarkSummary,
  CacheClearRequest,
  CacheClearResult,
  ChartDatasetExport,
  CacheSummary,
  ChartDataResponse,
  ConfigImportResult,
  CsvExport,
  DrawingObject,
  DrawingQuery,
  FullHistoryEnqueueRequest,
  LiveKlineEvent,
  LiveStreamRequest,
  HealthStatus,
  IndicatorCalculationRequest,
  IndicatorInstance,
  IndicatorKind,
  IndicatorLineStyle,
  IndicatorParams,
  IndicatorResponse,
  IndicatorScope,
  IndicatorSeries,
  IndicatorStyle,
  KlineRequest,
  Leaderboards,
  Market,
  MarketInfoSnapshot,
  CacheTask,
  SymbolSummary,
  WatchlistMutation,
  WatchlistReorderRequest,
} from './types';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function getHealth(): Promise<HealthStatus> {
  if (!isTauriRuntime) {
    return {
      appVersion: 'browser-preview',
      backend: 'vite-preview',
      databaseReady: false,
    };
  }

  return invoke<HealthStatus>('health');
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauriRuntime) {
    previewSettings = normalizeStoredAppSettings(previewSettings);

    return previewSettings;
  }

  return invoke<AppSettings>('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = validateAppSettings(settings);

  if (!isTauriRuntime) {
    previewSettings = { ...normalized };

    return previewSettings;
  }

  return invoke<AppSettings>('save_settings', { settings: normalized });
}

export async function getWatchlist(market: Market): Promise<string[]> {
  if (!isTauriRuntime) {
    return [...previewWatchlists[market]];
  }

  return invoke<string[]>('get_watchlist', { market });
}

export async function addWatchlistSymbol(request: WatchlistMutation): Promise<string[]> {
  if (!isTauriRuntime) {
    const symbol = request.symbol.toUpperCase();

    if (!previewWatchlists[request.market].includes(symbol)) {
      previewWatchlists[request.market] = [...previewWatchlists[request.market], symbol];
    }

    return [...previewWatchlists[request.market]];
  }

  return invoke<string[]>('add_watchlist_symbol', { request });
}

export async function removeWatchlistSymbol(request: WatchlistMutation): Promise<string[]> {
  if (!isTauriRuntime) {
    previewWatchlists[request.market] = previewWatchlists[request.market].filter(
      (symbol) => symbol !== request.symbol.toUpperCase(),
    );

    return [...previewWatchlists[request.market]];
  }

  return invoke<string[]>('remove_watchlist_symbol', { request });
}

export async function reorderWatchlist(request: WatchlistReorderRequest): Promise<string[]> {
  if (!isTauriRuntime) {
    previewWatchlists[request.market] = request.symbols.map((symbol) => symbol.toUpperCase());

    return request.symbols;
  }

  return invoke<string[]>('reorder_watchlist', { request });
}

export async function getSymbols(market: Market): Promise<SymbolSummary[]> {
  if (!isTauriRuntime) {
    return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'].map((symbol) => ({
      market,
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      status: 'TRADING',
    }));
  }

  return invoke<SymbolSummary[]>('get_symbols', { market });
}

export async function getMarketInfo(market: Market, symbol: string): Promise<MarketInfoSnapshot | null> {
  if (!isTauriRuntime) {
    return null;
  }

  return invoke<MarketInfoSnapshot>('get_market_info', { market, symbol });
}

export async function getLeaderboards(market: Market): Promise<Leaderboards> {
  if (!isTauriRuntime) {
    return {
      gainers: [],
      losers: [],
      volume: [],
    };
  }

  return invoke<Leaderboards>('get_leaderboards', { market });
}

export async function getChartData(request: KlineRequest): Promise<ChartDataResponse> {
  if (!isTauriRuntime) {
    const dataset = await loadPreviewDataset(request);

    if (dataset) {
      return {
        points: dataset.points,
        source: `${dataset.source}:artifact`,
        cached: true,
      };
    }

    return createPreviewChartData(request);
  }

  return invoke<ChartDataResponse>('get_chart_data', { request });
}

export async function getIndicators(calculation: IndicatorCalculationRequest): Promise<IndicatorResponse> {
  if (!isTauriRuntime) {
    const instances = await listIndicatorInstances({
      chartId: calculation.chartId,
      interval: calculation.request.interval,
    });

    if (calculation.request.limit === 0 || (calculation.request.limit ?? 0) > (calculation.maxRows ?? 200_000)) {
      return {
        instances,
        series: [],
        skippedReason: `Indicator calculation skipped above ${calculation.maxRows ?? 200_000} rows`,
      };
    }

    const data = await getChartData(calculation.request);

    return {
      instances,
      series: calculatePreviewIndicatorSeries(data.points, instances),
    };
  }

  return invoke<IndicatorResponse>('get_indicators', { calculation });
}

export async function listIndicatorInstances(scope: IndicatorScope): Promise<IndicatorInstance[]> {
  if (!isTauriRuntime) {
    return ensurePreviewIndicatorScope(scope.chartId, scope.interval);
  }

  return invoke<IndicatorInstance[]>('list_indicator_instances', { scope });
}

export async function saveIndicatorInstance(instance: IndicatorInstance): Promise<IndicatorInstance> {
  if (!isTauriRuntime) {
    const normalized = normalizePreviewIndicatorInstance(instance);
    const key = indicatorScopeKey(normalized.chartId, normalized.interval);
    const current = previewIndicatorInstances.get(key) ?? [];
    const withoutCurrent = current.filter((candidate) => candidate.id !== normalized.id);

    if (withoutCurrent.length >= 20) {
      throw new Error('at most 20 indicator instances are allowed per chart and interval');
    }

    const next = [...withoutCurrent, { ...normalized, updatedAt: Date.now() }].sort(
      (first, second) => first.position - second.position,
    );
    previewIndicatorInstances.set(key, next);

    return normalized;
  }

  return invoke<IndicatorInstance>('save_indicator_instance', { instance });
}

export async function deleteIndicatorInstance(id: string): Promise<boolean> {
  if (!isTauriRuntime) {
    let deleted = false;

    for (const [key, instances] of previewIndicatorInstances) {
      const next = instances.filter((instance) => instance.id !== id);

      if (next.length !== instances.length) {
        deleted = true;
        previewIndicatorInstances.set(key, next);
      }
    }

    return deleted;
  }

  return invoke<boolean>('delete_indicator_instance', { id });
}

export async function getCacheSummary(): Promise<CacheSummary[]> {
  if (!isTauriRuntime) {
    return [];
  }

  return invoke<CacheSummary[]>('get_cache_summary');
}

export async function getCacheTasks(): Promise<CacheTask[]> {
  if (!isTauriRuntime) {
    return previewCacheTasks;
  }

  return invoke<CacheTask[]>('get_cache_tasks');
}

export async function enqueueFullHistoryTasks(request: FullHistoryEnqueueRequest): Promise<CacheTask[]> {
  if (!isTauriRuntime) {
    const now = Date.now();
    const tasks = request.intervals.map((interval) => ({
      id: `preview-full-history:${request.market}:${request.symbol.toUpperCase()}:${interval}`,
      market: request.market,
      symbol: request.symbol.toUpperCase(),
      interval,
      status: 'cancelled',
      progress: 0,
      phase: 'preview-unavailable',
      message: 'Full-history downloads are available in the Tauri desktop runtime.',
      rowsWritten: 0,
      archiveMonths: 0,
      restPages: 0,
      updatedAt: now,
    }) satisfies CacheTask);
    previewCacheTasks = tasks;

    return tasks;
  }

  return invoke<CacheTask[]>('enqueue_full_history_tasks', { request });
}

export async function cancelCacheTask(id: string): Promise<CacheTask | null> {
  if (!isTauriRuntime) {
    const task = previewCacheTasks.find((candidate) => candidate.id === id);

    if (task) {
      task.status = 'cancelled';
      task.phase = 'preview-unavailable';
      task.message = 'Full-history downloads are available in the Tauri desktop runtime.';
      task.updatedAt = Date.now();
    }

    return task ?? null;
  }

  return invoke<CacheTask | null>('cancel_cache_task', { id });
}

export async function retryCacheTask(id: string): Promise<CacheTask> {
  if (!isTauriRuntime) {
    const task = previewCacheTasks.find((candidate) => candidate.id === id);

    if (!task) {
      throw new Error(`cache task not found: ${id}`);
    }

    task.status = 'cancelled';
    task.updatedAt = Date.now();

    return task;
  }

  return invoke<CacheTask>('retry_cache_task', { id });
}

export async function clearCache(request: CacheClearRequest): Promise<CacheClearResult> {
  if (!isTauriRuntime) {
    return { deletedRows: 0 };
  }

  return invoke<CacheClearResult>('clear_cache', { request });
}

export async function exportKlinesCsv(request: KlineRequest): Promise<CsvExport> {
  if (!isTauriRuntime) {
    const dataset = await loadPreviewDataset(request);
    const preview = dataset
      ? {
          points: dataset.points.slice(-Math.min(request.limit ?? 10_000, dataset.points.length)),
          source: `${dataset.source}:artifact`,
          cached: true,
        }
      : createPreviewChartData(request);
    const content = [
      'time,open,high,low,close,volume',
      ...preview.points.map((point) =>
        [point.time, point.open, point.high, point.low, point.close, point.volume].join(','),
      ),
    ].join('\n');

    return {
      fileName: `${request.market}-${request.symbol}-${request.interval}-${dataset ? 'artifact' : 'preview'}.csv`,
      content,
      rowCount: preview.points.length,
    };
  }

  return invoke<CsvExport>('export_klines_csv', { request });
}

export async function exportConfig(): Promise<string> {
  if (!isTauriRuntime) {
    return JSON.stringify({
      schemaVersion: 3,
      exportedAt: Date.now(),
      settings: await getSettings(),
      watchlist: await getWatchlist(previewSettings.market),
      drawings: previewDrawings,
      indicators: [...previewIndicatorInstances.values()].flat(),
    }, null, 2);
  }

  return invoke<string>('export_config');
}

export async function importConfig(content: string): Promise<ConfigImportResult> {
  if (!isTauriRuntime) {
    const config = JSON.parse(content) as Partial<{
      settings: AppSettings;
      watchlist: string[];
      drawings: DrawingObject[];
      indicators: IndicatorInstance[];
    }>;

    if (config.settings) {
      previewSettings = validateAppSettings(config.settings);
    }

    if (Array.isArray(config.watchlist)) {
      previewWatchlists[previewSettings.market] = config.watchlist.map((symbol) => symbol.toUpperCase());
    }

    if (Array.isArray(config.drawings)) {
      previewDrawings = config.drawings;
    }

    if (Array.isArray(config.indicators)) {
      previewIndicatorInstances.clear();
      for (const instance of config.indicators) {
        await saveIndicatorInstance(instance);
      }
    }

    return {
      settingsImported: content.trim().length > 0,
      watchlistCount: config.watchlist?.length ?? 0,
      drawingCount: config.drawings?.length ?? 0,
      indicatorCount: config.indicators?.length ?? 0,
    };
  }

  return invoke<ConfigImportResult>('import_config', { content });
}

export async function getDrawings(query: DrawingQuery): Promise<DrawingObject[]> {
  if (!isTauriRuntime) {
    return previewDrawings.filter(
      (drawing) =>
        drawing.market === query.market &&
        drawing.symbol === query.symbol.toUpperCase() &&
        drawing.interval === query.interval &&
        drawing.chartId === query.chartId,
    );
  }

  return invoke<DrawingObject[]>('get_drawings', { query });
}

export async function saveDrawing(drawing: DrawingObject): Promise<DrawingObject> {
  if (!isTauriRuntime) {
    const next = {
      ...drawing,
      symbol: drawing.symbol.toUpperCase(),
      updatedAt: Date.now(),
    };
    const index = previewDrawings.findIndex((current) => current.id === next.id);

    if (index >= 0) {
      previewDrawings[index] = next;
    } else {
      previewDrawings.unshift(next);
    }

    return next;
  }

  return invoke<DrawingObject>('save_drawing', { drawing });
}

export async function deleteDrawing(id: string): Promise<boolean> {
  if (!isTauriRuntime) {
    const previousLength = previewDrawings.length;
    previewDrawings = previewDrawings.filter((drawing) => drawing.id !== id);

    return previewDrawings.length !== previousLength;
  }

  return invoke<boolean>('delete_drawing', { id });
}

export async function startLiveStream(request: LiveStreamRequest): Promise<void> {
  if (!isTauriRuntime) {
    return;
  }

  await invoke('start_live_stream', { request });
}

export async function stopLiveStream(chartId: LiveStreamRequest['chartId']): Promise<void> {
  if (!isTauriRuntime) {
    return;
  }

  await invoke('stop_live_stream', { chartId });
}

export async function listenLiveKlineUpdates(handler: (event: LiveKlineEvent) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) {
    return () => undefined;
  }

  return listen<LiveKlineEvent>('kline://update', (event) => handler(event.payload));
}

export async function runPerformanceBenchmark(request: KlineRequest): Promise<BenchmarkSummary> {
  if (!isTauriRuntime) {
    const dataset = await loadPreviewDataset(request);

    if (dataset) {
      return dataset.benchmark;
    }

    return {
      market: request.market,
      symbol: request.symbol,
      interval: request.interval,
      requestedRows: request.limit ?? 1500,
      fetchedRows: request.limit ?? 1500,
      fetchMs: 0,
      sqliteWriteMs: 0,
      sqliteReadMs: 0,
      indicatorMs: 0,
      source: 'preview',
    };
  }

  return invoke<BenchmarkSummary>('run_performance_benchmark', { request });
}

const previewDatasetCache = new Map<string, Promise<ChartDatasetExport | null>>();
const previewIndicatorInstances = new Map<string, IndicatorInstance[]>();
const previewIndicatorScopesInitialized = new Set<string>();
let previewSettings: AppSettings = defaultPreviewSettings();
let previewCacheTasks: CacheTask[] = [];
const supportedIntervals = ['1m', '3m', '5m', '15m', '1h', '2h', '4h', '1d', '1W', '1M'];
const supportedChartLimits = [1000, 100000, 1000000];
const supportedDrawingTypes = [
  'horizontal-line',
  'trend-line',
  'vertical-line',
  'rectangle',
  'text',
  'measurement',
];
const previewWatchlists: Record<Market, string[]> = {
  spot: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  usdM: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
};
let previewDrawings: DrawingObject[] = [];

export function resetPreviewStateForTests() {
  previewIndicatorInstances.clear();
  previewIndicatorScopesInitialized.clear();
  previewSettings = defaultPreviewSettings();
  previewWatchlists.spot = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  previewWatchlists.usdM = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  previewCacheTasks = [];
  previewDrawings = [];
}

export function setPreviewSettingsForTests(settings: unknown) {
  previewSettings = settings as AppSettings;
}

export function setPreviewCacheTasksForTests(tasks: CacheTask[]) {
  previewCacheTasks = tasks.map((task) => ({ ...task }));
}

function defaultPreviewSettings(): AppSettings {
  return {
    market: 'usdM',
    symbol: 'BTCUSDT',
    leftInterval: '5m',
    rightInterval: '1h',
    theme: 'dark',
    language: 'zh',
    chartLimit: 1000,
    indicatorConfigChart: 'left',
    drawingType: 'horizontal-line',
  };
}

function normalizeStoredAppSettings(settings: AppSettings): AppSettings {
  const defaults = defaultPreviewSettings();

  return validateAppSettings({
    ...settings,
    chartLimit: settings.chartLimit ?? defaults.chartLimit,
    indicatorConfigChart: settings.indicatorConfigChart ?? defaults.indicatorConfigChart,
    drawingType: settings.drawingType ?? defaults.drawingType,
  });
}

export function createDefaultIndicatorInstances(
  chartId: LiveStreamRequest['chartId'],
  interval: string,
): IndicatorInstance[] {
  const defaults: IndicatorParams[] = [
    { kind: 'volume' },
    { kind: 'ma', periods: [5, 10, 30] },
    { kind: 'ema', periods: [12, 26] },
    { kind: 'boll', period: 20, multiplier: 2 },
    { kind: 'macd', shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
    { kind: 'rsi', period: 14 },
    { kind: 'atr', period: 14 },
    { kind: 'kdj', period: 9, kSmoothing: 3, dSmoothing: 3 },
    { kind: 'supertrend', period: 10, multiplier: 3 },
  ];

  return defaults
    .map((params, position) =>
      normalizePreviewIndicatorInstance({
        id: `${chartId}-${interval}-${params.kind}`,
        chartId,
        interval,
        kind: params.kind,
        name: indicatorName(params),
        enabled: true,
        position,
        params,
        styles: defaultStylesForParams(params),
        updatedAt: 0,
      }),
    );
}

function ensurePreviewIndicatorScope(chartId: LiveStreamRequest['chartId'], interval: string) {
  const key = indicatorScopeKey(chartId, interval);
  const current = previewIndicatorInstances.get(key);

  if (current || previewIndicatorScopesInitialized.has(key)) {
    return [...(current ?? [])];
  }

  const defaults = createDefaultIndicatorInstances(chartId, interval);
  previewIndicatorInstances.set(key, defaults);
  previewIndicatorScopesInitialized.add(key);

  return [...defaults];
}

export function getPreviewIndicatorDebugState() {
  return Object.fromEntries(
    [...previewIndicatorInstances.entries()].map(([scope, instances]) => [
      scope,
      instances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        enabled: instance.enabled,
        params: instance.params,
        styles: instance.styles,
      })),
    ]),
  );
}

function normalizePreviewIndicatorInstance(instance: IndicatorInstance): IndicatorInstance {
  validateIndicatorParams(instance.params);
  const styles = normalizeStyles(instance.params, instance.styles);

  return {
    ...instance,
    kind: instance.params.kind,
    name: indicatorName(instance.params),
    styles,
  };
}

function indicatorScopeKey(chartId: LiveStreamRequest['chartId'], interval: string) {
  return `${chartId}:${interval}`;
}

function validateAppSettings(settings: AppSettings): AppSettings {
  const requiredKeys: Array<keyof AppSettings> = [
    'market',
    'symbol',
    'leftInterval',
    'rightInterval',
    'theme',
    'language',
    'chartLimit',
    'indicatorConfigChart',
    'drawingType',
  ];

  for (const key of requiredKeys) {
    if (settings[key] === undefined || settings[key] === null) {
      throw new Error(`app-settings is missing required field: ${key}`);
    }
  }

  if (settings.market !== 'spot' && settings.market !== 'usdM') {
    throw new Error(`unsupported market setting: ${settings.market}`);
  }

  if (!settings.symbol.trim()) {
    throw new Error('symbol setting is required');
  }

  if (!supportedIntervals.includes(settings.leftInterval)) {
    throw new Error(`unsupported leftInterval setting: ${settings.leftInterval}`);
  }

  if (!supportedIntervals.includes(settings.rightInterval)) {
    throw new Error(`unsupported rightInterval setting: ${settings.rightInterval}`);
  }

  if (!supportedChartLimits.includes(settings.chartLimit)) {
    throw new Error(`unsupported chartLimit setting: ${settings.chartLimit}`);
  }

  if (settings.indicatorConfigChart !== 'left' && settings.indicatorConfigChart !== 'right') {
    throw new Error(`unsupported indicatorConfigChart setting: ${settings.indicatorConfigChart}`);
  }

  if (!supportedDrawingTypes.includes(settings.drawingType)) {
    throw new Error(`unsupported drawingType setting: ${settings.drawingType}`);
  }

  return {
    ...settings,
    symbol: settings.symbol.toUpperCase(),
  };
}

function indicatorName(params: IndicatorParams) {
  switch (params.kind) {
    case 'volume':
      return 'Volume';
    case 'ma':
      return `MA(${params.periods.join(',')})`;
    case 'ema':
      return `EMA(${params.periods.join(',')})`;
    case 'boll':
      return `BOLL(${params.period},${formatParameterNumber(params.multiplier)})`;
    case 'macd':
      return `MACD(${params.shortPeriod},${params.longPeriod},${params.signalPeriod})`;
    case 'rsi':
      return `RSI(${params.period})`;
    case 'atr':
      return `ATR(${params.period})`;
    case 'kdj':
      return `KDJ(${params.period},${params.kSmoothing},${params.dSmoothing})`;
    case 'supertrend':
      return `Supertrend(${params.period},${formatParameterNumber(params.multiplier)})`;
  }
}

function formatParameterNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function validateIndicatorParams(params: IndicatorParams) {
  switch (params.kind) {
    case 'volume':
      return;
    case 'ma':
    case 'ema':
      if (params.periods.length < 1 || params.periods.length > 8) {
        throw new Error('periods must contain 1 to 8 values');
      }
      if (new Set(params.periods).size !== params.periods.length) {
        throw new Error('periods must not contain duplicates');
      }
      params.periods.forEach((period) => validatePeriod(period, 'period'));
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
        throw new Error('MACD shortPeriod must be lower than longPeriod');
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

function normalizeStyles(params: IndicatorParams, styles: Record<string, IndicatorStyle>) {
  const defaults = defaultStylesForParams(params);
  const normalized: Record<string, IndicatorStyle> = {};

  for (const key of seriesKeysForParams(params)) {
    const style = styles[key] ?? defaults[key];
    normalized[key] = {
      color: style.color,
      lineWidth: Math.min(Math.max(Math.round(style.lineWidth), 1), 5),
      lineStyle: style.lineStyle,
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
        lineStyle: 'solid' as IndicatorLineStyle,
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

function defaultPalette(kind: IndicatorKind): string[] {
  switch (kind) {
    case 'volume':
      return ['#4b78ff66'];
    case 'ma':
      return ['#f6c343', '#38bdf8', '#fb7185', '#a3e635'];
    case 'ema':
      return ['#8b5cf6', '#14b8a6', '#f97316', '#60a5fa'];
    case 'boll':
      return ['#94a3b8', '#64748b', '#94a3b8'];
    case 'macd':
      return ['#f6c343', '#38bdf8', '#22ab9466'];
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

function calculatePreviewIndicatorSeries(points: ChartDataResponse['points'], instances: IndicatorInstance[]): IndicatorSeries[] {
  const closes = points.map((point) => point.close);
  const series: IndicatorSeries[] = [];

  for (const instance of instances.filter((candidate) => candidate.enabled)) {
    switch (instance.params.kind) {
      case 'volume':
        series.push({
          id: `${instance.id}:volume`,
          instanceId: instance.id,
          key: 'volume',
          label: 'Volume',
          seriesType: 'histogram',
          pane: 0,
          priceScaleId: 'volume',
          style: instance.styles.volume,
          data: points.map((point) => ({
            time: point.time,
            value: point.volume,
            color: point.close >= point.open ? '#22ab9444' : '#f2364544',
          })),
        });
        break;
      case 'ma':
        for (const period of instance.params.periods) {
          pushPreviewLine(series, instance, String(period), `MA${period}`, 0, movingAverage(closes, period), points);
        }
        break;
      case 'ema':
        for (const period of instance.params.periods) {
          pushPreviewLine(series, instance, String(period), `EMA${period}`, 0, exponentialMovingAverage(closes, period), points);
        }
        break;
      case 'boll': {
        const values = bollingerBands(closes, instance.params.period, instance.params.multiplier);
        pushPreviewLine(series, instance, 'up', 'BOLL UP', 0, values.map((value) => value?.[1]), points);
        pushPreviewLine(series, instance, 'mid', 'BOLL MID', 0, values.map((value) => value?.[0]), points);
        pushPreviewLine(series, instance, 'down', 'BOLL DOWN', 0, values.map((value) => value?.[2]), points);
        break;
      }
      case 'macd': {
        const values = macd(closes, instance.params.shortPeriod, instance.params.longPeriod, instance.params.signalPeriod);
        pushPreviewLine(series, instance, 'dif', 'DIF', 1, values.map((value) => value?.[0]), points);
        pushPreviewLine(series, instance, 'dea', 'DEA', 1, values.map((value) => value?.[1]), points);
        pushPreviewHistogram(series, instance, 'histogram', 'MACD', 1, values.map((value) => value?.[2]), points, true);
        break;
      }
      case 'rsi':
        pushPreviewLine(series, instance, 'rsi', `RSI${instance.params.period}`, 2, rsi(closes, instance.params.period), points);
        break;
      case 'atr':
        pushPreviewLine(series, instance, 'atr', `ATR${instance.params.period}`, 3, atr(points, instance.params.period), points);
        break;
      case 'kdj': {
        const values = kdj(points, instance.params.period, instance.params.kSmoothing, instance.params.dSmoothing);
        pushPreviewLine(series, instance, 'k', 'K', 4, values.map((value) => value?.[0]), points);
        pushPreviewLine(series, instance, 'd', 'D', 4, values.map((value) => value?.[1]), points);
        pushPreviewLine(series, instance, 'j', 'J', 4, values.map((value) => value?.[2]), points);
        break;
      }
      case 'supertrend': {
        const values = supertrend(points, instance.params.period, instance.params.multiplier);
        series.push({
          id: `${instance.id}:supertrend`,
          instanceId: instance.id,
          key: 'supertrend',
          label: `Supertrend${instance.params.period}`,
          seriesType: 'line',
          pane: 0,
          style: instance.styles.supertrend,
          data: values.flatMap((value, index) =>
            value
              ? [
                  {
                    time: points[index].time,
                    value: value[0],
                    color: value[1] >= 0 ? '#22ab94' : '#f23645',
                  },
                ]
              : [],
          ),
        });
        break;
      }
    }
  }

  return series;
}

function pushPreviewLine(
  series: IndicatorSeries[],
  instance: IndicatorInstance,
  key: string,
  label: string,
  pane: number,
  values: Array<number | undefined>,
  points: ChartDataResponse['points'],
) {
  pushPreviewSeries(series, instance, key, label, 'line', pane, values, points);
}

function pushPreviewHistogram(
  series: IndicatorSeries[],
  instance: IndicatorInstance,
  key: string,
  label: string,
  pane: number,
  values: Array<number | undefined>,
  points: ChartDataResponse['points'],
  colorBySign = false,
) {
  pushPreviewSeries(series, instance, key, label, 'histogram', pane, values, points, colorBySign);
}

function pushPreviewSeries(
  series: IndicatorSeries[],
  instance: IndicatorInstance,
  key: string,
  label: string,
  seriesType: IndicatorSeries['seriesType'],
  pane: number,
  values: Array<number | undefined>,
  points: ChartDataResponse['points'],
  colorBySign = false,
) {
  series.push({
    id: `${instance.id}:${key}`,
    instanceId: instance.id,
    key,
    label,
    seriesType,
    pane,
    style: instance.styles[key],
    data: values.flatMap((value, index) =>
      typeof value === 'number'
        ? [
            {
              time: points[index].time,
              value,
              color: colorBySign ? (value >= 0 ? '#22ab9466' : '#f2364566') : undefined,
            },
          ]
        : [],
    ),
  });
}

function movingAverage(values: number[], period: number) {
  const result: Array<number | undefined> = Array.from({ length: values.length });
  let sum = 0;

  values.forEach((value, index) => {
    sum += value;
    if (index >= period) {
      sum -= values[index - period];
    }
    if (index + 1 >= period) {
      result[index] = sum / period;
    }
  });

  return result;
}

function exponentialMovingAverage(values: number[], period: number) {
  const result: Array<number | undefined> = Array.from({ length: values.length });
  const alpha = 2 / (period + 1);
  let ema = 0;

  values.forEach((value, index) => {
    if (index === period - 1) {
      ema = values.slice(0, period).reduce((sum, current) => sum + current, 0) / period;
      result[index] = ema;
    } else if (index >= period) {
      ema = value * alpha + ema * (1 - alpha);
      result[index] = ema;
    }
  });

  return result;
}

function bollingerBands(values: number[], period: number, multiplier: number) {
  const result: Array<[number, number, number] | undefined> = Array.from({ length: values.length });

  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index + 1 - period, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / period;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);

    result[index] = [mean, mean + multiplier * deviation, mean - multiplier * deviation];
  }

  return result;
}

function macd(values: number[], shortPeriod: number, longPeriod: number, signalPeriod: number) {
  const short = exponentialMovingAverage(values, shortPeriod);
  const long = exponentialMovingAverage(values, longPeriod);
  const difValues = values.map((_, index) => (short[index] ?? 0) - (long[index] ?? 0));
  const dea = exponentialMovingAverage(difValues, signalPeriod);

  return values.map((_, index) =>
    typeof dea[index] === 'number' ? ([difValues[index], dea[index], (difValues[index] - dea[index]) * 2] as const) : undefined,
  );
}

function rsi(values: number[], period: number) {
  const result: Array<number | undefined> = Array.from({ length: values.length });
  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;

      if (index === period) {
        avgGain /= period;
        avgLoss /= period;
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (index >= period) {
      result[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return result;
}

function atr(points: ChartDataResponse['points'], period: number) {
  const ranges = points.map((point, index) => {
    const previous = points[index - 1];

    if (!previous) {
      return point.high - point.low;
    }

    return Math.max(point.high - point.low, Math.abs(point.high - previous.close), Math.abs(point.low - previous.close));
  });

  return wilderAverage(ranges, period);
}

function kdj(points: ChartDataResponse['points'], period: number, kSmoothing: number, dSmoothing: number) {
  const result: Array<[number, number, number] | undefined> = Array.from({ length: points.length });
  let previousK = 50;
  let previousD = 50;

  for (let index = period - 1; index < points.length; index += 1) {
    const window = points.slice(index + 1 - period, index + 1);
    const highest = Math.max(...window.map((point) => point.high));
    const lowest = Math.min(...window.map((point) => point.low));
    const rsv = Math.abs(highest - lowest) < Number.EPSILON ? 50 : ((points[index].close - lowest) / (highest - lowest)) * 100;
    const k = (previousK * (kSmoothing - 1) + rsv) / kSmoothing;
    const d = (previousD * (dSmoothing - 1) + k) / dSmoothing;
    const j = 3 * k - 2 * d;

    previousK = k;
    previousD = d;
    result[index] = [k, d, j];
  }

  return result;
}

function supertrend(points: ChartDataResponse['points'], period: number, multiplier: number) {
  const atrValues = atr(points, period);
  const result: Array<[number, number] | undefined> = Array.from({ length: points.length });
  let finalUpper = 0;
  let finalLower = 0;
  let direction = 1;

  for (let index = 0; index < points.length; index += 1) {
    const atrValue = atrValues[index];

    if (typeof atrValue !== 'number') {
      continue;
    }

    const hl2 = (points[index].high + points[index].low) / 2;
    const basicUpper = hl2 + multiplier * atrValue;
    const basicLower = hl2 - multiplier * atrValue;

    if (index === period - 1) {
      finalUpper = basicUpper;
      finalLower = basicLower;
      result[index] = [finalLower, direction];
      continue;
    }

    const previousClose = points[index - 1].close;
    finalUpper = basicUpper < finalUpper || previousClose > finalUpper ? basicUpper : finalUpper;
    finalLower = basicLower > finalLower || previousClose < finalLower ? basicLower : finalLower;

    if (direction < 0 && points[index].close > finalUpper) {
      direction = 1;
    } else if (direction > 0 && points[index].close < finalLower) {
      direction = -1;
    }

    result[index] = [direction > 0 ? finalLower : finalUpper, direction];
  }

  return result;
}

function wilderAverage(values: number[], period: number) {
  const result: Array<number | undefined> = Array.from({ length: values.length });

  if (values.length < period) {
    return result;
  }

  let average = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = average;

  for (let index = period; index < values.length; index += 1) {
    average = (average * (period - 1) + values[index]) / period;
    result[index] = average;
  }

  return result;
}

async function loadPreviewDataset(request: KlineRequest): Promise<ChartDatasetExport | null> {
  const requestedRows = Math.max(request.limit ?? 0, readPerfRowsFromUrl());

  if (requestedRows < 100_000 || request.symbol.toUpperCase() !== 'BTCUSDT' || request.interval !== '1m') {
    return null;
  }

  const bucket = requestedRows >= 1_000_000 ? '1m' : '100k';
  const cacheKey = `${request.market}:${request.symbol.toUpperCase()}:${request.interval}:${bucket}`;
  const cached = previewDatasetCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const loader = fetch(`/performance/chart-dataset-${bucket}.json`)
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const dataset = (await response.json()) as ChartDatasetExport;

      if (
        dataset.market !== request.market ||
        dataset.symbol.toUpperCase() !== request.symbol.toUpperCase() ||
        dataset.interval !== request.interval
      ) {
        return null;
      }

      return dataset;
    })
    .catch(() => null);

  previewDatasetCache.set(cacheKey, loader);
  return loader;
}

function readPerfRowsFromUrl() {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Number(new URLSearchParams(window.location.search).get('perfRows')) || 0;
}

function createPreviewChartData(request: KlineRequest): ChartDataResponse {
  const intervalSeconds = intervalToSeconds(request.interval);
  const count = request.limit ?? 600;
  const now = Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
  const base = request.symbol.startsWith('BTC') ? 60_000 : 2_500;
  const points = Array.from({ length: count }, (_, index) => {
    const time = now - (count - index) * intervalSeconds;
    const drift = Math.sin(index / 17) * base * 0.012;
    const open = base + drift;
    const close = open + Math.cos(index / 11) * base * 0.003;
    const high = Math.max(open, close) + base * 0.002;
    const low = Math.min(open, close) - base * 0.002;

    return {
      time,
      open,
      high,
      low,
      close,
      volume: 100 + index,
    };
  });

  return {
    points,
    source: 'preview-generated',
    cached: false,
  };
}

function intervalToSeconds(interval: string) {
  const value = Number.parseInt(interval, 10);

  if (!Number.isFinite(value) || value <= 0) {
    return 300;
  }

  if (interval.endsWith('m')) {
    return value * 60;
  }

  if (interval.endsWith('h')) {
    return value * 60 * 60;
  }

  if (interval.endsWith('d')) {
    return value * 24 * 60 * 60;
  }

  if (interval.endsWith('w') || interval.endsWith('W')) {
    return value * 7 * 24 * 60 * 60;
  }

  if (interval.endsWith('M')) {
    return value * 30 * 24 * 60 * 60;
  }

  return 300;
}
