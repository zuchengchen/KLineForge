import { registerIndicator, type Indicator, type IndicatorFigure, type IndicatorFigureStyle, type KLineData } from 'klinecharts';
import type { IndicatorSource } from '../../types/domain';
import {
  calculateATR,
  calculateBOLL,
  calculateKDJ,
  calculateMA,
  calculateMACD,
  calculateRSI,
  calculateSupertrend,
  calculateVolume,
} from './calculations';
import { getIndicatorSourceValue, withIndicatorSource } from './indicatorSources';

let registered = false;

type IndicatorWithSource = Indicator<unknown, number, { source?: IndicatorSource }>;

function getIndicatorSource(indicator: IndicatorWithSource): IndicatorSource {
  return indicator.extendData?.source ?? 'close';
}

function lineFigure(key: string, title: string, styleIndex = 0): IndicatorFigure {
  return {
    key,
    title,
    type: 'line',
    styles: ({ indicator }) => {
      const style = indicator.styles?.lines?.[styleIndex];

      return {
        color: style?.color,
        size: style?.size,
        style: style?.style,
        dashedValue: style?.dashedValue,
      } as IndicatorFigureStyle;
    },
  };
}

function periodFigures(prefix: string, titlePrefix: string, params: number[]): IndicatorFigure[] {
  return params.map((period, index) => lineFigure(`${prefix}${index + 1}`, `${titlePrefix}${period}: `, index));
}

function movingAverageResult(dataList: KLineData[], indicator: IndicatorWithSource): Array<Record<string, number>> {
  const params = indicator.calcParams;
  const source = getIndicatorSource(indicator);
  const series = params.map((period) => calculateMA(dataList, Number(period), source));

  return dataList.map((_, index) =>
    Object.fromEntries(
      series
        .map((values, seriesIndex) => [`ma${seriesIndex + 1}`, values[index]])
        .filter((entry): entry is [string, number] => entry[1] !== undefined),
    ),
  );
}

function exponentialMovingAverageResult(
  dataList: KLineData[],
  indicator: IndicatorWithSource,
): Array<Record<string, number>> {
  const params = indicator.calcParams;
  const source = getIndicatorSource(indicator);
  const series = params.map((period) => calculateEMAKLineCompatible(dataList, Number(period), source));

  return dataList.map((_, index) =>
    Object.fromEntries(
      series
        .map((values, seriesIndex) => [`ema${seriesIndex + 1}`, values[index]])
        .filter((entry): entry is [string, number] => entry[1] !== undefined),
    ),
  );
}

function calculateEMAKLineCompatible(
  dataList: KLineData[],
  period: number,
  source: IndicatorSource,
): Array<number | undefined> {
  const sourceData = withIndicatorSource(dataList, source);
  let closeSum = 0;
  let emaValue = 0;

  return sourceData.map((row, index) => {
    const close = row.close;
    closeSum += close;

    if (index < period - 1) {
      return undefined;
    }

    if (index > period - 1) {
      emaValue = (2 * close + (period - 1) * emaValue) / (period + 1);
    } else {
      emaValue = closeSum / period;
    }

    return emaValue;
  });
}

function getVolumeFigure(): IndicatorFigure {
  return {
    key: 'volume',
    title: 'VOLUME: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ data, indicator, defaultStyles }) => {
      const style = indicator.styles?.bars?.[0];
      const current = data.current as (Record<string, number> & { close?: number; open?: number }) | null;
      let color = style?.noChangeColor ?? defaultStyles?.bars?.[0]?.noChangeColor;

      if (current && Number(current.close) > Number(current.open)) {
        color = style?.upColor ?? defaultStyles?.bars?.[0]?.upColor;
      } else if (current && Number(current.close) < Number(current.open)) {
        color = style?.downColor ?? defaultStyles?.bars?.[0]?.downColor;
      }

      return { color, borderColor: color } as IndicatorFigureStyle;
    },
  };
}

function getMacdHistogramFigure(): IndicatorFigure {
  return {
    key: 'macd',
    title: 'MACD: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ data, indicator, defaultStyles }) => {
      const style = indicator.styles?.bars?.[0];
      const current = data.current as { macd?: number } | null;
      const value = current?.macd ?? 0;
      const color =
        value > 0
          ? style?.upColor ?? defaultStyles?.bars?.[0]?.upColor
          : value < 0
            ? style?.downColor ?? defaultStyles?.bars?.[0]?.downColor
            : style?.noChangeColor ?? defaultStyles?.bars?.[0]?.noChangeColor;

      return { color, borderColor: color } as IndicatorFigureStyle;
    },
  };
}

export function registerKLineForgeIndicators(): void {
  if (registered) {
    return;
  }

  registerIndicator({
    name: 'MA',
    shortName: 'MA',
    series: 'price',
    precision: 2,
    shouldOhlc: true,
    calcParams: [5, 10, 30, 60],
    figures: periodFigures('ma', 'MA', [5, 10, 30, 60]),
    regenerateFigures: (params) => periodFigures('ma', 'MA', params.map(Number)),
    calc: movingAverageResult,
  });

  registerIndicator({
    name: 'EMA',
    shortName: 'EMA',
    series: 'price',
    precision: 2,
    shouldOhlc: true,
    calcParams: [6, 12, 20],
    figures: periodFigures('ema', 'EMA', [6, 12, 20]),
    regenerateFigures: (params) => periodFigures('ema', 'EMA', params.map(Number)),
    calc: exponentialMovingAverageResult,
  });

  registerIndicator({
    name: 'BOLL',
    shortName: 'BOLL',
    series: 'price',
    precision: 2,
    shouldOhlc: true,
    calcParams: [20, 2],
    figures: [lineFigure('up', 'UP: ', 0), lineFigure('mid', 'MID: ', 1), lineFigure('down', 'DN: ', 2)],
    calc: (dataList: KLineData[], indicator) =>
      calculateBOLL(
        dataList,
        Number(indicator.calcParams[0] ?? 20),
        Number(indicator.calcParams[1] ?? 2),
        getIndicatorSource(indicator as IndicatorWithSource),
      ).map((value) => ({
        up: value.up,
        mid: value.mid,
        down: value.down,
      })),
  });

  registerIndicator({
    name: 'VOL',
    shortName: 'VOL',
    series: 'volume',
    calcParams: [5, 10, 20],
    shouldFormatBigNumber: true,
    precision: 0,
    minValue: 0,
    figures: [...periodFigures('ma', 'MA', [5, 10, 20]).map((figure, index) => lineFigure(figure.key, figure.title ?? '', index + 1)), getVolumeFigure()],
    regenerateFigures: (params) => [
      ...periodFigures('ma', 'MA', params.map(Number)).map((figure, index) =>
        lineFigure(figure.key, figure.title ?? '', index + 1),
      ),
      getVolumeFigure(),
    ],
    calc: (dataList: KLineData[], indicator) => {
      const volumeValues = calculateVolume(dataList);
      const movingAverages = indicator.calcParams.map((period) => calculateMA(dataList, Number(period)));

      return dataList.map((row, index) => ({
        volume: volumeValues[index],
        open: row.open,
        close: row.close,
        ...Object.fromEntries(
          movingAverages
            .map((values, seriesIndex) => [`ma${seriesIndex + 1}`, values[index]])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      }));
    },
  });

  registerIndicator({
    name: 'MACD',
    shortName: 'MACD',
    calcParams: [12, 26, 9],
    figures: [lineFigure('dif', 'DIF: ', 0), lineFigure('dea', 'DEA: ', 1), getMacdHistogramFigure()],
    calc: (dataList: KLineData[], indicator) =>
      calculateMACD(
        dataList,
        Number(indicator.calcParams[0] ?? 12),
        Number(indicator.calcParams[1] ?? 26),
        Number(indicator.calcParams[2] ?? 9),
        getIndicatorSource(indicator as IndicatorWithSource),
      ),
  });

  registerIndicator({
    name: 'RSI',
    shortName: 'RSI',
    calcParams: [6, 12, 24],
    figures: periodFigures('rsi', 'RSI', [6, 12, 24]),
    regenerateFigures: (params) => periodFigures('rsi', 'RSI', params.map(Number)),
    calc: (dataList: KLineData[], indicator) => {
      const source = getIndicatorSource(indicator as IndicatorWithSource);
      const series = indicator.calcParams.map((period) => calculateRSI(dataList, Number(period), source));

      return dataList.map((_, index) =>
        Object.fromEntries(
          series
            .map((values, seriesIndex) => [`rsi${seriesIndex + 1}`, values[index]])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      );
    },
  });

  registerIndicator({
    name: 'ATR',
    shortName: 'ATR',
    calcParams: [14],
    figures: [lineFigure('atr', 'ATR: ', 0)],
    calc: (dataList: KLineData[], indicator) =>
      calculateATR(dataList, Number(indicator.calcParams[0] ?? 14)).map((atr) => ({ atr })),
  });

  registerIndicator({
    name: 'KDJ',
    shortName: 'KDJ',
    calcParams: [9, 3, 3],
    figures: [lineFigure('k', 'K: ', 0), lineFigure('d', 'D: ', 1), lineFigure('j', 'J: ', 2)],
    calc: (dataList: KLineData[], indicator) =>
      calculateKDJ(
        dataList,
        Number(indicator.calcParams[0] ?? 9),
        Number(indicator.calcParams[1] ?? 3),
        Number(indicator.calcParams[2] ?? 3),
      ),
  });

  registerIndicator({
    name: 'SUPERTREND',
    shortName: 'SUPERTREND',
    series: 'price',
    shouldOhlc: true,
    calcParams: [10, 3],
    figures: [lineFigure('supertrend', 'ST: ', 0)],
    calc: (dataList: KLineData[], indicator) =>
      calculateSupertrend(
        dataList,
        Number(indicator.calcParams[0] ?? 10),
        Number(indicator.calcParams[1] ?? 3),
      ).map((value) => ({
        supertrend: value.supertrend,
      })),
  });

  registered = true;
}

export function calculateIndicatorResultForConfig(
  dataList: KLineData[],
  name: string,
  calcParams: number[],
  source: IndicatorSource = 'close',
): Array<Record<string, number | undefined>> {
  switch (name) {
    case 'MA':
      return dataList.map((_, index) =>
        Object.fromEntries(
          calcParams
            .map((period, seriesIndex) => [`ma${seriesIndex + 1}`, calculateMA(dataList, period, source)[index]])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      );
    case 'EMA':
      return dataList.map((_, index) =>
        Object.fromEntries(
          calcParams
            .map((period, seriesIndex) => [
              `ema${seriesIndex + 1}`,
              calculateEMAKLineCompatible(dataList, period, source)[index],
            ])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      );
    case 'BOLL':
      return calculateBOLL(dataList, calcParams[0] ?? 20, calcParams[1] ?? 2, source).map((value) => ({
        up: value.up,
        mid: value.mid,
        down: value.down,
      }));
    case 'MACD':
      return calculateMACD(dataList, calcParams[0] ?? 12, calcParams[1] ?? 26, calcParams[2] ?? 9, source).map(
        (value) => ({ ...value }),
      );
    case 'RSI':
      return dataList.map((_, index) =>
        Object.fromEntries(
          calcParams
            .map((period, seriesIndex) => [`rsi${seriesIndex + 1}`, calculateRSI(dataList, period, source)[index]])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      );
    case 'ATR':
      return calculateATR(dataList, calcParams[0] ?? 14).map((atr) => ({ atr }));
    case 'KDJ':
      return calculateKDJ(dataList, calcParams[0] ?? 9, calcParams[1] ?? 3, calcParams[2] ?? 3).map((value) => ({
        ...value,
      }));
    case 'SUPERTREND':
      return calculateSupertrend(dataList, calcParams[0] ?? 10, calcParams[1] ?? 3).map((value) => ({
        supertrend: value.supertrend,
      }));
    case 'VOL': {
      const volumeValues = calculateVolume(dataList);
      const maValues = calcParams.map((period) => calculateMA(dataList, period));

      return dataList.map((row, index) => ({
        volume: volumeValues[index],
        open: row.open,
        close: row.close,
        ...Object.fromEntries(
          maValues
            .map((values, seriesIndex) => [`ma${seriesIndex + 1}`, values[index]])
            .filter((entry): entry is [string, number] => entry[1] !== undefined),
        ),
      }));
    }
    default:
      return dataList.map((row) => ({ close: getIndicatorSourceValue(row, source) }));
  }
}
