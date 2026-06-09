import { database } from '../../persistence/database';
import type { ChartId, IndicatorConfig, IndicatorName, Interval, MarketType } from '../../types/domain';
import { createIndicatorConfig } from './indicatorDefinitions';

export interface IndicatorConfigKey {
  market: MarketType;
  symbol: string;
  chartId: ChartId;
  interval: Interval;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function defaultIndicatorNames(): IndicatorName[] {
  return ['MA', 'VOL'];
}

export async function getIndicatorConfigs(key: IndicatorConfigKey): Promise<IndicatorConfig[]> {
  const rows = await database.indicatorConfigs
    .where('[market+symbol+chartId+interval]')
    .equals([key.market, normalizeSymbol(key.symbol), key.chartId, key.interval])
    .sortBy('createdAt');

  if (rows.length > 0) {
    return rows;
  }

  const defaults = defaultIndicatorNames().map((name) => createIndicatorConfig(key, name));
  await database.indicatorConfigs.bulkPut(defaults);

  return defaults;
}

export async function addIndicatorConfig(
  key: IndicatorConfigKey,
  name: IndicatorName,
): Promise<IndicatorConfig[]> {
  await getIndicatorConfigs(key);

  const nextConfig = createIndicatorConfig(key, name);

  if (!(await database.indicatorConfigs.get(nextConfig.id))) {
    await database.indicatorConfigs.put(nextConfig);
  }

  return getIndicatorConfigs(key);
}

export async function updateIndicatorConfig(
  id: string,
  updates: Partial<Pick<IndicatorConfig, 'calcParams' | 'color' | 'lineWidth' | 'visible'>>,
): Promise<void> {
  await database.indicatorConfigs.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteIndicatorConfig(id: string): Promise<void> {
  await database.indicatorConfigs.delete(id);
}
