import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  createMonthlyKlinePublicDataUrl,
  fetchRecentPublicDataKlines,
  parseBinanceKlineCsv,
  readFirstCsvFromZip,
} from './publicDataKlines';

const csv = [
  'open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_buy_volume,taker_buy_quote_volume,ignore',
  '1777593600000,76305.40,76444.00,76265.40,76442.80,461.165,1777593899999,35217490.33720,11377,275.394,21031600.09810,0',
].join('\n');

describe('Binance public data K-lines', () => {
  it('builds monthly archive URLs for Spot and USD-M Futures', () => {
    expect(
      createMonthlyKlinePublicDataUrl({
        market: 'usdM',
        symbol: 'btcusdt',
        interval: '5m',
        year: 2026,
        month: 5,
      }).toString(),
    ).toBe(
      'https://data.binance.vision/data/futures/um/monthly/klines/BTCUSDT/5m/BTCUSDT-5m-2026-05.zip',
    );

    expect(
      createMonthlyKlinePublicDataUrl({
        market: 'spot',
        symbol: 'BTCUSDT',
        interval: '1h',
        year: 2026,
        month: 11,
      }).toString(),
    ).toBe(
      'https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2026-11.zip',
    );
  });

  it('parses Binance public CSV rows into internal K-lines', () => {
    const rows = parseBinanceKlineCsv(csv, 'usdM', 'btcusdt', '5m', 1);

    expect(rows).toEqual([
      {
        schemaVersion: 1,
        market: 'usdM',
        symbol: 'BTCUSDT',
        interval: '5m',
        openTime: 1777593600000,
        open: '76305.40',
        high: '76444.00',
        low: '76265.40',
        close: '76442.80',
        volume: '461.165',
        closeTime: 1777593899999,
        quoteVolume: '35217490.33720',
        tradeCount: 11377,
        takerBuyBaseVolume: '275.394',
        takerBuyQuoteVolume: '21031600.09810',
        isClosed: true,
        source: 'public-data',
        updatedAt: 1,
      },
    ]);
  });

  it('reads the first CSV file from a ZIP archive', () => {
    const zipped = zipSync({
      'BTCUSDT-5m-2026-05.csv': strToU8(csv),
    });

    expect(readFirstCsvFromZip(zipped)).toBe(csv);
  });

  it('starts recent archive probing from the previous complete month', async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      requestedUrls.push(String(input));

      return new Response(zipSync({ 'BTCUSDT-5m-2026-05.csv': strToU8(csv) }));
    };

    await fetchRecentPublicDataKlines(
      'usdM',
      'BTCUSDT',
      '5m',
      1,
      new Date(Date.UTC(2026, 5, 9)),
      fetcher,
    );

    expect(requestedUrls[0]).toBe(
      'https://data.binance.vision/data/futures/um/monthly/klines/BTCUSDT/5m/BTCUSDT-5m-2026-05.zip',
    );
  });
});
