import Dexie, { type Table } from 'dexie';
import type {
  ChartSettings,
  DrawingObject,
  IndicatorConfig,
  IndicatorTemplate,
  Interval,
  Kline,
  KlineSource,
  LastSessionState,
  MarketType,
} from '../types/domain';

export interface MetadataRecord {
  key: string;
  value: unknown;
  schemaVersion: 1;
  updatedAt: number;
}

export interface SettingsRecord {
  key: string;
  value: ChartSettings | LastSessionState;
  schemaVersion: 1;
  updatedAt: number;
}

export interface KlineRangeRecord {
  id: string;
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  interval: Interval;
  startTime: number;
  endTime: number;
  source: KlineSource | 'mixed';
  status: 'complete' | 'partial';
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistRecord {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CacheTaskRecord {
  id: string;
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  interval: Interval;
  status: 'not-started' | 'caching' | 'complete' | 'partial' | 'failed' | 'paused';
  priority: number;
  progress: number;
  retryCount: number;
  error?: string;
  targetStartTime?: number;
  targetEndTime?: number;
  cachedStartTime?: number;
  cachedEndTime?: number;
  missingRangeCount?: number;
  missingRanges?: Array<{
    startTime: number;
    endTime: number;
    reason: string;
  }>;
  estimatedSizeBytes?: number;
  createdAt: number;
  updatedAt: number;
}

export class KLineForgeDatabase extends Dexie {
  metadata!: Table<MetadataRecord, string>;

  klines!: Table<Kline, [MarketType, string, Interval, number]>;

  klineRanges!: Table<KlineRangeRecord, string>;

  settings!: Table<SettingsRecord, string>;

  watchlists!: Table<WatchlistRecord, [MarketType, string]>;

  cacheTasks!: Table<CacheTaskRecord, string>;

  drawings!: Table<DrawingObject, string>;

  indicatorConfigs!: Table<IndicatorConfig, string>;

  indicatorTemplates!: Table<IndicatorTemplate, string>;

  constructor() {
    super('klineforge');

    this.version(1).stores({
      metadata: 'key, updatedAt',
      symbols: '[market+symbol], market, symbol, [market+status]',
      klines:
        '[market+symbol+interval+openTime], [market+symbol+interval], [market+symbol+interval+openTime], updatedAt',
      klineRanges:
        'id, [market+symbol+interval], [market+symbol+interval+startTime], [market+symbol+interval+endTime]',
      cacheTasks: 'id, status, priority, [market+symbol], [market+symbol+interval]',
      watchlists: '[market+symbol], market, [market+sortOrder]',
      drawings:
        'id, [market+symbol+chartId+interval], [market+symbol+chartId+interval+updatedAt], visible, locked',
      settings: 'key, updatedAt',
    });

    this.version(2).stores({
      indicatorConfigs: 'id, [market+symbol+chartId+interval], [market+symbol], [chartId+interval], updatedAt',
    });

    this.version(3).stores({
      indicatorTemplates: 'id, indicatorName, [indicatorName+isDefault], updatedAt',
    });
  }
}

export const database = new KLineForgeDatabase();

export async function getSettingRecord<T extends ChartSettings | LastSessionState>(key: string): Promise<T | null> {
  const record = await database.settings.get(key);

  return (record?.value as T | undefined) ?? null;
}

export async function putSettingRecord(key: string, value: ChartSettings | LastSessionState): Promise<void> {
  await database.settings.put({
    key,
    value,
    schemaVersion: 1,
    updatedAt: Date.now(),
  });
}
