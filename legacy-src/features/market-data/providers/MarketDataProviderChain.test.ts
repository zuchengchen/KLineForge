import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketDataProviderChain } from './MarketDataProviderChain';

const mocks = vi.hoisted(() => ({
  fetchRecentPublicDataKlines: vi.fn(),
}));

vi.mock('../binance/publicDataKlines', async () => {
  const actual = await vi.importActual<typeof import('../binance/publicDataKlines')>('../binance/publicDataKlines');

  return {
    ...actual,
    fetchRecentPublicDataKlines: mocks.fetchRecentPublicDataKlines,
  };
});

describe('MarketDataProviderChain', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.fetchRecentPublicDataKlines.mockReset();
  });

  it('tries direct browser USD-M REST before falling back', async () => {
    vi.stubGlobal('window', {});
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          symbol: 'BTCUSDT',
          lastPrice: '61000',
          priceChange: '1',
          priceChangePercent: '0.1',
          highPrice: '62000',
          lowPrice: '60000',
          volume: '100',
          quoteVolume: '6100000',
          openTime: 1,
          closeTime: 2,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new MarketDataProviderChain();

    const [ticker] = await provider.getTicker24h('usdM', ['BTCUSDT']);

    expect(ticker.symbol).toBe('BTCUSDT');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/fapi/v1/ticker/24hr?symbol=BTCUSDT'));
  });

  it('can disable Public Data for recent gap backfills', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('blocked', { status: 451 })));
    const provider = new MarketDataProviderChain();

    await expect(
      provider.getKlinesWithSource(
        {
          market: 'usdM',
          symbol: 'BTCUSDT',
          interval: '5m',
          startTime: 1,
          endTime: 2,
          limit: 10,
        },
        { allowPublicData: false },
      ),
    ).rejects.toThrow(/K-line request/);

    expect(mocks.fetchRecentPublicDataKlines).not.toHaveBeenCalled();
  });
});
