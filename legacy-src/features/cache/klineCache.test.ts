import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import type { Kline } from '../../types/domain';
import { IndexedDbKlineCache } from './klineCache';

function createKline(openTime: number, close = '1'): Kline {
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
    source: 'rest',
    updatedAt: 1,
  };
}

describe('IndexedDbKlineCache', () => {
  const cache = new IndexedDbKlineCache();

  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('writes and reads K-lines by market, symbol, interval and range', async () => {
    await cache.writeKlines(
      { market: 'usdM', symbol: 'btcusdt', interval: '1m' },
      [createKline(60_000), createKline(0), createKline(120_000)],
    );

    const rows = await cache.readKlines({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      startTime: 0,
      endTime: 60_000,
    });

    expect(rows.map((row) => row.openTime)).toEqual([0, 60_000]);
    expect(rows[0].symbol).toBe('BTCUSDT');
  });

  it('upserts duplicate K-lines instead of storing duplicates', async () => {
    await cache.writeKlines({ market: 'usdM', symbol: 'BTCUSDT', interval: '1m' }, [createKline(0, '1')]);
    await cache.writeKlines({ market: 'usdM', symbol: 'BTCUSDT', interval: '1m' }, [createKline(0, '2')]);

    const rows = await cache.readKlines({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      startTime: 0,
      endTime: 0,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].close).toBe('2');
  });

  it('merges stored ranges and detects missing ranges', async () => {
    await cache.writeKlines({ market: 'usdM', symbol: 'BTCUSDT', interval: '1m' }, [createKline(0), createKline(60_000)]);
    await cache.writeKlines({ market: 'usdM', symbol: 'BTCUSDT', interval: '1m' }, [createKline(180_000)]);

    const missing = await cache.findMissingRanges({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      startTime: 0,
      endTime: 180_000,
    });

    expect(missing).toEqual([{ startTime: 120_000, endTime: 179_999, reason: 'between-ranges' }]);
  });

  it('calculates cache completeness', async () => {
    await cache.writeKlines({ market: 'usdM', symbol: 'BTCUSDT', interval: '1m' }, [createKline(0), createKline(60_000)]);

    const completeness = await cache.calculateCompleteness({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      startTime: 0,
      endTime: 60_000,
    });

    expect(completeness.complete).toBe(true);
    expect(completeness.ratio).toBe(1);
  });
});
