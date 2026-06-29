import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import {
  addIndicatorConfig,
  deleteIndicatorConfig,
  getIndicatorConfigs,
  updateIndicatorConfig,
} from './indicatorConfigRepository';

const key = {
  market: 'usdM' as const,
  symbol: 'btcusdt',
  chartId: 'left' as const,
  interval: '5m' as const,
};

describe('indicator config repository', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('creates default MA and Volume configs per chart', async () => {
    const configs = await getIndicatorConfigs(key);

    expect(configs.map((config) => config.name)).toEqual(['MA', 'VOL']);
    expect(configs.every((config) => config.chartId === 'left')).toBe(true);
  });

  it('keeps left and right chart configs independent', async () => {
    await addIndicatorConfig(key, 'MACD');
    const rightConfigs = await getIndicatorConfigs({ ...key, chartId: 'right', interval: '1h' });

    expect((await getIndicatorConfigs(key)).map((config) => config.name)).toContain('MACD');
    expect(rightConfigs.map((config) => config.name)).toEqual(['MA', 'VOL']);
  });

  it('updates and deletes configs', async () => {
    const [config] = await getIndicatorConfigs(key);

    await updateIndicatorConfig(config.id, {
      visible: false,
      calcParams: [10],
      color: '#fff',
      lineWidth: 2,
      source: 'hl2',
    });
    const updated = await database.indicatorConfigs.get(config.id);

    expect(updated).toMatchObject({ visible: false, calcParams: [10], color: '#fff', lineWidth: 2, source: 'hl2' });
    expect(updated?.seriesStyles?.ma1).toMatchObject({ color: '#fff', lineWidth: 2 });

    await deleteIndicatorConfig(config.id);
    expect(await database.indicatorConfigs.get(config.id)).toBeUndefined();
  });

  it('normalizes legacy rows on read', async () => {
    await database.indicatorConfigs.put({
      id: 'legacy-ma',
      schemaVersion: 1,
      market: key.market,
      symbol: 'BTCUSDT',
      chartId: key.chartId,
      interval: key.interval,
      name: 'MA',
      pane: 'main',
      visible: true,
      calcParams: [5, 10],
      color: '#fff',
      lineWidth: 2,
      createdAt: 1,
      updatedAt: 1,
    });

    const [config] = await getIndicatorConfigs(key);

    expect(config.source).toBe('close');
    expect(config.seriesStyles?.ma1).toMatchObject({ color: '#fff', lineWidth: 2 });
    expect((await database.indicatorConfigs.get('legacy-ma'))?.seriesStyles?.ma2).toBeDefined();
  });
});
