import { describe, expect, it } from 'vitest';
import { getKlineStreamUrl, normalizeKlineStreamPayload } from './wsKline';

describe('Binance K-line WebSocket helpers', () => {
  it('builds Spot and USD-M stream URLs', () => {
    expect(getKlineStreamUrl('spot', 'BTCUSDT', '5m')).toBe(
      'wss://stream.binance.com:9443/ws/btcusdt@kline_5m',
    );
    expect(getKlineStreamUrl('usdM', 'BTCUSDT', '1h')).toBe(
      'wss://fstream.binance.com/ws/btcusdt@kline_1h',
    );
  });

  it('normalizes K-line stream payloads to KLineCharts data', () => {
    expect(
      normalizeKlineStreamPayload({
        e: 'kline',
        E: 1710000000000,
        s: 'BTCUSDT',
        k: {
          t: 1710000000000,
          T: 1710000059999,
          s: 'BTCUSDT',
          i: '1m',
          o: '100.5',
          c: '101.25',
          h: '102.0',
          l: '99.5',
          v: '12.5',
          n: 42,
          x: false,
          q: '1265.625',
          V: '5',
          Q: '505',
        },
      }),
    ).toEqual({
      timestamp: 1710000000000,
      open: 100.5,
      high: 102,
      low: 99.5,
      close: 101.25,
      volume: 12.5,
      turnover: 1265.625,
    });
  });
});
