import { supportedIntervals, type Interval } from '../../types/domain';

const intervalSet = new Set<string>(supportedIntervals);

const fixedIntervalMs: Partial<Record<Interval, number>> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
};

export function isSupportedInterval(value: string): value is Interval {
  return intervalSet.has(value);
}

export function parseInterval(value: string): Interval {
  if (!isSupportedInterval(value)) {
    throw new Error(`Unsupported interval: ${value}`);
  }

  return value;
}

export function getFixedIntervalMs(interval: Interval): number | null {
  return fixedIntervalMs[interval] ?? null;
}

export function alignTimestampToIntervalOpenTime(timestamp: number, interval: Interval): number {
  if (interval === '1w') {
    const date = new Date(timestamp);
    const day = date.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;

    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
  }

  const fixedDuration = getFixedIntervalMs(interval);

  if (fixedDuration) {
    return Math.floor(timestamp / fixedDuration) * fixedDuration;
  }

  const date = new Date(timestamp);

  if (interval === '1M') {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }

  return timestamp;
}
