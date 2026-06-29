import type { IndicatorConfig, IndicatorName } from '../../types/domain';

export interface IndicatorDefinition {
  name: IndicatorName;
  pane: 'main' | 'sub';
  defaultParams: number[];
  color: string;
}

export const indicatorDefinitions: IndicatorDefinition[] = [
  { name: 'MA', pane: 'main', defaultParams: [5, 10, 30, 60], color: '#f5b84b' },
  { name: 'EMA', pane: 'main', defaultParams: [6, 12, 20], color: '#2f81f7' },
  { name: 'BOLL', pane: 'main', defaultParams: [20, 2], color: '#9b8cff' },
  { name: 'SUPERTREND', pane: 'main', defaultParams: [10, 3], color: '#16c784' },
  { name: 'VOL', pane: 'sub', defaultParams: [5, 10, 20], color: '#9ba8ba' },
  { name: 'MACD', pane: 'sub', defaultParams: [12, 26, 9], color: '#2f81f7' },
  { name: 'RSI', pane: 'sub', defaultParams: [6, 12, 24], color: '#f5b84b' },
  { name: 'ATR', pane: 'sub', defaultParams: [14], color: '#9b8cff' },
  { name: 'KDJ', pane: 'sub', defaultParams: [9, 3, 3], color: '#16c784' },
];

export function getIndicatorDefinition(name: IndicatorName): IndicatorDefinition {
  const definition = indicatorDefinitions.find((item) => item.name === name);

  if (!definition) {
    throw new Error(`Unsupported indicator: ${name}`);
  }

  return definition;
}

export function createIndicatorConfig(
  base: Pick<IndicatorConfig, 'chartId' | 'interval' | 'market' | 'symbol'>,
  name: IndicatorName,
  now = Date.now(),
): IndicatorConfig {
  const definition = getIndicatorDefinition(name);

  return {
    id: `${base.market}:${base.symbol.toUpperCase()}:${base.chartId}:${base.interval}:${name}`,
    schemaVersion: 1,
    market: base.market,
    symbol: base.symbol.toUpperCase(),
    chartId: base.chartId,
    interval: base.interval,
    name,
    pane: definition.pane,
    visible: true,
    calcParams: definition.defaultParams,
    color: definition.color,
    lineWidth: 1,
    createdAt: now,
    updatedAt: now,
  };
}
