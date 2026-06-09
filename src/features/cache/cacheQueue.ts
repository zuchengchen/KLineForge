import type { CacheTaskRecord } from '../../persistence/database';
import { database } from '../../persistence/database';
import { supportedIntervals, type Interval, type MarketType } from '../../types/domain';
import { fetchRecentPublicDataKlines } from '../market-data/binance/publicDataKlines';
import { getFixedIntervalMs } from '../market-data/intervals';
import { indexedDbKlineCache } from './klineCache';
import { getIntervalCoverageEnd } from './ranges';

const maxConcurrentJobs = 2;
const unsupportedPublicDataIntervals = new Set<Interval>(['3d', '1w', '1M']);

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function createTaskId(market: MarketType, symbol: string, interval: Interval): string {
  return `${market}:${normalizeSymbol(symbol)}:${interval}`;
}

function createTask(market: MarketType, symbol: string, interval: Interval, priority: number): CacheTaskRecord {
  const now = Date.now();
  const targetEndTime = now;
  const targetStartTime = createDefaultTargetStartTime(interval, targetEndTime);

  return {
    id: createTaskId(market, symbol, interval),
    schemaVersion: 1,
    market,
    symbol: normalizeSymbol(symbol),
    interval,
    status: 'not-started',
    priority,
    progress: 0,
    retryCount: 0,
    targetStartTime,
    targetEndTime,
    createdAt: now,
    updatedAt: now,
  };
}

function createDefaultTargetStartTime(interval: Interval, now: number): number {
  const intervalMs = getFixedIntervalMs(interval);

  if (intervalMs === null) {
    return now - 90 * 24 * 60 * 60 * 1000;
  }

  return Math.max(0, now - Math.max(intervalMs * 1_000, 90 * 24 * 60 * 60 * 1000));
}

export async function ensureCacheTasksForSymbol(
  market: MarketType,
  symbol: string,
  priorityIntervals: Interval[] = [],
): Promise<CacheTaskRecord[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const prioritySet = new Set(priorityIntervals);
  const tasks = supportedIntervals.map((interval, index) =>
    createTask(market, normalizedSymbol, interval, prioritySet.has(interval) ? index : index + 100),
  );

  await database.cacheTasks.bulkPut(
    await Promise.all(
      tasks.map(async (task) => {
        const existing = await database.cacheTasks.get(task.id);

        if (existing && existing.status !== 'failed') {
          return {
            ...existing,
            priority: task.priority,
            updatedAt: Date.now(),
          };
        }

        return task;
      }),
    ),
  );

  return getCacheTasks(market, normalizedSymbol);
}

export async function getCacheTasks(market?: MarketType, symbol?: string): Promise<CacheTaskRecord[]> {
  if (market && symbol) {
    return database.cacheTasks
      .where('[market+symbol+interval]')
      .between([market, normalizeSymbol(symbol), ''], [market, normalizeSymbol(symbol), '\uffff'])
      .sortBy('priority');
  }

  return database.cacheTasks.orderBy('priority').toArray();
}

export async function pauseCacheTask(id: string): Promise<void> {
  await database.cacheTasks.update(id, { status: 'paused', updatedAt: Date.now() });
}

export async function resumeCacheTask(id: string): Promise<void> {
  await database.cacheTasks.where('id').equals(id).modify((task) => {
    task.status = 'not-started';
    task.updatedAt = Date.now();
    delete task.error;
  });
}

export async function retryCacheTask(id: string): Promise<void> {
  await database.cacheTasks.where('id').equals(id).modify((task) => {
    task.status = 'not-started';
    task.progress = 0;
    task.updatedAt = Date.now();
    delete task.error;
  });
}

export async function deleteCacheTaskAndInterval(id: string): Promise<void> {
  const task = await database.cacheTasks.get(id);

  if (!task) {
    return;
  }

  await indexedDbKlineCache.deleteIntervalCache(task);
  await database.cacheTasks.delete(id);
}

export async function clearAllCacheTasksAndKlines(): Promise<void> {
  await indexedDbKlineCache.clearAllKlineCache();
  await database.cacheTasks.clear();
}

export class CacheQueueRunner {
  private running = false;

  private activeCount = 0;

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    await this.pump();
  }

  stop(): void {
    this.running = false;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  private async pump(): Promise<void> {
    if (!this.running) {
      return;
    }

    while (this.activeCount < maxConcurrentJobs) {
      const task = await database.cacheTasks
        .where('status')
        .equals('not-started')
        .sortBy('priority')
        .then((tasks) => tasks[0]);

      if (!task) {
        return;
      }

      this.activeCount += 1;
      void this.runTask(task).finally(() => {
        this.activeCount -= 1;
        void this.pump();
      });
    }
  }

  private async runTask(task: CacheTaskRecord): Promise<void> {
    const now = Date.now();
    const currentTask = await database.cacheTasks.get(task.id);

    if (!currentTask || currentTask.status !== 'not-started') {
      return;
    }

    if (unsupportedPublicDataIntervals.has(task.interval)) {
      await database.cacheTasks.update(task.id, {
        status: 'failed',
        progress: 0,
        error: 'Binance Public Data monthly archive is unavailable for this interval. REST backfill is required for complete coverage.',
        updatedAt: now,
      });
      return;
    }

    await database.cacheTasks.update(task.id, {
      status: 'caching',
      progress: 0.1,
      error: undefined,
      updatedAt: now,
    });

    try {
      const rows = await fetchRecentPublicDataKlines(task.market, task.symbol, task.interval, 2);

      if ((await database.cacheTasks.get(task.id))?.status === 'paused') {
        return;
      }

      await indexedDbKlineCache.writeKlines(task, rows, 'public-data');

      if ((await database.cacheTasks.get(task.id))?.status === 'paused') {
        return;
      }

      const targetStartTime = task.targetStartTime ?? createDefaultTargetStartTime(task.interval, now);
      const targetEndTime = task.targetEndTime ?? now;
      const completeness = await indexedDbKlineCache.calculateCompleteness({
        market: task.market,
        symbol: task.symbol,
        interval: task.interval,
        startTime: targetStartTime,
        endTime: targetEndTime,
      });
      const cachedStartTime = rows[0]?.openTime;
      const lastRow = rows.at(-1);
      const cachedEndTime =
        lastRow === undefined
          ? undefined
          : getIntervalCoverageEnd(lastRow.openTime, task.interval, lastRow.closeTime);

      await database.cacheTasks.update(task.id, {
        status: completeness.complete ? 'complete' : 'partial',
        progress: completeness.ratio,
        targetStartTime,
        targetEndTime,
        cachedStartTime,
        cachedEndTime,
        missingRangeCount: completeness.missingRanges.length,
        missingRanges: completeness.missingRanges.slice(0, 8),
        estimatedSizeBytes: rows.length * 180,
        updatedAt: Date.now(),
      });
    } catch (error) {
      if ((await database.cacheTasks.get(task.id))?.status === 'paused') {
        return;
      }

      const message = error instanceof Error ? error.message : 'Cache task failed.';
      await database.cacheTasks.update(task.id, {
        status: 'failed',
        progress: 0,
        retryCount: task.retryCount + 1,
        error: message,
        updatedAt: Date.now(),
      });
    }
  }
}

export const cacheQueueRunner = new CacheQueueRunner();
