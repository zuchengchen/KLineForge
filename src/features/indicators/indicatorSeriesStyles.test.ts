import { describe, expect, it } from 'vitest';
import type { IndicatorConfig } from '../../types/domain';
import { normalizeIndicatorConfig, normalizeIndicatorSeriesStyles } from './indicatorSeriesStyles';

const legacyConfig: IndicatorConfig = {
  id: 'test',
  schemaVersion: 1,
  market: 'usdM',
  symbol: 'btcusdt',
  chartId: 'left',
  interval: '5m',
  name: 'MA',
  pane: 'main',
  visible: true,
  calcParams: [5, 10],
  color: '#fff',
  lineWidth: 2,
  createdAt: 1,
  updatedAt: 1,
};

describe('indicator style normalization', () => {
  it('normalizes old single-color configs into per-series styles', () => {
    const normalized = normalizeIndicatorConfig(legacyConfig);

    expect(normalized.symbol).toBe('BTCUSDT');
    expect(normalized.source).toBe('close');
    expect(normalized.seriesStyles?.ma1).toMatchObject({
      color: '#fff',
      lineWidth: 2,
      lineStyle: 'solid',
      visible: true,
    });
    expect(normalized.seriesStyles?.ma2).toMatchObject({
      lineWidth: 2,
      visible: true,
    });
  });

  it('normalizes representative multi-series indicator styles', () => {
    expect(Object.keys(normalizeIndicatorSeriesStyles('BOLL', [20, 2], undefined, '#9b8cff', 1))).toEqual([
      'up',
      'mid',
      'down',
    ]);
    expect(Object.keys(normalizeIndicatorSeriesStyles('MACD', [12, 26, 9], undefined, '#2f81f7', 1))).toEqual([
      'dif',
      'dea',
      'macd',
    ]);
    expect(Object.keys(normalizeIndicatorSeriesStyles('KDJ', [9, 3, 3], undefined, '#16c784', 1))).toEqual([
      'k',
      'd',
      'j',
    ]);
  });
});
