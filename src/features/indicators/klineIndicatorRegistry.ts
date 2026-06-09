import { getSupportedIndicators, registerIndicator, type KLineData } from 'klinecharts';
import { calculateATR, calculateSupertrend } from './calculations';

let registered = false;

export function registerKLineForgeIndicators(): void {
  if (registered) {
    return;
  }

  const supported = new Set(getSupportedIndicators());

  if (!supported.has('ATR')) {
    registerIndicator({
      name: 'ATR',
      shortName: 'ATR',
      calcParams: [14],
      figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }],
      calc: (dataList: KLineData[], indicator) =>
        calculateATR(dataList, Number(indicator.calcParams[0] ?? 14)).map((atr) => ({ atr })),
    });
  }

  if (!supported.has('SUPERTREND')) {
    registerIndicator({
      name: 'SUPERTREND',
      shortName: 'SUPERTREND',
      series: 'price',
      shouldOhlc: true,
      calcParams: [10, 3],
      figures: [{ key: 'supertrend', title: 'ST: ', type: 'line' }],
      calc: (dataList: KLineData[], indicator) =>
        calculateSupertrend(
          dataList,
          Number(indicator.calcParams[0] ?? 10),
          Number(indicator.calcParams[1] ?? 3),
        ).map((value) => ({
          supertrend: value.supertrend,
        })),
    });
  }

  registered = true;
}
