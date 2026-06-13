import type { KLineData } from 'klinecharts';
import { describe, expect, it } from 'vitest';
import type { IndicatorConfig } from '../../types/domain';
import { hitTestIndicatorLine } from './indicatorHitTesting';

const dataList: KLineData[] = [
  { timestamp: 1, open: 10, high: 11, low: 9, close: 10 },
  { timestamp: 2, open: 20, high: 21, low: 19, close: 20 },
  { timestamp: 3, open: 30, high: 31, low: 29, close: 30 },
];

const config: IndicatorConfig = {
  id: 'ma',
  schemaVersion: 1,
  market: 'usdM',
  symbol: 'BTCUSDT',
  chartId: 'left',
  interval: '5m',
  name: 'MA',
  pane: 'main',
  visible: true,
  calcParams: [2],
  color: '#fff',
  lineWidth: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe('indicator hit testing', () => {
  it('selects an indicator when the pointer is near a calculated line segment', () => {
    const hit = hitTestIndicatorLine({
      config,
      dataList,
      point: { x: 24, y: 74 },
      tolerance: 8,
      toPixel: ({ timestamp, value }) => ({ x: timestamp * 10, y: 100 - value }),
    });

    expect(hit).toBe('ma');
  });

  it('ignores distant points', () => {
    const hit = hitTestIndicatorLine({
      config,
      dataList,
      point: { x: 20, y: 5 },
      tolerance: 6,
      toPixel: ({ timestamp, value }) => ({ x: timestamp * 10, y: 100 - value }),
    });

    expect(hit).toBeNull();
  });
});
