import type { KLineData } from 'klinecharts';
import { indexedDbKlineCache } from '../cache';
import { fetchRecentPublicDataKlines } from '../market-data/binance/publicDataKlines';
import { MarketDataProviderChain } from '../market-data';
import type { Interval, Kline, MarketType } from '../../types/domain';
import { toKLineChartData } from './klineChartAdapter';
import { getFixedIntervalMs } from '../market-data/intervals';
import { getIntervalCoverageEnd } from '../cache/ranges';

const provider = new MarketDataProviderChain();
const fallbackBarCount = 600;
const historicalPageSize = 1_000;
const restInitialPageLimitByMarket: Record<MarketType, number> = {
  spot: 1_000,
  usdM: 1_500,
};
const chartPublicDataTimeoutMs = 10_000;

export interface ChartKlineLoadResult {
  data: KLineData[];
  source: 'cache' | 'binance-rest' | 'binance-public-data' | 'mixed' | 'fallback';
  diagnostics: {
    staleGapFilled: boolean;
    fallbackUsed: boolean;
    providerErrors: string[];
  };
}

function createEmptyDiagnostics(): ChartKlineLoadResult['diagnostics'] {
  return {
    staleGapFilled: false,
    fallbackUsed: false,
    providerErrors: [],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function toChartResult(
  klines: Kline[],
  source: ChartKlineLoadResult['source'],
  diagnostics: ChartKlineLoadResult['diagnostics'] = createEmptyDiagnostics(),
): ChartKlineLoadResult {
  return {
    data: klines.map(toKLineChartData),
    source,
    diagnostics,
  };
}

function mergeKlines(rows: Kline[]): Kline[] {
  return Array.from(new Map(rows.sort((a, b) => a.openTime - b.openTime).map((row) => [row.openTime, row])).values());
}

function createFallbackKlines(market: MarketType, symbol: string, interval: Interval, now = Date.now()): Kline[] {
  const intervalMs = getFixedIntervalMs(interval) ?? 24 * 60 * 60 * 1000;
  const lastOpenTime = Math.floor(now / intervalMs) * intervalMs - intervalMs;
  const basePrice = symbol.toUpperCase().startsWith('BTC') ? 60_000 : 1_000;

  return Array.from({ length: fallbackBarCount }, (_, index) => {
    const openTime = lastOpenTime - (fallbackBarCount - index - 1) * intervalMs;
    const drift = Math.sin(index / 18) * basePrice * 0.01;
    const open = basePrice + drift;
    const close = open + Math.cos(index / 11) * basePrice * 0.003;
    const high = Math.max(open, close) + basePrice * 0.0025;
    const low = Math.min(open, close) - basePrice * 0.0025;

    return {
      schemaVersion: 1,
      market,
      symbol: symbol.toUpperCase(),
      interval,
      openTime,
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: String(100 + index),
      closeTime: getIntervalCoverageEnd(openTime, interval),
      quoteVolume: String((100 + index) * close),
      tradeCount: 0,
      takerBuyBaseVolume: '0',
      takerBuyQuoteVolume: '0',
      isClosed: true,
      source: 'fallback',
      updatedAt: now,
    };
  });
}

function getRecentGapStart(rows: Kline[], interval: Interval, now = Date.now()): number | null {
  const lastRow = rows.at(-1);

  if (!lastRow) {
    return null;
  }

  const intervalMs = getFixedIntervalMs(interval);
  const coverageEnd = getIntervalCoverageEnd(lastRow.openTime, interval, lastRow.closeTime);
  const toleratedLag = intervalMs === null ? 24 * 60 * 60 * 1000 : intervalMs * 2;

  if (now - coverageEnd <= toleratedLag) {
    return null;
  }

  return coverageEnd + 1;
}

async function loadFromCache(
  market: MarketType,
  symbol: string,
  interval: Interval,
): Promise<{ rows: Kline[]; result: ChartKlineLoadResult } | null> {
  const now = Date.now();
  const rows = await indexedDbKlineCache.readKlines({
    market,
    symbol,
    interval,
    startTime: 0,
    endTime: now,
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    rows,
    result: toChartResult(rows, 'cache'),
  };
}

async function loadFromDirectRest(
  market: MarketType,
  symbol: string,
  interval: Interval,
  startTime?: number,
): Promise<ChartKlineLoadResult> {
  const result = await provider.getKlinesWithSource({
    market,
    symbol,
    interval,
    startTime,
    endTime: Date.now(),
    limit: restInitialPageLimitByMarket[market],
  });

  await indexedDbKlineCache.writeKlines(
    { market, symbol, interval },
    result.klines,
    result.source === 'binance-public-data' ? 'public-data' : 'rest',
  );

  return toChartResult(result.klines, result.source);
}

async function loadFromPublicData(
  market: MarketType,
  symbol: string,
  interval: Interval,
): Promise<ChartKlineLoadResult> {
  const klines = await fetchRecentPublicDataKlines(market, symbol, interval);

  await indexedDbKlineCache.writeKlines({ market, symbol, interval }, klines, 'public-data');

  return toChartResult(klines, 'binance-public-data');
}

async function fillRecentGap(
  market: MarketType,
  symbol: string,
  interval: Interval,
  baseRows: Kline[],
  baseSource: ChartKlineLoadResult['source'],
  diagnostics: ChartKlineLoadResult['diagnostics'],
): Promise<ChartKlineLoadResult | null> {
  const gapStart = getRecentGapStart(baseRows, interval);

  if (gapStart === null) {
    return toChartResult(baseRows, baseSource, diagnostics);
  }

  try {
    const recentResult = await provider.getKlinesWithSource(
      {
        market,
        symbol,
        interval,
        startTime: gapStart,
        endTime: Date.now(),
        limit: restInitialPageLimitByMarket[market],
      },
      { allowPublicData: false },
    );
    const recentRows = recentResult.klines;

    if (recentRows.length === 0) {
      return toChartResult(baseRows, baseSource, diagnostics);
    }

    await indexedDbKlineCache.writeKlines(
      { market, symbol, interval },
      recentRows,
      recentResult.source === 'binance-public-data' ? 'public-data' : 'rest',
    );

    return toChartResult(
      mergeKlines([...baseRows, ...recentRows]),
      baseSource === recentResult.source ? baseSource : 'mixed',
      {
        ...diagnostics,
        staleGapFilled: true,
      },
    );
  } catch (error) {
    diagnostics.providerErrors.push(error instanceof Error ? error.message : 'Recent K-line backfill failed.');
    return null;
  }
}

export async function loadChartKlines(
  market: MarketType,
  symbol: string,
  interval: Interval,
): Promise<ChartKlineLoadResult> {
  const diagnostics = createEmptyDiagnostics();
  const cached = await loadFromCache(market, symbol, interval);

  if (cached) {
    const repaired = await fillRecentGap(market, symbol, interval, cached.rows, 'cache', diagnostics);

    if (repaired) {
      return repaired;
    }
  }

  try {
    const direct = await loadFromDirectRest(market, symbol, interval);

    if (direct.data.length > 0) {
      return direct;
    }
  } catch (error) {
    diagnostics.providerErrors.push(error instanceof Error ? error.message : 'Direct K-line request failed.');
  }

  try {
    const publicData = await withTimeout(
      loadFromPublicData(market, symbol, interval),
      chartPublicDataTimeoutMs,
      'Binance Public Data chart fallback',
    );
    const publicDataRows = await indexedDbKlineCache.readKlines({
      market,
      symbol,
      interval,
      startTime: 0,
      endTime: Date.now(),
    });
    const repaired = await fillRecentGap(market, symbol, interval, publicDataRows, 'binance-public-data', {
      ...diagnostics,
      fallbackUsed: true,
    });

    if (repaired && repaired.data.length > 0) {
      return repaired;
    }

    if (publicData.data.length > 0) {
      return {
        ...publicData,
        diagnostics: {
          ...diagnostics,
          fallbackUsed: true,
        },
      };
    }
  } catch (error) {
    diagnostics.providerErrors.push(error instanceof Error ? error.message : 'Public Data K-line request failed.');
  }

  return toChartResult(createFallbackKlines(market, symbol, interval), 'fallback', {
    ...diagnostics,
    fallbackUsed: true,
  });
}

export async function loadEarlierChartKlines(
  market: MarketType,
  symbol: string,
  interval: Interval,
  beforeOpenTime: number | null,
): Promise<ChartKlineLoadResult> {
  const diagnostics = createEmptyDiagnostics();

  if (beforeOpenTime === null || beforeOpenTime <= 0) {
    return toChartResult([], 'cache', diagnostics);
  }

  const cachedRows = await indexedDbKlineCache.readKlinesBefore({
    market,
    symbol,
    interval,
    beforeOpenTime,
    limit: historicalPageSize,
  });

  if (cachedRows.length > 0) {
    const earliestCachedOpenTime = cachedRows[0].openTime;

    if (cachedRows.length >= historicalPageSize || earliestCachedOpenTime <= 0) {
      return toChartResult(cachedRows, 'cache', diagnostics);
    }
  }

  try {
    const directResult = await provider.getKlinesWithSource(
      {
        market,
        symbol,
        interval,
        endTime: beforeOpenTime - 1,
        limit: restInitialPageLimitByMarket[market],
      },
      { allowPublicData: false },
    );
    const directRows = directResult.klines;

    if (directRows.length > 0) {
      await indexedDbKlineCache.writeKlines(
        { market, symbol, interval },
        directRows,
        directResult.source === 'binance-public-data' ? 'public-data' : 'rest',
      );

      const mergedRows = mergeKlines([...directRows, ...cachedRows]).filter((row) => row.openTime < beforeOpenTime);

      return toChartResult(mergedRows, cachedRows.length > 0 ? 'mixed' : directResult.source, diagnostics);
    }
  } catch (error) {
    diagnostics.providerErrors.push(error instanceof Error ? error.message : 'Earlier K-line request failed.');
  }

  if (cachedRows.length > 0) {
    return toChartResult(cachedRows, 'cache', diagnostics);
  }

  return toChartResult([], 'binance-rest', diagnostics);
}
