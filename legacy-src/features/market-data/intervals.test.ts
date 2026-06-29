import { describe, expect, it } from 'vitest';
import { alignTimestampToIntervalOpenTime, getFixedIntervalMs, isSupportedInterval, parseInterval } from './intervals';

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

  it('aligns an intraperiod timestamp to the containing fixed interval open time', () => {
    const timestamp = Date.UTC(2026, 5, 10, 10, 25, 30);

    expect(alignTimestampToIntervalOpenTime(timestamp, '5m')).toBe(Date.UTC(2026, 5, 10, 10, 25));
    expect(alignTimestampToIntervalOpenTime(timestamp, '1h')).toBe(Date.UTC(2026, 5, 10, 10, 0));
    expect(alignTimestampToIntervalOpenTime(timestamp, '4h')).toBe(Date.UTC(2026, 5, 10, 8, 0));
  });

  it('aligns week interval timestamps to Monday 00:00 UTC', () => {
    expect(alignTimestampToIntervalOpenTime(Date.UTC(2026, 5, 10, 10, 25, 30), '1w')).toBe(
      Date.UTC(2026, 5, 8),
    );
    expect(alignTimestampToIntervalOpenTime(Date.UTC(2026, 5, 14, 23, 59, 59), '1w')).toBe(
      Date.UTC(2026, 5, 8),
    );
  });

  it('aligns month interval timestamps to the first UTC day of that month', () => {
    const timestamp = Date.UTC(2026, 5, 10, 10, 25, 30);

    expect(alignTimestampToIntervalOpenTime(timestamp, '1M')).toBe(Date.UTC(2026, 5, 1));
  });
});
