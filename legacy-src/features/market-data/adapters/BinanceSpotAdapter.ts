import { binanceEndpoints } from '../binance/endpoints';
import { appendDefinedParams, fetchJson } from '../binance/http';
import { normalizeBinanceKline, normalizeSpotSymbol, normalizeTicker24h } from '../binance/normalizers';
import type { ExchangeAdapter, HttpClient, KlineRequest } from '../types';
import type { Interval, Kline, SymbolInfo, Ticker24h } from '../../../types/domain';

interface ExchangeInfoPayload {
  symbols: Parameters<typeof normalizeSpotSymbol>[0][];
}

type KlinePayload = Parameters<typeof normalizeBinanceKline>[3][];
type TickerPayload = Parameters<typeof normalizeTicker24h>[1];

export class BinanceSpotAdapter implements ExchangeAdapter {
  market = 'spot' as const;

  constructor(
    private readonly httpClient: HttpClient = fetch,
    private readonly baseUrl: string = binanceEndpoints.spotRestBaseUrl,
  ) {}

  async getSymbols(): Promise<SymbolInfo[]> {
    const url = new URL('/api/v3/exchangeInfo', this.baseUrl);
    const payload = await fetchJson<ExchangeInfoPayload>(this.httpClient, url);

    return payload.symbols.map((symbol) => normalizeSpotSymbol(symbol));
  }

  async getKlines(request: KlineRequest): Promise<Kline[]> {
    const url = appendDefinedParams(new URL('/api/v3/klines', this.baseUrl), {
      symbol: request.symbol.toUpperCase(),
      interval: request.interval,
      startTime: request.startTime,
      endTime: request.endTime,
      limit: request.limit,
    });
    const payload = await fetchJson<KlinePayload>(this.httpClient, url);

    return payload.map((row) => normalizeBinanceKline('spot', request.symbol, request.interval, row));
  }

  async getTicker24h(symbols?: string[]): Promise<Ticker24h[]> {
    const url = new URL('/api/v3/ticker/24hr', this.baseUrl);

    if (symbols?.length === 1) {
      url.searchParams.set('symbol', symbols[0].toUpperCase());
      const payload = await fetchJson<TickerPayload>(this.httpClient, url);
      return [normalizeTicker24h('spot', payload)];
    }

    if (symbols?.length) {
      url.searchParams.set('symbols', JSON.stringify(symbols.map((symbol) => symbol.toUpperCase())));
    }

    const payload = await fetchJson<TickerPayload[]>(this.httpClient, url);
    return payload.map((ticker) => normalizeTicker24h('spot', ticker));
  }

  async findEarliestKlineOpenTime(symbol: string, interval: Interval): Promise<number | null> {
    const [first] = await this.getKlines({
      market: 'spot',
      symbol,
      interval,
      startTime: 0,
      limit: 1,
    });

    return first?.openTime ?? null;
  }
}
