import type { FuturesMarketInfo, MarketType, Ticker24h } from '../../types/domain';
import { MarketDataProviderChain } from './providers/MarketDataProviderChain';

export interface MarketInfoSnapshot {
  ticker: Ticker24h | null;
  futuresInfo: FuturesMarketInfo | null;
  source: 'binance-rest' | 'fallback';
}

const provider = new MarketDataProviderChain();

function createFallbackTicker(market: MarketType, symbol: string): Ticker24h {
  return {
    schemaVersion: 1,
    market,
    symbol: symbol.toUpperCase(),
    lastPrice: '--',
    priceChange: '0',
    priceChangePercent: '0',
    highPrice: '--',
    lowPrice: '--',
    volume: '0',
    quoteVolume: '0',
    openTime: 0,
    closeTime: 0,
    updatedAt: Date.now(),
  };
}

async function fetchSpotTickerFallback(symbol: string): Promise<Ticker24h | null> {
  const url = new URL('/api/v3/ticker/24hr', 'https://data-api.binance.vision');
  url.searchParams.set('symbol', symbol.toUpperCase());
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    symbol: string;
    lastPrice: string;
    priceChange: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    count?: number;
  };

  return {
    schemaVersion: 1,
    market: 'spot',
    symbol: payload.symbol,
    lastPrice: payload.lastPrice,
    priceChange: payload.priceChange,
    priceChangePercent: payload.priceChangePercent,
    highPrice: payload.highPrice,
    lowPrice: payload.lowPrice,
    volume: payload.volume,
    quoteVolume: payload.quoteVolume,
    openTime: payload.openTime,
    closeTime: payload.closeTime,
    tradeCount: payload.count,
    updatedAt: Date.now(),
  };
}

export async function loadMarketInfo(market: MarketType, symbol: string): Promise<MarketInfoSnapshot> {
  try {
    const [ticker] = await provider.getTicker24h(market, [symbol]);
    const futuresInfo = market === 'usdM' ? await provider.getFuturesMarketInfo(symbol) : null;

    return {
      ticker: ticker ?? createFallbackTicker(market, symbol),
      futuresInfo,
      source: 'binance-rest',
    };
  } catch {
    if (market === 'spot') {
      const ticker = await fetchSpotTickerFallback(symbol).catch(() => null);

      if (ticker) {
        return {
          ticker,
          futuresInfo: null,
          source: 'fallback',
        };
      }
    }

    return {
      ticker: createFallbackTicker(market, symbol),
      futuresInfo: null,
      source: 'fallback',
    };
  }
}
