import { describe, expect, it } from 'vitest';
import { getFixedIntervalMs, isSupportedInterval, parseInterval } from './intervals';

describe('interval validation', () => {
  it('accepts supported Binance MVP intervals', () => {
    expect(isSupportedInterval('1m')).toBe(true);
    expect(isSupportedInterval('1h')).toBe(true);
    expect(isSupportedInterval('1M')).toBe(true);
  });

  it('rejects unsupported intervals including 1s', () => {
    expect(isSupportedInterval('1s')).toBe(false);
    expect(() => parseInterval('1s')).toThrow('Unsupported interval');
  });

  it('returns fixed durations for fixed intervals and null for calendar month', () => {
    expect(getFixedIntervalMs('5m')).toBe(300_000);
    expect(getFixedIntervalMs('1M')).toBeNull();
  });
});
