import { indexedDbKlineCache } from '../cache';
import type { Interval, Kline, MarketType } from '../../types/domain';

export interface CsvExportRequest {
  market: MarketType;
  symbol: string;
  interval: Interval;
  startTime: number;
  endTime: number;
}

export interface CsvExportResult {
  csv: string;
  complete: boolean;
  rowCount: number;
}

const csvHeaders = [
  'openTime',
  'open',
  'high',
  'low',
  'close',
  'volume',
  'closeTime',
  'quoteVolume',
  'tradeCount',
  'takerBuyBaseVolume',
  'takerBuyQuoteVolume',
  'market',
  'symbol',
  'interval',
];

function escapeCsv(value: string | number): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function klineToCsvRow(kline: Kline): string {
  return [
    kline.openTime,
    kline.open,
    kline.high,
    kline.low,
    kline.close,
    kline.volume,
    kline.closeTime,
    kline.quoteVolume,
    kline.tradeCount,
    kline.takerBuyBaseVolume,
    kline.takerBuyQuoteVolume,
    kline.market,
    kline.symbol,
    kline.interval,
  ]
    .map(escapeCsv)
    .join(',');
}

export async function exportKlinesCsv(request: CsvExportRequest): Promise<CsvExportResult> {
  const [klines, completeness] = await Promise.all([
    indexedDbKlineCache.readKlines(request),
    indexedDbKlineCache.calculateCompleteness(request),
  ]);
  const csv = [csvHeaders.join(','), ...klines.map(klineToCsvRow)].join('\n');

  return {
    csv,
    complete: completeness.complete,
    rowCount: klines.length,
  };
}
