import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import { createIndicatorConfig } from './indicatorDefinitions';
import { addIndicatorConfig, getIndicatorConfigs } from './indicatorConfigRepository';
import {
  applyTemplateToIndicatorConfig,
  deleteIndicatorTemplate,
  getDefaultIndicatorTemplate,
  getIndicatorTemplates,
  saveIndicatorTemplate,
  setDefaultIndicatorTemplate,
} from './indicatorTemplatesRepository';

const key = {
  market: 'usdM' as const,
  symbol: 'BTCUSDT',
  chartId: 'left' as const,
  interval: '5m' as const,
};

describe('indicator template repository', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('saves, applies, deletes, and marks default templates', async () => {
    const config = createIndicatorConfig(key, 'MA', 1);
    const template = await saveIndicatorTemplate({
      config: {
        ...config,
        calcParams: [9, 21],
        source: 'hlc3',
      },
      name: 'Swing MA',
      isDefault: true,
    });

    expect((await getIndicatorTemplates('MA')).map((row) => row.name)).toEqual(['Swing MA']);
    expect((await getDefaultIndicatorTemplate('MA'))?.id).toBe(template.id);

    await setDefaultIndicatorTemplate(template.id, false);
    expect(await getDefaultIndicatorTemplate('MA')).toBeNull();

    await database.indicatorConfigs.put(config);
    const applied = await applyTemplateToIndicatorConfig(config, template.id);
    expect(applied.calcParams).toEqual([9, 21]);
    expect(applied.source).toBe('hlc3');

    await deleteIndicatorTemplate(template.id);
    expect(await getIndicatorTemplates('MA')).toEqual([]);
  });

  it('applies default templates when adding indicators', async () => {
    const config = createIndicatorConfig(key, 'MACD', 1);
    await saveIndicatorTemplate({
      config: {
        ...config,
        calcParams: [8, 17, 5],
      },
      name: 'Fast MACD',
      isDefault: true,
    });

    await addIndicatorConfig(key, 'MACD');

    const macd = (await getIndicatorConfigs(key)).find((row) => row.name === 'MACD');
    expect(macd?.calcParams).toEqual([8, 17, 5]);
  });
});
