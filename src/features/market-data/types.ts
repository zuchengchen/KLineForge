import type {
  ConnectionState,
  FuturesMarketInfo,
  Interval,
  Kline,
  MarketType,
  SymbolInfo,
  Ticker24h,
} from '../../types/domain';

export interface KlineRequest {
  market: MarketType;
  symbol: string;
  interval: Interval;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface KlineStreamRequest {
  market: MarketType;
  symbol: string;
  intervals: Interval[];
  onKline: (kline: Kline) => void;
  onStateChange: (state: ConnectionState) => void;
  onError: (error: Error) => void;
}

export interface KlineStream {
  close: () => void;
  reconnect?: () => void;
}

export interface MarketDataProvider {
  getSymbols(market: MarketType): Promise<SymbolInfo[]>;
  getKlines(request: KlineRequest): Promise<Kline[]>;
  getTicker24h(market: MarketType, symbols?: string[]): Promise<Ticker24h[]>;
  getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo>;
  createKlineStream(request: KlineStreamRequest): KlineStream;
}

export interface ExchangeAdapter {
  market: MarketType;
  getSymbols(): Promise<SymbolInfo[]>;
  getKlines(request: KlineRequest): Promise<Kline[]>;
  getTicker24h(symbols?: string[]): Promise<Ticker24h[]>;
  findEarliestKlineOpenTime(symbol: string, interval: Interval): Promise<number | null>;
}

export interface FuturesInfoProvider {
  getFuturesMarketInfo(symbol: string): Promise<FuturesMarketInfo>;
}

export type HttpClient = (url: string, init?: RequestInit) => Promise<Response>;
