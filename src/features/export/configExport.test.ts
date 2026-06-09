import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import { createDefaultSession, createDefaultSettings } from '../../app/defaults';
import { putSettingRecord } from '../../persistence/database';
import { createDrawing } from '../drawings/drawingRepository';
import { addIndicatorConfig } from '../indicators/indicatorConfigRepository';
import { addWatchlistSymbol } from '../watchlist/watchlistRepository';
import {
  createConfigExport,
  importConfigExport,
  serializeConfigExport,
  validateConfigExport,
} from './configExport';

describe('config export', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('exports user configuration without K-line cache or cache tasks', async () => {
    await putSettingRecord('lastSession', createDefaultSession(1));
    await putSettingRecord('chartSettings', createDefaultSettings('en-US', 1));
    await addWatchlistSymbol('usdM', 'ETHUSDT');
    await addIndicatorConfig({ market: 'usdM', symbol: 'BTCUSDT', chartId: 'left', interval: '5m' }, 'MACD');
    await createDrawing({
      market: 'usdM',
      symbol: 'BTCUSDT',
      chartId: 'left',
      interval: '5m',
      type: 'horizontal-line',
      points: [{ timestamp: 1, price: '100' }],
    });

    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));
    const json = serializeConfigExport(exported);

    expect(exported.data.watchlists.map((row) => row.symbol)).toContain('ETHUSDT');
    expect(exported.data.drawings).toHaveLength(1);
    expect(exported.data.indicatorConfigs.map((config) => config.name)).toContain('MACD');
    expect(json).not.toContain('klines');
    expect(json).not.toContain('klineRanges');
    expect(json).not.toContain('cacheTasks');
  });

  it('validates and imports a config payload', async () => {
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));

    await importConfigExport(validateConfigExport(exported));

    expect(validateConfigExport(exported).app).toBe('KLineForge');
    expect(() => validateConfigExport({ app: 'Other' })).toThrow(/valid KLineForge/);
  });

  it('rejects unsupported intervals and preserves existing data', async () => {
    await addWatchlistSymbol('usdM', 'ETHUSDT');
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));
    const malformed = {
      ...exported,
      data: {
        ...exported.data,
        watchlists: [{ ...exported.data.watchlists[0], interval: 'bad' }],
        lastSession: {
          ...createDefaultSession(1),
          leftInterval: '2m',
        },
      },
    };

    await expect(importConfigExport(malformed as never)).rejects.toThrow(/leftInterval/);

    expect((await database.watchlists.toArray()).map((row) => row.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('rejects malformed arrays before clearing stores', async () => {
    await addWatchlistSymbol('usdM', 'SOLUSDT');
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));

    await expect(
      importConfigExport({
        ...exported,
        data: {
          ...exported.data,
          watchlists: ['BTCUSDT'],
        },
      } as never),
    ).rejects.toThrow(/watchlists/);

    expect((await database.watchlists.toArray()).map((row) => row.symbol)).toEqual(['BTCUSDT', 'SOLUSDT']);
  });

  it('rejects bad drawings and unsupported indicator names', async () => {
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));
    const drawing = await createDrawing({
      market: 'usdM',
      symbol: 'BTCUSDT',
      chartId: 'left',
      interval: '5m',
      type: 'trend-line',
      points: [
        { timestamp: 1, price: '100' },
        { timestamp: 2, price: '101' },
      ],
    });
    const indicatorRows = await addIndicatorConfig(
      { market: 'usdM', symbol: 'BTCUSDT', chartId: 'left', interval: '5m' },
      'MACD',
    );

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          drawings: [{ ...drawing, points: [{ timestamp: 1, price: 'not-a-number' }] }],
        },
      }),
    ).toThrow(/points/);

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          indicatorConfigs: [{ ...indicatorRows[0], name: 'NOPE' }],
        },
      }),
    ).toThrow(/indicatorConfigs/);
  });
});
