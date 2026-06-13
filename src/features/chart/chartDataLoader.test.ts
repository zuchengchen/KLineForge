import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database } from '../../persistence/database';
import type { Kline } from '../../types/domain';
import { indexedDbKlineCache } from '../cache';
import { loadChartKlines, loadEarlierChartKlines } from './chartDataLoader';

const mocks = vi.hoisted(() => ({
  getKlinesWithSource: vi.fn(),
  fetchRecentPublicDataKlines: vi.fn(),
}));

vi.mock('../market-data', async () => {
  const actual = await vi.importActual<typeof import('../market-data')>('../market-data');

  return {
    ...actual,
    MarketDataProviderChain: vi.fn(function MarketDataProviderChainMock() {
      return {
        getKlinesWithSource: mocks.getKlinesWithSource,
      };
    }),
  };
});

vi.mock('../market-data/binance/publicDataKlines', async () => {
  const actual = await vi.importActual<typeof import('../market-data/binance/publicDataKlines')>(
    '../market-data/binance/publicDataKlines',
  );

  return {
    ...actual,
    fetchRecentPublicDataKlines: mocks.fetchRecentPublicDataKlines,
  };
});

function createKline(openTime: number, close = '1', source: Kline['source'] = 'rest'): Kline {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: 'BTCUSDT',
    interval: '1m',
    openTime,
    open: '1',
    high: '2',
    low: '0.5',
    close,
    volume: '10',
    closeTime: openTime + 59_999,
    quoteVolume: '10',
    tradeCount: 1,
    takerBuyBaseVolume: '5',
    takerBuyQuoteVolume: '5',
    isClosed: true,
    source,
    updatedAt: 1,
  };
}

function createKlines(count: number, firstOpenTime: number, source: Kline['source'] = 'rest'): Kline[] {
  return Array.from({ length: count }, (_, index) =>
    createKline(firstOpenTime + index * 60_000, String(index + 1), source),
  );
}

describe('chart data loader', () => {
  const fixedNow = Date.parse('2026-06-09T00:10:00.000Z');

  beforeEach(async () => {
    vi.useRealTimers();
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    mocks.getKlinesWithSource.mockReset();
    mocks.fetchRecentPublicDataKlines.mockReset();
    await database.delete();
    await database.open();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fills a recent gap after stale cached data', async () => {
    await indexedDbKlineCache.writeKlines(
      { market: 'usdM', symbol: 'BTCUSDT', interval: '1m' },
      [createKline(Date.now() - 10 * 60_000)],
    );
    mocks.getKlinesWithSource.mockResolvedValue({
      source: 'binance-rest',
      klines: [createKline(Date.now() - 60_000, '2')],
    });

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.source).toBe('mixed');
    expect(result.diagnostics.staleGapFilled).toBe(true);
    expect(result.data.at(-1)?.close).toBe(2);
    expect(mocks.getKlinesWithSource.mock.calls[0][0].startTime).toBeGreaterThan(Date.now() - 10 * 60_000);
  });

  it('loads every cached row instead of truncating initial history', async () => {
    await indexedDbKlineCache.writeKlines(
      { market: 'usdM', symbol: 'BTCUSDT', interval: '1m' },
      createKlines(750, Date.now() - 750 * 60_000, 'cache'),
      'rest',
    );

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.source).toBe('cache');
    expect(result.data).toHaveLength(750);
    expect(result.data[0].timestamp).toBe(Date.now() - 750 * 60_000);
    expect(mocks.getKlinesWithSource).not.toHaveBeenCalled();
  });

  it('uses direct REST when no cache exists', async () => {
    mocks.getKlinesWithSource.mockResolvedValue({
      source: 'binance-rest',
      klines: [createKline(Date.now() - 60_000, '3')],
    });

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.source).toBe('binance-rest');
    expect(result.data).toHaveLength(1);
    expect(mocks.getKlinesWithSource.mock.calls[0][0]).toMatchObject({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 1500,
    });
    expect(mocks.fetchRecentPublicDataKlines).not.toHaveBeenCalled();
  });

  it('falls back to public data and then repairs the recent gap', async () => {
    const publicRows = createKlines(700, Date.now() - 30 * 24 * 60 * 60 * 1000, 'public-data');
    mocks.getKlinesWithSource
      .mockRejectedValueOnce(new Error('REST blocked'))
      .mockResolvedValueOnce({
        source: 'binance-rest',
        klines: [createKline(Date.now() - 60_000, '4')],
      });
    mocks.fetchRecentPublicDataKlines.mockResolvedValue(publicRows);

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.source).toBe('mixed');
    expect(result.data).toHaveLength(701);
    expect(result.diagnostics.fallbackUsed).toBe(true);
    expect(result.diagnostics.staleGapFilled).toBe(true);
  });

  it('loads an earlier history page from cache', async () => {
    const firstOpenTime = Date.now() - 1_200 * 60_000;
    const beforeOpenTime = firstOpenTime + 1_100 * 60_000;
    await indexedDbKlineCache.writeKlines(
      { market: 'usdM', symbol: 'BTCUSDT', interval: '1m' },
      createKlines(1_200, firstOpenTime, 'cache'),
      'rest',
    );

    const result = await loadEarlierChartKlines('usdM', 'BTCUSDT', '1m', beforeOpenTime);

    expect(result.source).toBe('cache');
    expect(result.data).toHaveLength(1_000);
    expect(result.data[0].timestamp).toBe(firstOpenTime + 100 * 60_000);
    expect(result.data.at(-1)?.timestamp).toBe(beforeOpenTime - 60_000);
    expect(mocks.getKlinesWithSource).not.toHaveBeenCalled();
  });

  it('loads an earlier history page from REST when cache has no older rows', async () => {
    const beforeOpenTime = Date.now() - 60_000;
    mocks.getKlinesWithSource.mockResolvedValue({
      source: 'binance-rest',
      klines: [createKline(beforeOpenTime - 120_000, '5'), createKline(beforeOpenTime - 60_000, '6')],
    });

    const result = await loadEarlierChartKlines('usdM', 'BTCUSDT', '1m', beforeOpenTime);

    expect(result.source).toBe('binance-rest');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].close).toBe(5);
    expect(mocks.getKlinesWithSource).toHaveBeenCalledWith(
      {
        market: 'usdM',
        symbol: 'BTCUSDT',
        interval: '1m',
        endTime: beforeOpenTime - 1,
        limit: 1500,
      },
      { allowPublicData: false },
    );
  });

  it('returns an empty result when REST returns no rows', async () => {
    mocks.getKlinesWithSource.mockResolvedValue({
      source: 'binance-rest',
      klines: [],
    });
    mocks.fetchRecentPublicDataKlines.mockResolvedValue([]);

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.data).toHaveLength(600);
    expect(result.source).toBe('fallback');
    expect(result.diagnostics.fallbackUsed).toBe(true);
  });

  it('uses fallback candles when REST and Public Data both fail', async () => {
    mocks.getKlinesWithSource.mockRejectedValue(new Error('REST blocked'));
    mocks.fetchRecentPublicDataKlines.mockRejectedValue(new Error('archive missing'));

    const result = await loadChartKlines('usdM', 'BTCUSDT', '1m');

    expect(result.source).toBe('fallback');
    expect(result.data.length).toBeGreaterThan(100);
    expect(result.diagnostics.providerErrors).toContain('REST blocked');
    expect(result.diagnostics.providerErrors).toContain('archive missing');
  });

  it('uses fallback candles when REST and Public Data requests time out', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'setTimeout');
    mocks.getKlinesWithSource.mockImplementation(() => new Promise(() => undefined));
    mocks.fetchRecentPublicDataKlines.mockImplementation(() => new Promise(() => undefined));

    const resultPromise = loadChartKlines('usdM', 'BTCUSDT', '1m');

    await vi.advanceTimersByTimeAsync(20_000);
    const result = await resultPromise;

    expect(result.source).toBe('fallback');
    expect(result.diagnostics.providerErrors).toEqual([
      'Direct K-line request timed out after 8000ms.',
      'Binance Public Data chart fallback timed out after 10000ms.',
    ]);
  });
});
