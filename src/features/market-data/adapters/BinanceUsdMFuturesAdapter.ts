import { binanceEndpoints } from '../binance/endpoints';
import { appendDefinedParams, fetchJson } from '../binance/http';
import {
  normalizeBinanceKline,
  normalizeFuturesMarketInfo,
  normalizeFuturesSymbol,
  normalizeTicker24h,
} from '../binance/normalizers';
import type { ExchangeAdapter, FuturesInfoProvider, HttpClient, KlineRequest } from '../types';
import type { FuturesMarketInfo, Interval, Kline, SymbolInfo, Ticker24h } from '../../../types/domain';

interface ExchangeInfoPayload {
  symbols: Parameters<typeof normalizeFuturesSymbol>[0][];
}

type KlinePayload = Parameters<typeof normalizeBinanceKline>[3][];
type TickerPayload = Parameters<typeof normalizeTicker24h>[1];
type PremiumIndexPayload = Parameters<typeof normalizeFuturesMarketInfo>[0];

export class BinanceUsdMFuturesAdapter implements ExchangeAdapter, FuturesInfoProvider {
  market = 'usdM' as const;

  constructor(
    private readonly httpClient: HttpClient = fetch,
    private readonly baseUrl: string = binanceEndpoints.usdMRestBaseUrl,
  ) {}

  async getSymbols(): Promise<SymbolInfo[]> {
    const url = new URL('/fapi/v1/exchangeInfo', this.baseUrl);
    const payload = await fetchJson<ExchangeInfoPayload>(this.httpClient, url);

    return payload.symbols.map((symbol) => normalizeFuturesSymbol(symbol));
  }

  async getKlines(request: KlineRequest): Promise<Kline[]> {
    const url = appendDefinedParams(new URL('/fapi/v1/klines', this.baseUrl), {
      symbol: request.symbol.toUpperCase(),
      interval: request.interval,
      startTime: request.startTime,
      endTime: request.endTime,
      limit: request.limit,
    });
    const payload = await fetchJson<KlinePayload>(this.httpClient, url);

    return payload.map((row) => normalizeBinanceKline('usdM', request.symbol, request.interval, row));
  }

  async getTicker24h(symbols?: string[]): Promise<Ticker24h[]> {
    const url = new URL('/fapi/v1/ticker/24hr', this.baseUrl);

    if (symbols?.length === 1) {
      url.searchParams.set('symbol', symbols[0].toUpperCase());
      const payload = await fetchJson<TickerPayload>(this.httpClient, url);
      return [normalizeTicker24h('usdM', payload)];
    }

    const payload = await fetchJson<TickerPayload[]>(this.httpClient, url);
    const normalized = payload.map((ticker) => normalizeTicker24h('usdM', ticker));

    if (!symbols?.length) {
      return normalized;
    }

    const requested = new Set(symbols.map((symbol) => symbol.toUpperCase()));
    return normalized.filter((ticker) => requested.has(ticker.symbol));
  }

  async getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo> {
    const url = appendDefinedParams(new URL('/fapi/v1/premiumIndex', this.baseUrl), {
      symbol: symbol.toUpperCase(),
    });
    const payload = await fetchJson<PremiumIndexPayload>(this.httpClient, url);

    return normalizeFuturesMarketInfo(payload);
  }

  async findEarliestKlineOpenTime(symbol: string, interval: Interval): Promise<number | null> {
    const [first] = await this.getKlines({
      market: 'usdM',
      symbol,
      interval,
      startTime: 0,
      limit: 1,
    });

    return first?.openTime ?? null;
  }
}
