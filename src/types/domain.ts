export type MarketType = 'spot' | 'usdM';

export type Interval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';

export type ChartId = 'left' | 'right' | 'third' | 'fourth';

export type ChartLayout = 1 | 2 | 3 | 4;

export type ChartIntervalMap = Record<ChartId, Interval>;

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export type ThemeMode = 'dark' | 'light';

export type LanguageMode = 'zh-CN' | 'en-US';

export type PriceColorMode = 'green-up-red-down' | 'red-up-green-down';

export type KlineSource = 'rest' | 'websocket' | 'cache' | 'public-data' | 'fallback';

export type IndicatorSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';

export type IndicatorLineStyle = 'solid' | 'dashed';

export interface IndicatorSeriesStyle {
  color: string;
  lineWidth: number;
  lineStyle: IndicatorLineStyle;
  visible: boolean;
}

export interface LastSessionState {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  chartLayout: ChartLayout;
  chartIntervals: ChartIntervalMap;
  leftInterval: Interval;
  rightInterval: Interval;
  activeChartId: ChartId;
  fullscreenChartId: ChartId | null;
  sidebarCollapsed: boolean;
  updatedAt: number;
}

export interface ChartSettings {
  schemaVersion: 1;
  theme: ThemeMode;
  language: LanguageMode;
  priceColorMode: PriceColorMode;
  chartStyle: 'candle' | 'hollow-candle' | 'line';
  showGrid: boolean;
  showLastPriceLine: boolean;
  showCrosshair: boolean;
  updatedAt: number;
}

export interface SymbolInfo {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'trading' | 'halt' | 'break' | 'unknown';
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: string;
  stepSize?: string;
  contractType?: 'perpetual' | 'delivery';
  onboardDate?: number;
  earliestKlineOpenTime?: number;
  updatedAt: number;
}

export interface Kline {
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  interval: Interval;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  tradeCount: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  isClosed: boolean;
  source: KlineSource;
  updatedAt: number;
}

export interface Ticker24h {
  schemaVersion: 1;
  market: MarketType;
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
  tradeCount?: number;
  updatedAt: number;
}

export interface FuturesMarketInfo {
  schemaVersion: 1;
  market: 'usdM';
  symbol: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  nextFundingTime: number;
  updatedAt: number;
}

export type IndicatorName = 'MA' | 'EMA' | 'BOLL' | 'SUPERTREND' | 'VOL' | 'MACD' | 'RSI' | 'ATR' | 'KDJ';

export interface IndicatorConfig {
  id: string;
  schemaVersion: 1;
  chartId: ChartId;
  market: MarketType;
  symbol: string;
  interval: Interval;
  name: IndicatorName;
  pane: 'main' | 'sub';
  visible: boolean;
  calcParams: number[];
  color: string;
  lineWidth: number;
  source?: IndicatorSource;
  seriesStyles?: Record<string, IndicatorSeriesStyle>;
  settingsVersion?: 1;
  createdAt: number;
  updatedAt: number;
}

export interface IndicatorTemplate {
  id: string;
  schemaVersion: 1;
  name: string;
  indicatorName: IndicatorName;
  calcParams: number[];
  visible: boolean;
  color: string;
  lineWidth: number;
  source?: IndicatorSource;
  seriesStyles: Record<string, IndicatorSeriesStyle>;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DrawingType = 'trend-line' | 'horizontal-line' | 'vertical-line' | 'rectangle' | 'text' | 'measurement';

export interface DrawingPoint {
  timestamp: number;
  price: string;
}

export interface DrawingStyle {
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed';
  opacity: number;
  textColor: string;
  textSize: number;
  fillColor: string;
  fillOpacity: number;
}

export interface DrawingObject {
  id: string;
  schemaVersion: 1;
  market: MarketType;
  symbol: string;
  chartId: ChartId;
  interval: Interval;
  type: DrawingType;
  points: DrawingPoint[];
  text?: string;
  style: DrawingStyle;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export const supportedIntervals: Interval[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
];
