import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import type { Kline } from '../../types/domain';
import { indexedDbKlineCache } from '../cache';
import { exportKlinesCsv } from './csvExport';

function createKline(openTime: number): Kline {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: 'BTCUSDT',
    interval: '1m',
    openTime,
    open: '1',
    high: '2',
    low: '0.5',
    close: '1.5',
    volume: '10',
    closeTime: openTime + 59_999,
    quoteVolume: '15',
    tradeCount: 3,
    takerBuyBaseVolume: '4',
    takerBuyQuoteVolume: '6',
    isClosed: true,
    source: 'cache',
    updatedAt: openTime,
  };
}

describe('CSV export', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('exports cached K-lines as CSV', async () => {
    await indexedDbKlineCache.writeKlines(
      { market: 'usdM', symbol: 'BTCUSDT', interval: '1m' },
      [createKline(0), createKline(60_000)],
    );

    const result = await exportKlinesCsv({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '1m',
      startTime: 0,
      endTime: 60_000,
    });

    expect(result.complete).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.csv.split('\n')[0]).toBe(
      'openTime,open,high,low,close,volume,closeTime,quoteVolume,tradeCount,takerBuyBaseVolume,takerBuyQuoteVolume,market,symbol,interval',
    );
    expect(result.csv).toContain('BTCUSDT');
  });
});
