import type { KLineData } from 'klinecharts';
import { describe, expect, it } from 'vitest';
import { getIndicatorSourceValue } from './indicatorSources';

const row: KLineData = {
  timestamp: 1,
  open: 10,
  high: 16,
  low: 8,
  close: 12,
};

describe('indicator source values', () => {
  it('reads OHLC and derived sources', () => {
    expect(getIndicatorSourceValue(row, 'open')).toBe(10);
    expect(getIndicatorSourceValue(row, 'high')).toBe(16);
    expect(getIndicatorSourceValue(row, 'low')).toBe(8);
    expect(getIndicatorSourceValue(row, 'close')).toBe(12);
    expect(getIndicatorSourceValue(row, 'hl2')).toBe(12);
    expect(getIndicatorSourceValue(row, 'hlc3')).toBe(12);
    expect(getIndicatorSourceValue(row, 'ohlc4')).toBe(11.5);
  });
});
