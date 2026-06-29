export type Market = 'spot' | 'usdM';
export type ChartId = 'left' | 'right';

export interface AppSettings {
  market: Market;
  symbol: string;
  leftInterval: string;
  rightInterval: string;
  theme: 'dark' | 'light' | string;
  language: 'zh' | 'en' | string;
  indicators?: IndicatorSettings;
}

export interface IndicatorSettings {
  volume: boolean;
  ma: boolean;
  ema: boolean;
  boll: boolean;
  macd: boolean;
  rsi: boolean;
  atr: boolean;
  kdj: boolean;
  supertrend: boolean;
}

export interface HealthStatus {
  appVersion: string;
  databaseReady: boolean;
  backend: string;
}

export interface KlineRequest {
  market: Market;
  symbol: string;
  interval: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface LiveStreamRequest {
  chartId: ChartId;
  market: Market;
  symbol: string;
  interval: string;
}

export interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataResponse {
  points: ChartPoint[];
  source: string;
  cached: boolean;
}

export interface ChartDatasetExport {
  schemaVersion: number;
  generatedAt: number;
  source: string;
  market: Market;
  symbol: string;
  interval: string;
  requestedRows: number;
  rowCount: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  points: ChartPoint[];
  indicators?: IndicatorValue[];
  benchmark: BenchmarkSummary;
}

export type IndicatorKind =
  | 'volume'
  | 'ma'
  | 'ema'
  | 'boll'
  | 'macd'
  | 'rsi'
  | 'atr'
  | 'kdj'
  | 'supertrend';

export type IndicatorLineStyle = 'solid' | 'dotted' | 'dashed' | 'large-dashed' | 'sparse-dotted';
export type IndicatorSeriesType = 'line' | 'histogram';

export type IndicatorParams =
  | { kind: 'volume' }
  | { kind: 'ma'; periods: number[] }
  | { kind: 'ema'; periods: number[] }
  | { kind: 'boll'; period: number; multiplier: number }
  | { kind: 'macd'; shortPeriod: number; longPeriod: number; signalPeriod: number }
  | { kind: 'rsi'; period: number }
  | { kind: 'atr'; period: number }
  | { kind: 'kdj'; period: number; kSmoothing: number; dSmoothing: number }
  | { kind: 'supertrend'; period: number; multiplier: number };

export interface IndicatorStyle {
  color: string;
  lineWidth: number;
  lineStyle: IndicatorLineStyle;
}

export interface IndicatorInstance {
  id: string;
  chartId: ChartId;
  interval: string;
  kind: IndicatorKind;
  name: string;
  enabled: boolean;
  position: number;
  params: IndicatorParams;
  styles: Record<string, IndicatorStyle>;
  updatedAt: number;
}

export interface IndicatorScope {
  chartId: ChartId;
  interval: string;
}

export interface IndicatorCalculationRequest {
  chartId: ChartId;
  request: KlineRequest;
  maxRows?: number;
}

export interface IndicatorSeriesPoint {
  time: number;
  value: number;
  color?: string;
}

export interface IndicatorSeries {
  id: string;
  instanceId: string;
  key: string;
  label: string;
  seriesType: IndicatorSeriesType;
  pane: number;
  priceScaleId?: string;
  style: IndicatorStyle;
  data: IndicatorSeriesPoint[];
}

export interface IndicatorResponse {
  instances: IndicatorInstance[];
  series: IndicatorSeries[];
  skippedReason?: string;
}

export interface IndicatorValue {
  time: number;
  ma5?: number;
  ma10?: number;
  ma30?: number;
  bollMid?: number;
  bollUp?: number;
  bollDown?: number;
  ema12?: number;
  ema26?: number;
  macdDif?: number;
  macdDea?: number;
  macd?: number;
  rsi14?: number;
  atr14?: number;
  supertrend?: number;
  supertrendDirection?: number;
  kdjK?: number;
  kdjD?: number;
  kdjJ?: number;
}

export interface LiveKlineEvent {
  chartId: ChartId;
  point: ChartPoint;
  source: string;
  isClosed: boolean;
}

export interface CacheSummary {
  market: Market;
  symbol: string;
  interval: string;
  rowCount: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  updatedAt?: number;
}

export interface CacheClearRequest {
  market?: Market;
  symbol?: string;
  interval?: string;
}

export interface CacheClearResult {
  deletedRows: number;
}

export interface CsvExport {
  fileName: string;
  content: string;
  rowCount: number;
}

export interface DrawingObject {
  id: string;
  market: Market;
  symbol: string;
  interval: string;
  chartId: ChartId;
  drawingType: string;
  payload: DrawingPayload;
  updatedAt: number;
}

export interface DrawingQuery {
  market: Market;
  symbol: string;
  interval: string;
  chartId: ChartId;
}

export interface DrawingPayload {
  price?: number;
  startTime?: number;
  startPrice?: number;
  endTime?: number;
  endPrice?: number;
  text?: string;
  color?: string;
}

export interface ConfigImportResult {
  settingsImported: boolean;
  watchlistCount: number;
  drawingCount: number;
  indicatorCount: number;
}

export interface BenchmarkSummary {
  market: Market;
  symbol: string;
  interval: string;
  requestedRows: number;
  fetchedRows: number;
  fetchMs: number;
  sqliteWriteMs: number;
  sqliteReadMs: number;
  indicatorMs: number;
  source: string;
}

export interface SymbolSummary {
  market: Market;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

export interface Ticker24h {
  market: Market;
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  tradeCount?: number;
  openTime: number;
  closeTime: number;
  updatedAt: number;
}

export interface FuturesMarketInfo {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  nextFundingTime: number;
  updatedAt: number;
}

export interface MarketInfoSnapshot {
  ticker: Ticker24h;
  futures?: FuturesMarketInfo;
  source: string;
}

export interface LeaderboardEntry {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export interface Leaderboards {
  gainers: LeaderboardEntry[];
  losers: LeaderboardEntry[];
  volume: LeaderboardEntry[];
}

export interface WatchlistMutation {
  market: Market;
  symbol: string;
}

export interface WatchlistReorderRequest {
  market: Market;
  symbols: string[];
}
