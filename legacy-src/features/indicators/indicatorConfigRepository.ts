import { database } from '../../persistence/database';
import type { ChartId, IndicatorConfig, IndicatorName, Interval, MarketType } from '../../types/domain';
import { createIndicatorConfig } from './indicatorDefinitions';
import { getDefaultIndicatorTemplate } from './indicatorTemplatesRepository';
import { applyIndicatorTemplate, normalizeIndicatorConfig } from './indicatorSeriesStyles';

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
    const normalizedRows = rows.map(normalizeIndicatorConfig);
    const hasLegacyRows = normalizedRows.some((row, index) => row !== rows[index]);

    if (hasLegacyRows) {
      await database.indicatorConfigs.bulkPut(normalizedRows);
    }

    return normalizedRows;
  }

  const defaults = await Promise.all(
    defaultIndicatorNames().map(async (name) => {
      const config = createIndicatorConfig(key, name);
      const template = await getDefaultIndicatorTemplate(name);

      return template ? applyIndicatorTemplate(config, template) : normalizeIndicatorConfig(config);
    }),
  );
  await database.indicatorConfigs.bulkPut(defaults);

  return defaults;
}

export async function addIndicatorConfig(
  key: IndicatorConfigKey,
  name: IndicatorName,
): Promise<IndicatorConfig[]> {
  await getIndicatorConfigs(key);

  const baseConfig = createIndicatorConfig(key, name);
  const defaultTemplate = await getDefaultIndicatorTemplate(name);
  const nextConfig = defaultTemplate
    ? applyIndicatorTemplate(baseConfig, defaultTemplate)
    : normalizeIndicatorConfig(baseConfig);

  if (!(await database.indicatorConfigs.get(nextConfig.id))) {
    await database.indicatorConfigs.put(nextConfig);
  }

  return getIndicatorConfigs(key);
}

export async function updateIndicatorConfig(
  id: string,
  updates: Partial<
    Pick<IndicatorConfig, 'calcParams' | 'color' | 'lineWidth' | 'seriesStyles' | 'source' | 'visible'>
  >,
): Promise<void> {
  const current = await database.indicatorConfigs.get(id);

  if (!current) {
    return;
  }

  const shouldRegenerateSeriesStyles =
    updates.seriesStyles === undefined &&
    (updates.calcParams !== undefined || updates.color !== undefined || updates.lineWidth !== undefined);

  await database.indicatorConfigs.put(normalizeIndicatorConfig({
    ...current,
    ...updates,
    seriesStyles: shouldRegenerateSeriesStyles ? undefined : updates.seriesStyles ?? current.seriesStyles,
    updatedAt: Date.now(),
  }));
}

export async function deleteIndicatorConfig(id: string): Promise<void> {
  await database.indicatorConfigs.delete(id);
}
