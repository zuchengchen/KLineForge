import { describe, expect, it } from 'vitest';
import type { KLineData } from 'klinecharts';
import type { SymbolInfo } from '../../types/domain';
import {
  precisionFromIncrement,
  precisionFromTickSize,
  resolveChartSymbol,
  resolvePricePrecision,
  resolveVolumePrecision,
} from './chartSymbolPrecision';

function createSymbolInfo(overrides: Partial<SymbolInfo> = {}): SymbolInfo {
  return {
    schemaVersion: 1,
    market: 'spot',
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    status: 'trading',
    updatedAt: 1,
    ...overrides,
  };
}

function createBar(close: number): KLineData {
  return {
    timestamp: 1,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  };
}

describe('chart symbol precision', () => {
  it('derives precision from exchange tick and step increments', () => {
    expect(precisionFromTickSize('1')).toBe(0);
    expect(precisionFromTickSize('0.01')).toBe(2);
    expect(precisionFromTickSize('0.01000000')).toBe(2);
    expect(precisionFromTickSize('0.00000100')).toBe(6);
    expect(precisionFromTickSize('0.00000001')).toBe(8);
    expect(precisionFromTickSize('1e-8')).toBe(8);
    expect(precisionFromIncrement('0.00100000')).toBe(3);
  });

  it('prefers exchange tick size over declared precision and K-line fallback', () => {
    expect(
      resolvePricePrecision({
        klines: [createBar(65000.1234)],
        symbolInfo: createSymbolInfo({ pricePrecision: 8, tickSize: '0.10' }),
      }),
    ).toBe(1);
  });

  it('uses declared exchange precision when tick size is unavailable', () => {
    expect(
      resolvePricePrecision({
        klines: [createBar(0.00001234)],
        symbolInfo: createSymbolInfo({ pricePrecision: 6 }),
      }),
    ).toBe(6);
  });

  it('falls back to price magnitude when metadata is unavailable', () => {
    expect(resolvePricePrecision({ klines: [createBar(65000.12)] })).toBe(2);
    expect(resolvePricePrecision({ klines: [createBar(1.2345)] })).toBe(4);
    expect(resolvePricePrecision({ klines: [createBar(0.00001234)] })).toBeGreaterThanOrEqual(8);
    expect(resolvePricePrecision({})).toBe(4);
  });

  it('resolves volume precision independently from step size or quantity precision', () => {
    expect(resolveVolumePrecision(createSymbolInfo({ quantityPrecision: 8, stepSize: '0.00100000' }))).toBe(3);
    expect(resolveVolumePrecision(createSymbolInfo({ quantityPrecision: 5 }))).toBe(5);
    expect(resolveVolumePrecision()).toBe(4);
  });

  it('builds the chart symbol with independent price and volume precision', () => {
    expect(
      resolveChartSymbol({
        symbol: 'JCTUSDT',
        symbolInfo: createSymbolInfo({
          symbol: 'JCTUSDT',
          tickSize: '0.00000100',
          stepSize: '1.00000000',
        }),
      }),
    ).toEqual({
      ticker: 'JCTUSDT',
      pricePrecision: 6,
      volumePrecision: 0,
    });
  });
});
