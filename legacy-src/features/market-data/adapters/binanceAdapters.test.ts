import { describe, expect, it, vi } from 'vitest';
import { BinanceSpotAdapter } from './BinanceSpotAdapter';
import { BinanceUsdMFuturesAdapter } from './BinanceUsdMFuturesAdapter';
import type { HttpClient } from '../types';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Binance adapters', () => {
  it('fetches and normalizes Spot K-lines', async () => {
    const httpClient = vi.fn<HttpClient>().mockResolvedValue(
      jsonResponse([
        [
          1710000000000,
          '1',
          '2',
          '0.5',
          '1.5',
          '10',
          1710000059999,
          '15',
          3,
          '5',
          '7.5',
          '0',
        ],
      ]),
    );
    const adapter = new BinanceSpotAdapter(httpClient, 'https://example.test');

    const klines = await adapter.getKlines({
      market: 'spot',
      symbol: 'btcusdt',
      interval: '1m',
      startTime: 1,
      endTime: 2,
      limit: 1000,
    });

    const requestedUrl = new URL(httpClient.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/api/v3/klines');
    expect(requestedUrl.searchParams.get('symbol')).toBe('BTCUSDT');
    expect(requestedUrl.searchParams.get('interval')).toBe('1m');
    expect(klines[0]).toMatchObject({
      market: 'spot',
      symbol: 'BTCUSDT',
      open: '1',
      close: '1.5',
      tradeCount: 3,
    });
  });

  it('fetches and normalizes USD-M Futures K-lines', async () => {
    const httpClient = vi.fn<HttpClient>().mockResolvedValue(
      jsonResponse([
        [
          1710000000000,
          '10',
          '20',
          '5',
          '15',
          '100',
          1710003599999,
          '1500',
          30,
          '50',
          '750',
          '0',
        ],
      ]),
    );
    const adapter = new BinanceUsdMFuturesAdapter(httpClient, 'https://example.test');

    const klines = await adapter.getKlines({
      market: 'usdM',
      symbol: 'ethusdt',
      interval: '1h',
      limit: 1500,
    });

    const requestedUrl = new URL(httpClient.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/fapi/v1/klines');
    expect(requestedUrl.searchParams.get('symbol')).toBe('ETHUSDT');
    expect(requestedUrl.searchParams.get('interval')).toBe('1h');
    expect(klines[0]).toMatchObject({
      market: 'usdM',
      symbol: 'ETHUSDT',
      open: '10',
      close: '15',
      tradeCount: 30,
    });
  });

  it('fetches Futures mark, index and funding info', async () => {
    const httpClient = vi.fn<HttpClient>().mockResolvedValue(
      jsonResponse({
        symbol: 'BTCUSDT',
        markPrice: '81001.00',
        indexPrice: '81000.00',
        lastFundingRate: '0.00010000',
        nextFundingTime: 1710000000000,
        time: 1709990000000,
      }),
    );
    const adapter = new BinanceUsdMFuturesAdapter(httpClient, 'https://example.test');

    const info = await adapter.getFuturesMarketInfo('btcusdt');

    const requestedUrl = new URL(httpClient.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/fapi/v1/premiumIndex');
    expect(requestedUrl.searchParams.get('symbol')).toBe('BTCUSDT');
    expect(info.fundingRate).toBe('0.00010000');
  });
});
