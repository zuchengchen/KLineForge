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
  LiveKlineEvent,
  LiveStreamRequest,
  HealthStatus,
  IndicatorValue,
  KlineRequest,
  Leaderboards,
  Market,
  MarketInfoSnapshot,
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
    return previewSettings;
  }

  return invoke<AppSettings>('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (!isTauriRuntime) {
    previewSettings = {
      ...settings,
      indicators: normalizePreviewIndicatorSettings(settings.indicators),
    };

    return previewSettings;
  }

  return invoke<AppSettings>('save_settings', { settings });
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

export async function getIndicators(request: KlineRequest): Promise<IndicatorValue[]> {
  if (!isTauriRuntime) {
    const dataset = await loadPreviewDataset(request);

    if (dataset?.indicators?.length) {
      return dataset.indicators;
    }

    return [];
  }

  return invoke<IndicatorValue[]>('get_indicators', { request });
}

export async function getCacheSummary(): Promise<CacheSummary[]> {
  if (!isTauriRuntime) {
    return [];
  }

  return invoke<CacheSummary[]>('get_cache_summary');
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
      schemaVersion: 1,
      exportedAt: Date.now(),
      settings: await getSettings(),
      watchlist: await getWatchlist(previewSettings.market),
      drawings: previewDrawings,
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
    }>;

    if (config.settings) {
      previewSettings = {
        ...config.settings,
        indicators: normalizePreviewIndicatorSettings(config.settings.indicators),
      };
    }

    if (Array.isArray(config.watchlist)) {
      previewWatchlists[previewSettings.market] = config.watchlist.map((symbol) => symbol.toUpperCase());
    }

    if (Array.isArray(config.drawings)) {
      previewDrawings = config.drawings;
    }

    return {
      settingsImported: content.trim().length > 0,
      watchlistCount: config.watchlist?.length ?? 0,
      drawingCount: config.drawings?.length ?? 0,
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
let previewSettings: AppSettings = {
  market: 'usdM',
  symbol: 'BTCUSDT',
  leftInterval: '5m',
  rightInterval: '1h',
  theme: 'dark',
  language: 'zh',
  indicators: defaultIndicatorSettings(),
};
const previewWatchlists: Record<Market, string[]> = {
  spot: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  usdM: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
};
let previewDrawings: DrawingObject[] = [];

function defaultIndicatorSettings(): AppSettings['indicators'] {
  return {
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
}

function normalizePreviewIndicatorSettings(settings: Partial<AppSettings['indicators']> | undefined): AppSettings['indicators'] {
  return {
    volume: settings?.volume ?? true,
    ma: settings?.ma ?? true,
    ema: settings?.ema ?? true,
    boll: settings?.boll ?? true,
    macd: settings?.macd ?? true,
    rsi: settings?.rsi ?? true,
    atr: settings?.atr ?? true,
    kdj: settings?.kdj ?? true,
    supertrend: settings?.supertrend ?? true,
  };
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
