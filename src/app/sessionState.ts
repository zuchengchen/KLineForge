import { createDefaultSession } from './defaults';
import {
  getVisibleChartIds,
  isChartId,
  isInterval,
  normalizeActiveChartId,
  normalizeChartIntervals,
  normalizeChartLayout,
  normalizeFullscreenChartId,
} from '../types/chartLayout';
import type { LastSessionState } from '../types/domain';

export function normalizeSessionState(
  persistedSession: Partial<LastSessionState> | null | undefined,
  fallback: LastSessionState = createDefaultSession(),
): LastSessionState {
  if (!persistedSession) {
    return fallback;
  }

  const chartLayout = normalizeChartLayout(persistedSession.chartLayout, fallback.chartLayout);
  const leftInterval = isInterval(persistedSession.leftInterval) ? persistedSession.leftInterval : fallback.leftInterval;
  const rightInterval = isInterval(persistedSession.rightInterval) ? persistedSession.rightInterval : fallback.rightInterval;
  const chartIntervals = normalizeChartIntervals(persistedSession.chartIntervals, leftInterval, rightInterval);
  const activeChartId = isChartId(persistedSession.activeChartId)
    ? normalizeActiveChartId(persistedSession.activeChartId, chartLayout)
    : getVisibleChartIds(chartLayout)[0];
  const fullscreenChartId =
    persistedSession.fullscreenChartId === null || isChartId(persistedSession.fullscreenChartId)
      ? normalizeFullscreenChartId(persistedSession.fullscreenChartId ?? null, chartLayout)
      : null;

  return {
    ...fallback,
    ...persistedSession,
    schemaVersion: 1,
    chartLayout,
    chartIntervals,
    leftInterval: chartIntervals.left,
    rightInterval: chartIntervals.right,
    activeChartId,
    fullscreenChartId,
  };
}
