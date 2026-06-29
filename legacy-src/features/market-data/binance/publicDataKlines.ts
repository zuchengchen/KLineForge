import { unzipSync, strFromU8 } from 'fflate';
import type { Interval, Kline, MarketType } from '../../../types/domain';
import { binanceEndpoints } from './endpoints';
import { withFetchTimeout } from './http';
import { normalizeBinanceKline } from './normalizers';

const supportedPublicDataMarkets: Record<MarketType, string> = {
  spot: 'spot',
  usdM: 'futures/um',
};

type BinanceKlineCsvRow = Parameters<typeof normalizeBinanceKline>[3];

export interface PublicDataKlineRequest {
  market: MarketType;
  symbol: string;
  interval: Interval;
  year: number;
  month: number;
}

export function createMonthlyKlinePublicDataUrl(
  request: PublicDataKlineRequest,
  baseUrl = binanceEndpoints.publicDataBaseUrl,
): URL {
  const symbol = request.symbol.toUpperCase();
  const month = String(request.month).padStart(2, '0');
  const marketPath = supportedPublicDataMarkets[request.market];
  const fileName = `${symbol}-${request.interval}-${request.year}-${month}.zip`;

  return new URL(
    `/data/${marketPath}/monthly/klines/${symbol}/${request.interval}/${fileName}`,
    baseUrl,
  );
}

export function parseBinanceKlineCsv(
  csv: string,
  market: MarketType,
  symbol: string,
  interval: Interval,
  now = Date.now(),
): Kline[] {
  return csv
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0 && !line.startsWith('open_time'))
    .map((line) => {
      const columns = line.split(',');
      const row: BinanceKlineCsvRow = [
        Number(columns[0]),
        columns[1],
        columns[2],
        columns[3],
        columns[4],
        columns[5],
        Number(columns[6]),
        columns[7],
        Number(columns[8]),
        columns[9],
        columns[10],
        columns[11] ?? '0',
      ];

      return normalizeBinanceKline(market, symbol, interval, row, 'public-data', now);
    });
}

export function readFirstCsvFromZip(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const csvFileName = Object.keys(files).find((fileName) => fileName.endsWith('.csv')) ?? Object.keys(files)[0];

  if (!csvFileName) {
    throw new Error('Binance public data ZIP did not contain a CSV file.');
  }

  return strFromU8(files[csvFileName]);
}

export async function fetchMonthlyPublicDataKlines(
  request: PublicDataKlineRequest,
  fetcher: typeof fetch = fetch,
): Promise<Kline[]> {
  const url = createMonthlyKlinePublicDataUrl(request);
  const bytes = await withFetchTimeout(async (signal) => {
    const response = await fetcher(url.toString(), {
        signal,
      });

    if (!response.ok) {
      throw new Error(`Binance public data request failed ${response.status}: ${url.pathname}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }, `Binance public data ${url.pathname}`);
  const csv = readFirstCsvFromZip(bytes);

  return parseBinanceKlineCsv(csv, request.market, request.symbol, request.interval);
}

export async function fetchRecentPublicDataKlines(
  market: MarketType,
  symbol: string,
  interval: Interval,
  monthsToTry = 4,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<Kline[]> {
  const latestCompleteMonthlyArchive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  for (let index = 0; index < monthsToTry; index += 1) {
    const date = new Date(
      Date.UTC(
        latestCompleteMonthlyArchive.getUTCFullYear(),
        latestCompleteMonthlyArchive.getUTCMonth() - index,
        1,
      ),
    );
    const klines = await fetchMonthlyPublicDataKlines(
      {
        market,
        symbol,
        interval,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
      },
      fetcher,
    ).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('failed 404')) {
        return null;
      }

      throw error;
    });

    if (klines?.length) {
      return klines;
    }
  }

  throw new Error('No recent Binance public K-line archive was available for this symbol and interval.');
}
