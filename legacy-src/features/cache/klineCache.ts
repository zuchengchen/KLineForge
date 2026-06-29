import type { KlineRangeRecord } from '../../persistence/database';
import { database } from '../../persistence/database';
import type { Interval, Kline, MarketType } from '../../types/domain';
import {
  calculateCompleteness,
  findMissingRanges,
  getIntervalCoverageEnd,
  mergeCompleteRanges,
  type CacheCompleteness,
  type MissingRange,
} from './ranges';

export interface KlineCacheKey {
  market: MarketType;
  symbol: string;
  interval: Interval;
}

export type KlineCacheWriteSource = KlineRangeRecord['source'];

export interface KlineCacheRangeRequest extends KlineCacheKey {
  startTime: number;
  endTime: number;
}

export interface KlineCacheBeforeRequest extends KlineCacheKey {
  beforeOpenTime: number;
  limit: number;
}

const klineWriteChunkSize = 1_000;

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function createRangeId(key: KlineCacheKey, startTime: number, endTime: number): string {
  return `${key.market}:${normalizeSymbol(key.symbol)}:${key.interval}:${startTime}:${endTime}`;
}

function yieldToUserWork(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

export class IndexedDbKlineCache {
  async writeKlines(key: KlineCacheKey, klines: Kline[], source: KlineCacheWriteSource = 'rest'): Promise<void> {
    if (klines.length === 0) {
      return;
    }

    const normalizedKey = {
      ...key,
      symbol: normalizeSymbol(key.symbol),
    };

    const rows = klines
      .map((kline) => ({
        ...kline,
        market: normalizedKey.market,
        symbol: normalizedKey.symbol,
        interval: normalizedKey.interval,
      }))
      .sort((a, b) => a.openTime - b.openTime);

    const startTime = rows[0].openTime;
    const lastRow = rows.at(-1) ?? rows[0];
    const endTime = getIntervalCoverageEnd(lastRow.openTime, normalizedKey.interval, lastRow.closeTime);
    const now = Date.now();

    const range: KlineRangeRecord = {
      id: createRangeId(normalizedKey, startTime, endTime),
      schemaVersion: 1,
      market: normalizedKey.market,
      symbol: normalizedKey.symbol,
      interval: normalizedKey.interval,
      startTime,
      endTime,
      source,
      status: 'complete',
      createdAt: now,
      updatedAt: now,
    };

    for (let index = 0; index < rows.length; index += klineWriteChunkSize) {
      await database.klines.bulkPut(rows.slice(index, index + klineWriteChunkSize));
      await yieldToUserWork();
    }

    await database.transaction('rw', database.klineRanges, async () => {
      await database.klineRanges.put(range);
      await this.mergeStoredRanges(normalizedKey);
    });
  }

  async readKlines(request: KlineCacheRangeRequest): Promise<Kline[]> {
    const symbol = normalizeSymbol(request.symbol);

    return database.klines
      .where('[market+symbol+interval+openTime]')
      .between(
        [request.market, symbol, request.interval, request.startTime],
        [request.market, symbol, request.interval, request.endTime],
        true,
        true,
      )
      .sortBy('openTime');
  }

  async readKlinesBefore(request: KlineCacheBeforeRequest): Promise<Kline[]> {
    if (request.beforeOpenTime <= 0 || request.limit <= 0) {
      return [];
    }

    const symbol = normalizeSymbol(request.symbol);
    const rows = await database.klines
      .where('[market+symbol+interval+openTime]')
      .between(
        [request.market, symbol, request.interval, 0],
        [request.market, symbol, request.interval, request.beforeOpenTime - 1],
        true,
        true,
      )
      .reverse()
      .limit(request.limit)
      .toArray();

    return rows.reverse();
  }

  async getCoverage(key: KlineCacheKey): Promise<KlineRangeRecord[]> {
    return database.klineRanges
      .where('[market+symbol+interval]')
      .equals([key.market, normalizeSymbol(key.symbol), key.interval])
      .sortBy('startTime');
  }

  async findMissingRanges(request: KlineCacheRangeRequest): Promise<MissingRange[]> {
    const coverage = await this.getCoverage(request);

    return findMissingRanges(request, coverage.filter((range) => range.status === 'complete'));
  }

  async calculateCompleteness(request: KlineCacheRangeRequest): Promise<CacheCompleteness> {
    const coverage = await this.getCoverage(request);

    return calculateCompleteness(request, coverage.filter((range) => range.status === 'complete'));
  }

  async deleteIntervalCache(key: KlineCacheKey): Promise<void> {
    const normalizedKey = {
      ...key,
      symbol: normalizeSymbol(key.symbol),
    };

    await database.transaction('rw', database.klines, database.klineRanges, async () => {
      await database.klines
        .where('[market+symbol+interval]')
        .equals([normalizedKey.market, normalizedKey.symbol, normalizedKey.interval])
        .delete();
      await database.klineRanges
        .where('[market+symbol+interval]')
        .equals([normalizedKey.market, normalizedKey.symbol, normalizedKey.interval])
        .delete();
    });
  }

  async deleteSymbolCache(market: MarketType, symbol: string): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);

    await database.transaction('rw', database.klines, database.klineRanges, async () => {
      await database.klines
        .where('[market+symbol+interval]')
        .between([market, normalizedSymbol, ''], [market, normalizedSymbol, '\uffff'])
        .delete();
      await database.klineRanges
        .where('[market+symbol+interval]')
        .between([market, normalizedSymbol, ''], [market, normalizedSymbol, '\uffff'])
        .delete();
    });
  }

  async clearAllKlineCache(): Promise<void> {
    await database.transaction('rw', database.klines, database.klineRanges, async () => {
      await database.klines.clear();
      await database.klineRanges.clear();
    });
  }

  private async mergeStoredRanges(key: KlineCacheKey): Promise<void> {
    const stored = await this.getCoverage(key);
    const completeRanges = stored.filter((range) => range.status === 'complete');
    const merged = mergeCompleteRanges(completeRanges);
    const now = Date.now();
    const sourceSet = new Set(completeRanges.map((range) => range.source));
    const mergedSource = sourceSet.size === 1 ? completeRanges[0]?.source ?? 'rest' : 'mixed';
    const mergedRecords: KlineRangeRecord[] = merged.map((range) => ({
      id: createRangeId(key, range.startTime, range.endTime),
      schemaVersion: 1,
      market: key.market,
      symbol: normalizeSymbol(key.symbol),
      interval: key.interval,
      startTime: range.startTime,
      endTime: range.endTime,
      source: mergedSource,
      status: 'complete',
      createdAt: now,
      updatedAt: now,
    }));

    await database.klineRanges.bulkDelete(stored.map((range) => range.id));
    await database.klineRanges.bulkPut(mergedRecords);
  }
}

export const indexedDbKlineCache = new IndexedDbKlineCache();
