import { describe, expect, it } from 'vitest';
import { createDefaultSession } from '../app/defaults';
import {
  getVisibleChartIds,
  getVisibleChartIntervals,
  normalizeActiveChartId,
  normalizeChartIntervals,
  normalizeChartLayout,
  normalizeFullscreenChartId,
} from './chartLayout';

describe('chart layout helpers', () => {
  it('calculates visible chart ids for every supported layout', () => {
    expect(getVisibleChartIds(1)).toEqual(['left']);
    expect(getVisibleChartIds(2)).toEqual(['left', 'right']);
    expect(getVisibleChartIds(3)).toEqual(['left', 'right', 'third']);
    expect(getVisibleChartIds(4)).toEqual(['left', 'right', 'third', 'fourth']);
  });

  it('calculates visible intervals for every supported layout', () => {
    const session = {
      ...createDefaultSession(1),
      chartIntervals: {
        left: '1m' as const,
        right: '15m' as const,
        third: '6h' as const,
        fourth: '1w' as const,
      },
    };

    expect(getVisibleChartIntervals({ ...session, chartLayout: 1 })).toEqual(['1m']);
    expect(getVisibleChartIntervals({ ...session, chartLayout: 2 })).toEqual(['1m', '15m']);
    expect(getVisibleChartIntervals({ ...session, chartLayout: 3 })).toEqual(['1m', '15m', '6h']);
    expect(getVisibleChartIntervals({ ...session, chartLayout: 4 })).toEqual(['1m', '15m', '6h', '1w']);
  });

  it('normalizes layout, intervals, active chart and fullscreen chart values', () => {
    expect(normalizeChartLayout(3)).toBe(3);
    expect(normalizeChartLayout(7)).toBe(2);
    expect(normalizeChartIntervals({ third: '12h' }, '15m', '4h')).toEqual({
      left: '15m',
      right: '4h',
      third: '12h',
      fourth: '1d',
    });
    expect(normalizeActiveChartId('fourth', 2)).toBe('left');
    expect(normalizeActiveChartId('right', 2)).toBe('right');
    expect(normalizeFullscreenChartId('third', 2)).toBeNull();
    expect(normalizeFullscreenChartId('third', 3)).toBe('third');
  });
});
