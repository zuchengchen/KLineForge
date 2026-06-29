import type { FuturesMarketInfo, Interval, Kline, MarketType, SymbolInfo, Ticker24h } from '../../../types/domain';

type BinanceKlineArray = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

interface BinanceSymbolFilter {
  filterType: string;
  tickSize?: string;
  stepSize?: string;
}

interface BinanceSpotSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision?: number;
  quoteAssetPrecision?: number;
  filters?: BinanceSymbolFilter[];
}

interface BinanceFuturesSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  contractType?: string;
  onboardDate?: number;
  filters?: BinanceSymbolFilter[];
}

interface BinanceTickerPayload {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count?: number;
}

interface BinancePremiumIndexPayload {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  time?: number;
}

function normalizeStatus(status: string): SymbolInfo['status'] {
  if (status === 'TRADING') {
    return 'trading';
  }

  if (status === 'BREAK') {
    return 'break';
  }

  if (status === 'HALT') {
    return 'halt';
  }

  return 'unknown';
}

function findFilter(filters: BinanceSymbolFilter[] | undefined, filterType: string): BinanceSymbolFilter | undefined {
  return filters?.find((filter) => filter.filterType === filterType);
}

export function normalizeBinanceKline(
  market: MarketType,
  symbol: string,
  interval: Interval,
  row: BinanceKlineArray,
  source: Kline['source'] = 'rest',
  now = Date.now(),
): Kline {
  return {
    schemaVersion: 1,
    market,
    symbol: symbol.toUpperCase(),
    interval,
    openTime: row[0],
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
    closeTime: row[6],
    quoteVolume: row[7],
    tradeCount: row[8],
    takerBuyBaseVolume: row[9],
    takerBuyQuoteVolume: row[10],
    isClosed: source === 'rest' || source === 'public-data' || source === 'cache' || source === 'fallback',
    source,
    updatedAt: now,
  };
}

export function normalizeSpotSymbol(payload: BinanceSpotSymbol, now = Date.now()): SymbolInfo {
  const priceFilter = findFilter(payload.filters, 'PRICE_FILTER');
  const lotSize = findFilter(payload.filters, 'LOT_SIZE');

  return {
    schemaVersion: 1,
    market: 'spot',
    symbol: payload.symbol,
    baseAsset: payload.baseAsset,
    quoteAsset: payload.quoteAsset,
    status: normalizeStatus(payload.status),
    pricePrecision: payload.quoteAssetPrecision,
    quantityPrecision: payload.baseAssetPrecision,
    tickSize: priceFilter?.tickSize,
    stepSize: lotSize?.stepSize,
    updatedAt: now,
  };
}

export function normalizeFuturesSymbol(payload: BinanceFuturesSymbol, now = Date.now()): SymbolInfo {
  const priceFilter = findFilter(payload.filters, 'PRICE_FILTER');
  const lotSize = findFilter(payload.filters, 'LOT_SIZE');

  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: payload.symbol,
    baseAsset: payload.baseAsset,
    quoteAsset: payload.quoteAsset,
    status: normalizeStatus(payload.status),
    pricePrecision: payload.pricePrecision,
    quantityPrecision: payload.quantityPrecision,
    tickSize: priceFilter?.tickSize,
    stepSize: lotSize?.stepSize,
    contractType: payload.contractType === 'PERPETUAL' ? 'perpetual' : 'delivery',
    onboardDate: payload.onboardDate,
    updatedAt: now,
  };
}

export function normalizeTicker24h(market: MarketType, payload: BinanceTickerPayload, now = Date.now()): Ticker24h {
  return {
    schemaVersion: 1,
    market,
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
    updatedAt: now,
  };
}

export function normalizeFuturesMarketInfo(payload: BinancePremiumIndexPayload, now = Date.now()): FuturesMarketInfo {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: payload.symbol,
    markPrice: payload.markPrice,
    indexPrice: payload.indexPrice,
    fundingRate: payload.lastFundingRate,
    nextFundingTime: payload.nextFundingTime,
    updatedAt: payload.time ?? now,
  };
}
