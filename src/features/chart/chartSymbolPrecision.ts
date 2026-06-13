import type { KLineData, SymbolInfo as ChartSymbolInfo } from 'klinecharts';
import type { Kline, SymbolInfo } from '../../types/domain';

interface ResolvePricePrecisionInput {
  fallbackPrice?: number;
  klines?: Array<KLineData | Kline>;
  symbolInfo?: SymbolInfo | null;
}

interface ResolveChartSymbolInput extends ResolvePricePrecisionInput {
  symbol: string;
}

const minPrecision = 0;
const maxPrecision = 12;
const defaultPricePrecision = 4;
const defaultVolumePrecision = 4;

function clampPrecision(value: number): number {
  return Math.max(minPrecision, Math.min(maxPrecision, Math.trunc(value)));
}

function expandScientificNotation(value: string): string {
  if (!/e/i.test(value)) {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return number.toFixed(maxPrecision + 4).replace(/0+$/, '').replace(/\.$/, '');
}

export function precisionFromIncrement(increment: string): number {
  const normalized = expandScientificNotation(increment.trim());

  if (!normalized || Number(normalized) <= 0) {
    return defaultPricePrecision;
  }

  const decimalPart = normalized.split('.')[1]?.replace(/0+$/, '') ?? '';

  return clampPrecision(decimalPart.length);
}

export const precisionFromTickSize = precisionFromIncrement;

function decimalPlacesFromNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = expandScientificNotation(String(Math.abs(value)));
  const decimalPart = normalized.split('.')[1]?.replace(/0+$/, '') ?? '';

  return clampPrecision(decimalPart.length);
}

function significantPrecisionForSmallPrice(value: number): number {
  const absoluteValue = Math.abs(value);

  if (absoluteValue <= 0 || absoluteValue >= 1) {
    return 0;
  }

  return clampPrecision(Math.ceil(-Math.log10(absoluteValue)) + 3);
}

function getKlinePriceValues(klines: Array<KLineData | Kline> = []): number[] {
  return klines.flatMap((kline) => {
    const values = [kline.open, kline.high, kline.low, kline.close];

    return values.map(Number).filter(Number.isFinite);
  });
}

export function resolvePricePrecision({
  fallbackPrice,
  klines = [],
  symbolInfo,
}: ResolvePricePrecisionInput): number {
  if (symbolInfo?.tickSize) {
    return precisionFromTickSize(symbolInfo.tickSize);
  }

  const pricePrecision = symbolInfo?.pricePrecision;

  if (typeof pricePrecision === 'number' && Number.isInteger(pricePrecision)) {
    return clampPrecision(pricePrecision);
  }

  const prices = getKlinePriceValues(klines);

  if (typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice)) {
    prices.push(fallbackPrice);
  }

  if (prices.length === 0) {
    return defaultPricePrecision;
  }

  const latestPrice = Math.abs(prices.at(-1) ?? prices[0]);
  const maxDecimalPlaces = Math.max(...prices.map(decimalPlacesFromNumber));

  if (latestPrice >= 1000) {
    return clampPrecision(Math.min(Math.max(maxDecimalPlaces, 1), 2));
  }

  if (latestPrice >= 1) {
    return clampPrecision(Math.max(2, Math.min(maxDecimalPlaces, 4)));
  }

  return clampPrecision(Math.max(maxDecimalPlaces, significantPrecisionForSmallPrice(latestPrice)));
}

export function resolveVolumePrecision(symbolInfo?: SymbolInfo | null): number {
  if (symbolInfo?.stepSize) {
    return precisionFromIncrement(symbolInfo.stepSize);
  }

  const quantityPrecision = symbolInfo?.quantityPrecision;

  if (typeof quantityPrecision === 'number' && Number.isInteger(quantityPrecision)) {
    return clampPrecision(quantityPrecision);
  }

  return defaultVolumePrecision;
}

export function resolveChartSymbol({
  fallbackPrice,
  klines,
  symbol,
  symbolInfo,
}: ResolveChartSymbolInput): Pick<ChartSymbolInfo, 'pricePrecision' | 'ticker' | 'volumePrecision'> {
  return {
    ticker: symbol,
    pricePrecision: resolvePricePrecision({ fallbackPrice, klines, symbolInfo }),
    volumePrecision: resolveVolumePrecision(symbolInfo),
  };
}
