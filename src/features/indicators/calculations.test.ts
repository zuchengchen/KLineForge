import { describe, expect, it } from 'vitest';
import type { KLineData } from 'klinecharts';
import {
  calculateATR,
  calculateBOLL,
  calculateEMA,
  calculateKDJ,
  calculateMA,
  calculateMACD,
  calculateRSI,
  calculateSupertrend,
  calculateVolume,
} from './calculations';

const data: KLineData[] = Array.from({ length: 30 }, (_, index) => {
  const close = 100 + index + (index % 3);

  return {
    timestamp: index,
    open: close - 1,
    high: close + 2,
    low: close - 3,
    close,
    volume: 10 + index,
  };
});

describe('indicator calculations', () => {
  it('calculates Volume', () => {
    expect(calculateVolume(data).slice(0, 3)).toEqual([10, 11, 12]);
  });

  it('calculates MA', () => {
    expect(calculateMA(data, 3).slice(0, 4)).toEqual([
      undefined,
      undefined,
      (100 + 102 + 104) / 3,
      (102 + 104 + 103) / 3,
    ]);
  });

  it('calculates EMA', () => {
    const ema = calculateEMA(data, 3);

    expect(ema[0]).toBe(100);
    expect(ema[1]).toBe(101);
    expect(ema[2]).toBe(102.5);
  });

  it('calculates BOLL', () => {
    const boll = calculateBOLL(data, 3, 2);

    expect(boll[0]).toEqual({});
    expect(boll[2].mid).toBeCloseTo(102);
    expect(boll[2].up).toBeGreaterThan(boll[2].mid ?? 0);
    expect(boll[2].down).toBeLessThan(boll[2].mid ?? 0);
  });

  it('calculates MACD', () => {
    const macd = calculateMACD(data);

    expect(macd[0]).toMatchObject({ dif: 0, dea: 0, macd: 0 });
    expect(macd.at(-1)?.dif).toBeGreaterThan(0);
  });

  it('calculates RSI', () => {
    const rsi = calculateRSI(data, 6);

    expect(rsi[0]).toBeUndefined();
    expect(rsi[6]).toBeGreaterThan(0);
    expect(rsi[6]).toBeLessThanOrEqual(100);
  });

  it('calculates ATR', () => {
    const atr = calculateATR(data, 5);

    expect(atr[3]).toBeUndefined();
    expect(atr[4]).toBeGreaterThan(0);
  });

  it('calculates KDJ', () => {
    const kdj = calculateKDJ(data);

    expect(kdj[7]).toEqual({});
    expect(kdj[8].k).toBeGreaterThan(0);
    expect(kdj[8].d).toBeGreaterThan(0);
    expect(kdj[8].j).toBeDefined();
  });

  it('calculates Supertrend', () => {
    const supertrend = calculateSupertrend(data, 5, 2);

    expect(supertrend[3]).toEqual({});
    expect(supertrend[4].supertrend).toBeGreaterThan(0);
    expect(['up', 'down']).toContain(supertrend[4].direction);
  });
});
