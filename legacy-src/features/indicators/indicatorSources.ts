import type { KLineData } from 'klinecharts';
import type { IndicatorSource } from '../../types/domain';

export function getIndicatorSourceValue(row: KLineData, source: IndicatorSource = 'close'): number {
  switch (source) {
    case 'open':
      return row.open;
    case 'high':
      return row.high;
    case 'low':
      return row.low;
    case 'hl2':
      return (row.high + row.low) / 2;
    case 'hlc3':
      return (row.high + row.low + row.close) / 3;
    case 'ohlc4':
      return (row.open + row.high + row.low + row.close) / 4;
    case 'close':
    default:
      return row.close;
  }
}

export function withIndicatorSource(data: KLineData[], source: IndicatorSource = 'close'): KLineData[] {
  if (source === 'close') {
    return data;
  }

  return data.map((row) => {
    const value = getIndicatorSourceValue(row, source);

    return {
      ...row,
      open: value,
      high: value,
      low: value,
      close: value,
    };
  });
}
