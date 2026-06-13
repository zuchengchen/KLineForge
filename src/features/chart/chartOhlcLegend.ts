import type { KLineData } from 'klinecharts';

export interface OhlcLegendValue {
  candle: KLineData | null;
  amplitude: number | null;
}

export function calculateOhlcAmplitude(candle: Pick<KLineData, 'high' | 'low'> | null | undefined): number | null {
  if (!candle || !Number.isFinite(candle.high) || !Number.isFinite(candle.low) || candle.low === 0) {
    return null;
  }

  return ((candle.high - candle.low) / candle.low) * 100;
}

export function getLatestOhlcCandle(data: KLineData[]): KLineData | null {
  return data.at(-1) ?? null;
}

export function resolveOhlcLegendCandle(data: KLineData[], hovered: KLineData | null | undefined): OhlcLegendValue {
  const candle = hovered ?? getLatestOhlcCandle(data);

  return {
    candle,
    amplitude: calculateOhlcAmplitude(candle),
  };
}
