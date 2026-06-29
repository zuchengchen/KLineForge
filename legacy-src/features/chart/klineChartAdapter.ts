import type { KLineData, Period } from 'klinecharts';
import type { Interval, Kline } from '../../types/domain';

export function toKLineChartData(kline: Kline): KLineData {
  return {
    timestamp: kline.openTime,
    open: Number(kline.open),
    high: Number(kline.high),
    low: Number(kline.low),
    close: Number(kline.close),
    volume: Number(kline.volume),
    turnover: Number(kline.quoteVolume),
  };
}

export function intervalToPeriod(interval: Interval): Period {
  const value = Number.parseInt(interval, 10);

  if (interval.endsWith('m')) {
    return { type: 'minute', span: value };
  }

  if (interval.endsWith('h')) {
    return { type: 'hour', span: value };
  }

  if (interval.endsWith('d')) {
    return { type: 'day', span: value };
  }

  if (interval.endsWith('w')) {
    return { type: 'week', span: value };
  }

  return { type: 'month', span: value };
}
