import type { Chart } from 'klinecharts';
import type { ChartId } from '../../types/domain';
import type { KlineStream } from '../market-data';

interface ChartDebugHandle {
  getDataSummary: () => {
    count: number;
    firstTimestamp: number | null;
    lastClose: number | null;
    lastTimestamp: number | null;
  };
  reconnect: () => void;
}

declare global {
  interface Window {
    __KLINEFORGE_CHART_DEBUG__?: Partial<Record<ChartId, ChartDebugHandle>>;
  }
}

export function registerChartDebugHandle(chartId: ChartId, chart: Chart, stream: KlineStream): void {
  globalThis.window.__KLINEFORGE_CHART_DEBUG__ ??= {};
  globalThis.window.__KLINEFORGE_CHART_DEBUG__[chartId] = {
    getDataSummary: () => {
      const data = chart.getDataList();

      return {
        count: data.length,
        firstTimestamp: data[0]?.timestamp ?? null,
        lastClose: data.at(-1)?.close ?? null,
        lastTimestamp: data.at(-1)?.timestamp ?? null,
      };
    },
    reconnect: () => stream.reconnect?.(),
  };
}

export function unregisterChartDebugHandle(chartId: ChartId): void {
  delete globalThis.window.__KLINEFORGE_CHART_DEBUG__?.[chartId];
}
