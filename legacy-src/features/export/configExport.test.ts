import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import { createDefaultSession, createDefaultSettings } from '../../app/defaults';
import { putSettingRecord } from '../../persistence/database';
import { createDrawing } from '../drawings/drawingRepository';
import { addIndicatorConfig, updateIndicatorConfig } from '../indicators/indicatorConfigRepository';
import { saveIndicatorTemplate } from '../indicators/indicatorTemplatesRepository';
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
    const indicatorRows = await addIndicatorConfig(
      { market: 'usdM', symbol: 'BTCUSDT', chartId: 'left', interval: '5m' },
      'MACD',
    );
    const macd = indicatorRows.find((row) => row.name === 'MACD');
    if (macd) {
      await updateIndicatorConfig(macd.id, { source: 'hlc3' });
      await saveIndicatorTemplate({ config: { ...macd, source: 'hlc3' }, name: 'MACD template', isDefault: true });
    }
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
    expect(exported.data.indicatorConfigs.find((config) => config.name === 'MACD')?.source).toBe('hlc3');
    expect(exported.data.indicatorTemplates.map((template) => template.name)).toContain('MACD template');
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

  it('accepts third and fourth chart state in exported configs', async () => {
    const session = {
      ...createDefaultSession(1),
      chartLayout: 4 as const,
      chartIntervals: {
        left: '5m' as const,
        right: '1h' as const,
        third: '12h' as const,
        fourth: '1w' as const,
      },
      activeChartId: 'fourth' as const,
      fullscreenChartId: 'third' as const,
    };
    await putSettingRecord('lastSession', session);
    await addIndicatorConfig({ market: 'usdM', symbol: 'BTCUSDT', chartId: 'third', interval: '12h' }, 'MACD');
    await createDrawing({
      market: 'usdM',
      symbol: 'BTCUSDT',
      chartId: 'fourth',
      interval: '1w',
      type: 'horizontal-line',
      points: [{ timestamp: 1, price: '100' }],
    });

    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));
    const validated = validateConfigExport(exported);

    expect(validated.data.lastSession?.chartLayout).toBe(4);
    expect(validated.data.lastSession?.chartIntervals.third).toBe('12h');
    expect(validated.data.lastSession?.chartIntervals.fourth).toBe('1w');
    expect(validated.data.indicatorConfigs.some((config) => config.chartId === 'third')).toBe(true);
    expect(validated.data.drawings.some((drawing) => drawing.chartId === 'fourth')).toBe(true);
  });

  it('imports old two-chart session exports by adding layout and chart interval defaults', () => {
    const exported = {
      schemaVersion: 1,
      app: 'KLineForge',
      exportedAt: '2026-06-09T00:00:00.000Z',
      data: {
        settings: null,
        lastSession: {
          schemaVersion: 1,
          market: 'usdM',
          symbol: 'BTCUSDT',
          leftInterval: '15m',
          rightInterval: '4h',
          activeChartId: 'right',
          fullscreenChartId: null,
          sidebarCollapsed: false,
          updatedAt: 1,
        },
        watchlists: [],
        drawings: [],
        indicatorConfigs: [],
        indicatorTemplates: [],
      },
    };

    const validated = validateConfigExport(exported);

    expect(validated.data.lastSession?.chartLayout).toBe(2);
    expect(validated.data.lastSession?.chartIntervals).toEqual({
      left: '15m',
      right: '4h',
      third: '4h',
      fourth: '1d',
    });
  });

  it('rejects invalid chart layouts and chart ids', async () => {
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          lastSession: {
            ...createDefaultSession(1),
            chartLayout: 5,
          },
        },
      }),
    ).toThrow(/chartLayout/);

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          drawings: [
            {
              schemaVersion: 1,
              id: 'bad',
              market: 'usdM',
              symbol: 'BTCUSDT',
              chartId: 'fifth',
              interval: '5m',
              type: 'horizontal-line',
              points: [{ timestamp: 1, price: '100' }],
              style: {
                lineColor: '#fff',
                lineWidth: 1,
                lineStyle: 'solid',
                opacity: 1,
                textColor: '#fff',
                textSize: 12,
                fillColor: '#fff',
                fillOpacity: 0.1,
              },
              locked: false,
              visible: true,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      }),
    ).toThrow(/chartId/);
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

  it('imports old indicator configs that do not include templates or richer style fields', () => {
    const exported = {
      schemaVersion: 1,
      app: 'KLineForge',
      exportedAt: '2026-06-09T00:00:00.000Z',
      data: {
        settings: null,
        lastSession: null,
        watchlists: [],
        drawings: [],
        indicatorConfigs: [
          {
            id: 'old-ma',
            schemaVersion: 1,
            market: 'usdM',
            symbol: 'BTCUSDT',
            chartId: 'left',
            interval: '5m',
            name: 'MA',
            pane: 'main',
            visible: true,
            calcParams: [5],
            color: '#fff',
            lineWidth: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    };

    const validated = validateConfigExport(exported);

    expect(validated.data.indicatorTemplates).toEqual([]);
    expect(validated.data.indicatorConfigs[0].seriesStyles?.ma1).toMatchObject({ color: '#fff' });
  });

  it('rejects malformed richer indicator styles, sources, and templates', async () => {
    const exported = await createConfigExport(new Date('2026-06-09T00:00:00.000Z'));
    const indicatorRows = await addIndicatorConfig(
      { market: 'usdM', symbol: 'BTCUSDT', chartId: 'left', interval: '5m' },
      'MACD',
    );
    const macd = indicatorRows.find((row) => row.name === 'MACD');

    expect(macd).toBeDefined();

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          indicatorConfigs: [
            {
              ...macd,
              source: 'bad',
            },
          ],
        },
      }),
    ).toThrow(/source/);

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          indicatorConfigs: [
            {
              ...macd,
              seriesStyles: {
                nope: {
                  color: '#fff',
                  lineWidth: 1,
                  lineStyle: 'solid',
                  visible: true,
                },
              },
            },
          ],
        },
      }),
    ).toThrow(/seriesStyles/);

    expect(() =>
      validateConfigExport({
        ...exported,
        data: {
          ...exported.data,
          indicatorTemplates: [
            {
              id: 'template',
              schemaVersion: 1,
              name: 'Bad',
              indicatorName: 'MA',
              calcParams: [5],
              visible: true,
              color: 'red',
              lineWidth: 1,
              source: 'close',
              seriesStyles: {},
              isDefault: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      }),
    ).toThrow(/color/);
  });
});
