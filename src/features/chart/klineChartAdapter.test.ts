import { describe, expect, it } from 'vitest';
import type { Kline } from '../../types/domain';
import { intervalToPeriod, toKLineChartData } from './klineChartAdapter';

const kline: Kline = {
  schemaVersion: 1,
  market: 'usdM',
  symbol: 'BTCUSDT',
  interval: '5m',
  openTime: 1710000000000,
  open: '100.5',
  high: '110.25',
  low: '99.75',
  close: '105.125',
  volume: '42.5',
  closeTime: 1710000299999,
  quoteVolume: '4467.8125',
  tradeCount: 10,
  takerBuyBaseVolume: '20',
  takerBuyQuoteVolume: '2100',
  isClosed: true,
  source: 'rest',
  updatedAt: 1,
};

describe('KLineCharts adapter', () => {
  it('converts internal K-lines to KLineCharts data', () => {
    expect(toKLineChartData(kline)).toEqual({
      timestamp: 1710000000000,
      open: 100.5,
      high: 110.25,
      low: 99.75,
      close: 105.125,
      volume: 42.5,
      turnover: 4467.8125,
    });
  });

  it('maps intervals to KLineCharts periods', () => {
    expect(intervalToPeriod('5m')).toEqual({ type: 'minute', span: 5 });
    expect(intervalToPeriod('1h')).toEqual({ type: 'hour', span: 1 });
    expect(intervalToPeriod('3d')).toEqual({ type: 'day', span: 3 });
    expect(intervalToPeriod('1w')).toEqual({ type: 'week', span: 1 });
    expect(intervalToPeriod('1M')).toEqual({ type: 'month', span: 1 });
  });
});
