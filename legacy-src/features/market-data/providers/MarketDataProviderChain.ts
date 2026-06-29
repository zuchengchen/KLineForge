import { BinanceSpotAdapter } from '../adapters/BinanceSpotAdapter';
import { BinanceUsdMFuturesAdapter } from '../adapters/BinanceUsdMFuturesAdapter';
import { createLiveKlineStream } from '../binance/liveKlineStream';
import { fetchRecentPublicDataKlines } from '../binance/publicDataKlines';
import type { KlineStream, KlineStreamRequest, MarketDataProvider } from '../types';
import type { FuturesMarketInfo, Kline, MarketType, SymbolInfo, Ticker24h } from '../../../types/domain';

export type KlineProviderSource = 'binance-rest' | 'binance-public-data';

export interface SourceAwareKlineResult {
  klines: Kline[];
  source: KlineProviderSource;
}

export interface KlineProviderChainOptions {
  allowPublicData?: boolean;
}

export interface ProviderAttemptError {
  provider: string;
  message: string;
}

export class MarketDataProviderChainError extends Error {
  constructor(
    operation: string,
    readonly attempts: ProviderAttemptError[],
  ) {
    super(`${operation} failed through all market data providers.`);
    this.name = 'MarketDataProviderChainError';
  }
}

function envValue(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? '';
}

function createProxyBaseUrl(market: MarketType): string | null {
  const specific = market === 'usdM' ? envValue('VITE_KLINEFORGE_USDM_PROXY_URL') : envValue('VITE_KLINEFORGE_SPOT_PROXY_URL');
  const generic = envValue('VITE_KLINEFORGE_PROXY_URL');

  return specific || generic || null;
}

function toAttemptError(provider: string, error: unknown): ProviderAttemptError {
  return {
    provider,
    message: error instanceof Error ? error.message : 'Unknown provider failure.',
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

export class MarketDataProviderChain implements MarketDataProvider {
  private readonly directProvider = new DirectProvider();

  private readonly spotProxyAdapter: BinanceSpotAdapter | null;

  private readonly usdMProxyAdapter: BinanceUsdMFuturesAdapter | null;

  constructor() {
    const spotProxyBaseUrl = createProxyBaseUrl('spot');
    const usdMProxyBaseUrl = createProxyBaseUrl('usdM');
    this.spotProxyAdapter = spotProxyBaseUrl ? new BinanceSpotAdapter(fetch, spotProxyBaseUrl) : null;
    this.usdMProxyAdapter = usdMProxyBaseUrl ? new BinanceUsdMFuturesAdapter(fetch, usdMProxyBaseUrl) : null;
  }

  async getSymbols(market: MarketType): Promise<SymbolInfo[]> {
    const attempts: ProviderAttemptError[] = [];

    try {
      return await this.directProvider.getSymbols(market);
    } catch (error) {
      attempts.push(toAttemptError('direct-rest', error));
    }

    const proxyAdapter = this.getProxyAdapter(market);

    if (proxyAdapter) {
      try {
        return await proxyAdapter.getSymbols();
      } catch (error) {
        attempts.push(toAttemptError('configured-proxy', error));
      }
    }

    throw new MarketDataProviderChainError('Symbol discovery', attempts);
  }

  async getKlines(request: Parameters<MarketDataProvider['getKlines']>[0]): Promise<Kline[]> {
    return (await this.getKlinesWithSource(request)).klines;
  }

  async getKlinesWithSource(
    request: Parameters<MarketDataProvider['getKlines']>[0],
    options: KlineProviderChainOptions = {},
  ): Promise<SourceAwareKlineResult> {
    const attempts: ProviderAttemptError[] = [];
    const allowPublicData = options.allowPublicData ?? true;

    try {
      return {
        klines: await this.directProvider.getKlines(request),
        source: 'binance-rest',
      };
    } catch (error) {
      attempts.push(toAttemptError('direct-rest', error));
    }

    const proxyAdapter = this.getProxyAdapter(request.market);

    if (proxyAdapter) {
      try {
        return {
          klines: await proxyAdapter.getKlines(request),
          source: 'binance-rest',
        };
      } catch (error) {
        attempts.push(toAttemptError('configured-proxy', error));
      }
    }

    if (allowPublicData) {
      try {
        return {
          klines: await fetchRecentPublicDataKlines(request.market, request.symbol, request.interval),
          source: 'binance-public-data',
        };
      } catch (error) {
        attempts.push(toAttemptError('public-data', error));
      }
    }

    throw new MarketDataProviderChainError('K-line request', attempts);
  }

  async getTicker24h(market: MarketType, symbols?: string[]): Promise<Ticker24h[]> {
    const attempts: ProviderAttemptError[] = [];

    try {
      const rows = await this.directProvider.getTicker24h(market, symbols);

      if (rows.length > 0) {
        return rows;
      }
    } catch (error) {
      attempts.push(toAttemptError('direct-rest', error));
    }

    const proxyAdapter = this.getProxyAdapter(market);

    if (proxyAdapter) {
      try {
        const rows = await proxyAdapter.getTicker24h(symbols);

        if (rows.length > 0) {
          return rows;
        }
      } catch (error) {
        attempts.push(toAttemptError('configured-proxy', error));
      }
    }

    throw new MarketDataProviderChainError('24h ticker request', attempts);
  }

  async getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo> {
    const attempts: ProviderAttemptError[] = [];

    try {
      return await this.directProvider.getFuturesMarketInfo(symbol);
    } catch (error) {
      attempts.push(toAttemptError('direct-rest', error));
    }

    if (this.usdMProxyAdapter) {
      try {
        return await this.usdMProxyAdapter.getFuturesMarketInfo(normalizeSymbol(symbol));
      } catch (error) {
        attempts.push(toAttemptError('configured-proxy', error));
      }
    }

    throw new MarketDataProviderChainError('USD-M futures market info request', attempts);
  }

  createKlineStream(request: KlineStreamRequest): KlineStream {
    return this.directProvider.createKlineStream(request);
  }

  private getProxyAdapter(market: MarketType): BinanceSpotAdapter | BinanceUsdMFuturesAdapter | null {
    return market === 'spot' ? this.spotProxyAdapter : this.usdMProxyAdapter;
  }
}

class DirectProvider implements MarketDataProvider {
  constructor(
    private readonly spotAdapter = new BinanceSpotAdapter(),
    private readonly usdMAdapter = new BinanceUsdMFuturesAdapter(),
  ) {}

  async getSymbols(market: MarketType): Promise<SymbolInfo[]> {
    return this.getAdapter(market).getSymbols();
  }

  async getKlines(request: Parameters<MarketDataProvider['getKlines']>[0]): Promise<Kline[]> {
    return this.getAdapter(request.market).getKlines(request);
  }

  async getTicker24h(market: MarketType, symbols?: string[]): Promise<Ticker24h[]> {
    return this.getAdapter(market).getTicker24h(symbols);
  }

  async getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo> {
    return this.usdMAdapter.getFuturesMarketInfo(symbol);
  }

  createKlineStream(request: KlineStreamRequest): KlineStream {
    const streams = request.intervals.map((interval) =>
      createLiveKlineStream({
        market: request.market,
        symbol: request.symbol,
        interval,
        onKline: request.onKline,
        onStateChange: request.onStateChange,
        onError: request.onError,
      }),
    );

    return {
      close: () => streams.forEach((stream) => stream.close()),
      reconnect: () => streams.forEach((stream) => stream.reconnect()),
    };
  }

  private getAdapter(market: MarketType) {
    return market === 'spot' ? this.spotAdapter : this.usdMAdapter;
  }
}
