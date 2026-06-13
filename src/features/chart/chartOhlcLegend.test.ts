import type { KLineData } from 'klinecharts';
import { describe, expect, it } from 'vitest';
import { calculateOhlcAmplitude, resolveOhlcLegendCandle } from './chartOhlcLegend';

const data: KLineData[] = [
  { timestamp: 1, open: 10, high: 12, low: 9, close: 11 },
  { timestamp: 2, open: 11, high: 15, low: 10, close: 14 },
];

describe('chart OHLC legend helpers', () => {
  it('calculates amplitude as high-low over low', () => {
    expect(calculateOhlcAmplitude({ high: 15, low: 10 })).toBe(50);
  });

  it('guards invalid lows', () => {
    expect(calculateOhlcAmplitude({ high: 15, low: 0 })).toBeNull();
  });

  it('uses latest candle by default and hovered candle when supplied', () => {
    expect(resolveOhlcLegendCandle(data, null).candle?.timestamp).toBe(2);
    expect(resolveOhlcLegendCandle(data, data[0]).candle?.timestamp).toBe(1);
  });
});
