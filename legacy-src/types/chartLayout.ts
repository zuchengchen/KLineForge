import { supportedIntervals, type ChartId, type ChartIntervalMap, type ChartLayout, type Interval, type LastSessionState } from './domain';

export const allChartIds: readonly ChartId[] = ['left', 'right', 'third', 'fourth'] as const;

export const chartLayoutModes: readonly ChartLayout[] = [1, 2, 3, 4] as const;

export const defaultChartIntervals: ChartIntervalMap = {
  left: '5m',
  right: '1h',
  third: '4h',
  fourth: '1d',
};

export const chartNameI18nKeys: Record<ChartId, string> = {
  left: 'chartNames.left',
  right: 'chartNames.right',
  third: 'chartNames.third',
  fourth: 'chartNames.fourth',
};

export const chartLayoutI18nKeys: Record<ChartLayout, string> = {
  1: 'chartLayouts.one',
  2: 'chartLayouts.two',
  3: 'chartLayouts.three',
  4: 'chartLayouts.four',
};

const supportedIntervalSet = new Set<Interval>(supportedIntervals);

export function isChartId(value: unknown): value is ChartId {
  return typeof value === 'string' && allChartIds.includes(value as ChartId);
}

export function isInterval(value: unknown): value is Interval {
  return supportedIntervalSet.has(value as Interval);
}

export function isChartLayout(value: unknown): value is ChartLayout {
  return typeof value === 'number' && chartLayoutModes.includes(value as ChartLayout);
}

export function normalizeChartLayout(value: unknown, fallback: ChartLayout = 2): ChartLayout {
  return isChartLayout(value) ? value : fallback;
}

export function getVisibleChartIds(layout: ChartLayout): ChartId[] {
  return allChartIds.slice(0, layout);
}

export function getChartNumber(chartId: ChartId): number {
  return allChartIds.indexOf(chartId) + 1;
}

export function getDefaultInterval(chartId: ChartId): Interval {
  return defaultChartIntervals[chartId];
}

export function normalizeChartIntervals(
  value: Partial<Record<ChartId, unknown>> | undefined,
  legacyLeftInterval?: Interval,
  legacyRightInterval?: Interval,
): ChartIntervalMap {
  return {
    left: isInterval(value?.left) ? value.left : legacyLeftInterval ?? defaultChartIntervals.left,
    right: isInterval(value?.right) ? value.right : legacyRightInterval ?? defaultChartIntervals.right,
    third: isInterval(value?.third) ? value.third : defaultChartIntervals.third,
    fourth: isInterval(value?.fourth) ? value.fourth : defaultChartIntervals.fourth,
  };
}

export function getSessionChartInterval(session: LastSessionState, chartId: ChartId): Interval {
  return session.chartIntervals[chartId];
}

export function getVisibleChartIntervals(session: LastSessionState): Interval[] {
  return getVisibleChartIds(session.chartLayout).map((chartId) => getSessionChartInterval(session, chartId));
}

export function normalizeActiveChartId(chartId: ChartId, layout: ChartLayout): ChartId {
  const visibleChartIds = getVisibleChartIds(layout);

  return visibleChartIds.includes(chartId) ? chartId : visibleChartIds[0];
}

export function normalizeFullscreenChartId(chartId: ChartId | null, layout: ChartLayout): ChartId | null {
  if (chartId === null) {
    return null;
  }

  return getVisibleChartIds(layout).includes(chartId) ? chartId : null;
}
