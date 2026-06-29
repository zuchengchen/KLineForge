import { describe, expect, it } from 'vitest';
import {
  calculateCompleteness,
  expectedAdjacentOpenTime,
  findMissingRanges,
  getIntervalCoverageEnd,
  mergeCompleteRanges,
} from './ranges';

describe('cache range helpers', () => {
  it('merges adjacent and overlapping ranges', () => {
    expect(
      mergeCompleteRanges([
        { startTime: 10, endTime: 20 },
        { startTime: 21, endTime: 30 },
        { startTime: 50, endTime: 60 },
        { startTime: 55, endTime: 70 },
      ]),
    ).toEqual([
      { startTime: 10, endTime: 30 },
      { startTime: 50, endTime: 70 },
    ]);
  });

  it('detects missing ranges around coverage holes', () => {
    expect(
      findMissingRanges(
        { startTime: 0, endTime: 100 },
        [
          { startTime: 10, endTime: 30 },
          { startTime: 50, endTime: 70 },
        ],
      ),
    ).toEqual([
      { startTime: 0, endTime: 9, reason: 'before-first-range' },
      { startTime: 31, endTime: 49, reason: 'between-ranges' },
      { startTime: 71, endTime: 100, reason: 'after-last-range' },
    ]);
  });

  it('reports complete coverage', () => {
    const completeness = calculateCompleteness(
      { startTime: 0, endTime: 99 },
      [{ startTime: 0, endTime: 99 }],
    );

    expect(completeness.complete).toBe(true);
    expect(completeness.ratio).toBe(1);
    expect(completeness.missingRanges).toEqual([]);
  });

  it('calculates partial coverage ratio', () => {
    const completeness = calculateCompleteness(
      { startTime: 0, endTime: 99 },
      [{ startTime: 0, endTime: 49 }],
    );

    expect(completeness.complete).toBe(false);
    expect(completeness.coveredMs).toBe(50);
    expect(completeness.requestedMs).toBe(100);
    expect(completeness.ratio).toBe(0.5);
  });

  it('returns fixed adjacent open time only for fixed intervals', () => {
    expect(expectedAdjacentOpenTime(1_000, '1m')).toBe(61_000);
    expect(expectedAdjacentOpenTime(1_000, '1M')).toBeNull();
  });

  it('derives coverage end from close time or interval duration', () => {
    expect(getIntervalCoverageEnd(60_000, '1m', 119_999)).toBe(119_999);
    expect(getIntervalCoverageEnd(60_000, '1m')).toBe(119_999);
    expect(getIntervalCoverageEnd(60_000, '1M')).toBe(60_000);
  });
});
