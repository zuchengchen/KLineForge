import { BinanceSpotAdapter } from '../adapters/BinanceSpotAdapter';
import { BinanceUsdMFuturesAdapter } from '../adapters/BinanceUsdMFuturesAdapter';
import { createLiveKlineStream } from '../binance/liveKlineStream';
import type { KlineStream, KlineStreamRequest, MarketDataProvider } from '../types';
import type { FuturesMarketInfo, Kline, MarketType, SymbolInfo, Ticker24h } from '../../../types/domain';

export class BinanceDirectMarketDataProvider implements MarketDataProvider {
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
