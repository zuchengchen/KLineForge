import type { KLineData } from 'klinecharts';

export interface BollValue {
  mid?: number;
  up?: number;
  down?: number;
}

export interface MacdValue {
  dif?: number;
  dea?: number;
  macd?: number;
}

export interface KdjValue {
  k?: number;
  d?: number;
  j?: number;
}

export interface SupertrendValue {
  supertrend?: number;
  direction?: 'up' | 'down';
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[], mean: number): number {
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
}

function trueRange(current: KLineData, previous: KLineData | undefined): number {
  if (!previous) {
    return current.high - current.low;
  }

  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close),
  );
}

export function calculateVolume(data: KLineData[]): number[] {
  return data.map((row) => row.volume ?? 0);
}

export function calculateMA(data: KLineData[], period: number): Array<number | undefined> {
  return data.map((_, index) => {
    if (index < period - 1) {
      return undefined;
    }

    return average(data.slice(index - period + 1, index + 1).map((row) => row.close));
  });
}

export function calculateEMA(data: KLineData[], period: number): Array<number | undefined> {
  const alpha = 2 / (period + 1);
  let previous: number | undefined;

  return data.map((row, index) => {
    if (index === 0) {
      previous = row.close;
      return previous;
    }

    previous = row.close * alpha + (previous ?? row.close) * (1 - alpha);
    return previous;
  });
}

export function calculateBOLL(data: KLineData[], period: number, multiplier: number): BollValue[] {
  return data.map((_, index) => {
    if (index < period - 1) {
      return {};
    }

    const closes = data.slice(index - period + 1, index + 1).map((row) => row.close);
    const mid = average(closes);
    const deviation = standardDeviation(closes, mid);

    return {
      mid,
      up: mid + multiplier * deviation,
      down: mid - multiplier * deviation,
    };
  });
}

export function calculateMACD(data: KLineData[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9): MacdValue[] {
  const shortEma = calculateEMA(data, shortPeriod);
  const longEma = calculateEMA(data, longPeriod);
  const difValues = data.map((_, index) => (shortEma[index] ?? 0) - (longEma[index] ?? 0));
  const signalData = difValues.map((close, index) => ({
    timestamp: data[index].timestamp,
    open: close,
    high: close,
    low: close,
    close,
  }));
  const deaValues = calculateEMA(signalData, signalPeriod);

  return data.map((_, index) => {
    const dif = difValues[index];
    const dea = deaValues[index] ?? 0;

    return {
      dif,
      dea,
      macd: (dif - dea) * 2,
    };
  });
}

export function calculateRSI(data: KLineData[], period: number): Array<number | undefined> {
  let avgGain = 0;
  let avgLoss = 0;

  return data.map((row, index) => {
    if (index === 0) {
      return undefined;
    }

    const change = row.close - data[index - 1].close;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;

      if (index < period) {
        return undefined;
      }

      avgGain /= period;
      avgLoss /= period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      return 100;
    }

    const relativeStrength = avgGain / avgLoss;
    return 100 - 100 / (1 + relativeStrength);
  });
}

export function calculateATR(data: KLineData[], period: number): Array<number | undefined> {
  let previousAtr: number | undefined;
  const ranges = data.map((row, index) => trueRange(row, data[index - 1]));

  return ranges.map((range, index) => {
    if (index < period - 1) {
      return undefined;
    }

    if (index === period - 1) {
      previousAtr = average(ranges.slice(0, period));
      return previousAtr;
    }

    previousAtr = ((previousAtr ?? range) * (period - 1) + range) / period;
    return previousAtr;
  });
}

export function calculateKDJ(data: KLineData[], period = 9, kPeriod = 3, dPeriod = 3): KdjValue[] {
  let previousK = 50;
  let previousD = 50;

  return data.map((row, index) => {
    if (index < period - 1) {
      return {};
    }

    const window = data.slice(index - period + 1, index + 1);
    const highest = Math.max(...window.map((item) => item.high));
    const lowest = Math.min(...window.map((item) => item.low));
    const rsv = highest === lowest ? 50 : ((row.close - lowest) / (highest - lowest)) * 100;
    const k = (previousK * (kPeriod - 1) + rsv) / kPeriod;
    const d = (previousD * (dPeriod - 1) + k) / dPeriod;
    const j = 3 * k - 2 * d;

    previousK = k;
    previousD = d;

    return { k, d, j };
  });
}

export function calculateSupertrend(data: KLineData[], atrPeriod = 10, multiplier = 3): SupertrendValue[] {
  const atrValues = calculateATR(data, atrPeriod);
  let finalUpper = 0;
  let finalLower = 0;
  let previousTrend = 0;

  return data.map((row, index) => {
    const atr = atrValues[index];

    if (atr === undefined) {
      return {};
    }

    const median = (row.high + row.low) / 2;
    const basicUpper = median + multiplier * atr;
    const basicLower = median - multiplier * atr;
    const previousClose = data[index - 1]?.close;

    if (index === atrPeriod - 1 || previousClose === undefined) {
      finalUpper = basicUpper;
      finalLower = basicLower;
      previousTrend = row.close <= finalUpper ? finalUpper : finalLower;
    } else {
      finalUpper = basicUpper < finalUpper || previousClose > finalUpper ? basicUpper : finalUpper;
      finalLower = basicLower > finalLower || previousClose < finalLower ? basicLower : finalLower;

      if (previousTrend === finalUpper) {
        previousTrend = row.close <= finalUpper ? finalUpper : finalLower;
      } else {
        previousTrend = row.close >= finalLower ? finalLower : finalUpper;
      }
    }

    return {
      supertrend: previousTrend,
      direction: row.close >= previousTrend ? 'up' : 'down',
    };
  });
}
