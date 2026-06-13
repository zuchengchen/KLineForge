import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '../../types/domain';
import { createLatestKlinePoller } from './latestKlinePoller';

function createKline(openTime: number, close = '1'): Kline {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: 'BTCUSDT',
    interval: '5m',
    openTime,
    open: '1',
    high: close,
    low: '0.5',
    close,
    volume: '10',
    closeTime: openTime + 299_999,
    quoteVolume: '15',
    tradeCount: 1,
    takerBuyBaseVolume: '5',
    takerBuyQuoteVolume: '7.5',
    isClosed: false,
    source: 'rest',
    updatedAt: 1,
  };
}

describe('latest K-line poller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls the latest two K-lines immediately and then every interval', async () => {
    vi.useFakeTimers();
    const onKline = vi.fn();
    const getKlines = vi
      .fn()
      .mockResolvedValueOnce([createKline(600_000, '2'), createKline(300_000, '1')])
      .mockResolvedValueOnce([createKline(600_000, '3'), createKline(900_000, '4')]);
    const poller = createLatestKlinePoller({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '5m',
      pollMs: 1_000,
      provider: { getKlines },
      onKline,
    });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(getKlines).toHaveBeenCalledWith({ market: 'usdM', symbol: 'BTCUSDT', interval: '5m', limit: 2 });
    expect(onKline.mock.calls.map(([kline]) => kline.openTime)).toEqual([300_000, 600_000]);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onKline.mock.calls.map(([kline]) => `${kline.openTime}:${kline.close}`)).toEqual([
      '300000:1',
      '600000:2',
      '600000:3',
      '900000:4',
    ]);

    poller.stop();
  });

  it('does not emit rows after it has stopped', async () => {
    vi.useFakeTimers();
    const onKline = vi.fn();
    let resolveRows: (rows: Kline[]) => void = () => {};
    const getKlines = vi.fn(
      () =>
        new Promise<Kline[]>((resolve) => {
          resolveRows = resolve;
        }),
    );
    const poller = createLatestKlinePoller({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '5m',
      provider: { getKlines },
      onKline,
    });

    poller.start();
    poller.stop();
    resolveRows([createKline(300_000)]);
    await vi.runAllTimersAsync();

    expect(onKline).not.toHaveBeenCalled();
  });
});
