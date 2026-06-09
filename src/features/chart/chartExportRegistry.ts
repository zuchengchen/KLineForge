import type { ChartId } from '../../types/domain';

export interface ChartExportHandle {
  exportPng: () => string;
}

const handles: Partial<Record<ChartId, ChartExportHandle>> = {};

export function registerChartExportHandle(chartId: ChartId, handle: ChartExportHandle): void {
  handles[chartId] = handle;
}

export function unregisterChartExportHandle(chartId: ChartId): void {
  delete handles[chartId];
}

export function getChartExportHandle(chartId: ChartId): ChartExportHandle | null {
  return handles[chartId] ?? null;
}
