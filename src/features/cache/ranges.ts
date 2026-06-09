import type { Interval, MarketType } from '../../types/domain';
import { getFixedIntervalMs } from '../market-data/intervals';

export interface TimeRange {
  startTime: number;
  endTime: number;
}

export interface CacheRange extends TimeRange {
  market: MarketType;
  symbol: string;
  interval: Interval;
  status: 'complete' | 'partial';
}

export interface MissingRange extends TimeRange {
  reason: 'before-first-range' | 'between-ranges' | 'after-last-range' | 'no-coverage';
}

export interface CacheCompleteness {
  complete: boolean;
  coveredMs: number;
  requestedMs: number;
  ratio: number;
  missingRanges: MissingRange[];
}

function normalizeRange(range: TimeRange): TimeRange {
  if (!Number.isFinite(range.startTime) || !Number.isFinite(range.endTime)) {
    throw new Error('Range boundaries must be finite timestamps');
  }

  if (range.endTime < range.startTime) {
    throw new Error('Range endTime must be greater than or equal to startTime');
  }

  return range;
}

export function getIntervalCoverageEnd(openTime: number, interval: Interval, closeTime?: number): number {
  if (Number.isFinite(closeTime) && closeTime !== undefined && closeTime >= openTime) {
    return closeTime;
  }

  const intervalMs = getFixedIntervalMs(interval);

  if (intervalMs === null) {
    return openTime;
  }

  return openTime + intervalMs - 1;
}

export function mergeCompleteRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges.map(normalizeRange).sort((a, b) => a.startTime - b.startTime);
  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const current = merged.at(-1);

    if (!current || range.startTime > current.endTime + 1) {
      merged.push({ ...range });
      continue;
    }

    current.endTime = Math.max(current.endTime, range.endTime);
  }

  return merged;
}

export function findMissingRanges(request: TimeRange, coverage: TimeRange[]): MissingRange[] {
  const normalizedRequest = normalizeRange(request);
  const merged = mergeCompleteRanges(coverage).filter(
    (range) => range.endTime >= normalizedRequest.startTime && range.startTime <= normalizedRequest.endTime,
  );

  if (merged.length === 0) {
    return [
      {
        ...normalizedRequest,
        reason: 'no-coverage',
      },
    ];
  }

  const missing: MissingRange[] = [];
  let cursor = normalizedRequest.startTime;

  for (const range of merged) {
    const clippedStart = Math.max(range.startTime, normalizedRequest.startTime);
    const clippedEnd = Math.min(range.endTime, normalizedRequest.endTime);

    if (cursor < clippedStart) {
      missing.push({
        startTime: cursor,
        endTime: clippedStart - 1,
        reason: cursor === normalizedRequest.startTime ? 'before-first-range' : 'between-ranges',
      });
    }

    cursor = Math.max(cursor, clippedEnd + 1);
  }

  if (cursor <= normalizedRequest.endTime) {
    missing.push({
      startTime: cursor,
      endTime: normalizedRequest.endTime,
      reason: 'after-last-range',
    });
  }

  return missing;
}

export function calculateCompleteness(request: TimeRange, coverage: TimeRange[]): CacheCompleteness {
  const normalizedRequest = normalizeRange(request);
  const missingRanges = findMissingRanges(normalizedRequest, coverage);
  const requestedMs = normalizedRequest.endTime - normalizedRequest.startTime + 1;
  const missingMs = missingRanges.reduce((total, range) => total + range.endTime - range.startTime + 1, 0);
  const coveredMs = Math.max(0, requestedMs - missingMs);

  return {
    complete: missingRanges.length === 0,
    coveredMs,
    requestedMs,
    ratio: requestedMs === 0 ? 1 : coveredMs / requestedMs,
    missingRanges,
  };
}

export function expectedAdjacentOpenTime(openTime: number, interval: Interval): number | null {
  const intervalMs = getFixedIntervalMs(interval);

  if (intervalMs === null) {
    return null;
  }

  return openTime + intervalMs;
}
