import { MarketDataProviderChain } from '../market-data';
import type { MarketType, Ticker24h } from '../../types/domain';

export interface SymbolSearchRow {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export type LeaderboardKind = 'gainers' | 'losers' | 'volume';

const provider = new MarketDataProviderChain();
const fallbackSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

function toSearchRow(ticker: Ticker24h): SymbolSearchRow {
  return {
    symbol: ticker.symbol,
    lastPrice: ticker.lastPrice,
    priceChangePercent: ticker.priceChangePercent,
    quoteVolume: ticker.quoteVolume,
  };
}

function createFallbackRows(market: MarketType): SymbolSearchRow[] {
  return fallbackSymbols.map((symbol, index) => ({
    symbol,
    lastPrice: index === 0 ? '0' : '--',
    priceChangePercent: market === 'usdM' ? '0' : '0',
    quoteVolume: '0',
  }));
}

async function fetchSpotTickerFallback(): Promise<SymbolSearchRow[]> {
  const response = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');

  if (!response.ok) {
    throw new Error(`Spot ticker fallback failed ${response.status}.`);
  }

  const payload = (await response.json()) as Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
  }>;

  return payload
    .filter((row) => row.symbol.endsWith('USDT'))
    .map((row) => ({
      symbol: row.symbol,
      lastPrice: row.lastPrice,
      priceChangePercent: row.priceChangePercent,
      quoteVolume: row.quoteVolume,
    }));
}

export function filterSymbolRows(rows: SymbolSearchRow[], query: string): SymbolSearchRow[] {
  const normalizedQuery = query.trim().toUpperCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => row.symbol.includes(normalizedQuery));
}

export function sortLeaderboard(rows: SymbolSearchRow[], kind: LeaderboardKind): SymbolSearchRow[] {
  const sorted = [...rows];

  if (kind === 'gainers') {
    return sorted.sort((a, b) => Number(b.priceChangePercent) - Number(a.priceChangePercent));
  }

  if (kind === 'losers') {
    return sorted.sort((a, b) => Number(a.priceChangePercent) - Number(b.priceChangePercent));
  }

  return sorted.sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume));
}

export async function loadSymbolRows(market: MarketType): Promise<SymbolSearchRow[]> {
  try {
    const tickers = await provider.getTicker24h(market);
    const rows = tickers.filter((ticker) => ticker.symbol.endsWith('USDT')).map(toSearchRow);

    if (rows.length > 0) {
      return rows;
    }
  } catch {
    // Browser access to Binance REST can be unavailable; fallbacks keep search usable.
  }

  if (market === 'spot') {
    try {
      return await fetchSpotTickerFallback();
    } catch {
      return createFallbackRows(market);
    }
  }

  return createFallbackRows(market);
}
