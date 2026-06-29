import type { Chart, Crosshair } from 'klinecharts';
import type { MutableRefObject } from 'react';
import type { ChartId, Interval } from '../../types/domain';
import { alignTimestampToIntervalOpenTime } from '../market-data/intervals';
import { overlayPaneId } from './chartOverlayConstants';
import { hideLinkedCrosshairHighlight, showLinkedCrosshairHighlight } from './linkedCrosshairHighlight';

interface CrosshairSyncEvent {
  chartId: ChartId;
  interval: Interval;
  timestamp: number | null;
}

const crosshairSyncTarget = new EventTarget();
const crosshairSyncEventName = 'klineforge:crosshair-sync';

export function attachCrosshairSync(
  chart: Chart,
  chartId: ChartId,
  interval: Interval,
  lastEmittedTimestampRef: MutableRefObject<number | null>,
): () => void {
  let applyingSyncedCrosshair = false;

  const emitCrosshairReset = () => {
    if (lastEmittedTimestampRef.current !== null) {
      lastEmittedTimestampRef.current = null;
      crosshairSyncTarget.dispatchEvent(
        new CustomEvent<CrosshairSyncEvent>(crosshairSyncEventName, {
          detail: { chartId, interval, timestamp: null },
        }),
      );
    }
  };

  const resolveCrosshairTimestamp = (data?: unknown): number | null => {
    const crosshair = data as Crosshair | undefined;

    if (typeof crosshair?.timestamp === 'number') {
      return crosshair.timestamp;
    }

    if (typeof crosshair?.x !== 'number') {
      return null;
    }

    const point = chart.convertFromPixel([{ x: crosshair.x }]);

    return Array.isArray(point) && typeof point[0]?.timestamp === 'number' ? point[0].timestamp : null;
  };

  const emitCrosshair = (data?: unknown) => {
    if (applyingSyncedCrosshair) {
      return;
    }

    const timestamp = resolveCrosshairTimestamp(data);

    if (typeof timestamp !== 'number') {
      emitCrosshairReset();
      return;
    }

    if (timestamp === lastEmittedTimestampRef.current) {
      return;
    }

    lastEmittedTimestampRef.current = timestamp;
    crosshairSyncTarget.dispatchEvent(
      new CustomEvent<CrosshairSyncEvent>(crosshairSyncEventName, {
        detail: { chartId, interval, timestamp },
      }),
    );
  };

  const applyCrosshair = (event: Event) => {
    const detail = (event as CustomEvent<CrosshairSyncEvent>).detail;

    if (detail.chartId === chartId) {
      return;
    }

    if (detail.timestamp === null) {
      hideLinkedCrosshairHighlight(chart);
      return;
    }

    const targetTimestamp = alignTimestampToIntervalOpenTime(detail.timestamp, interval);
    const point = chart.convertToPixel({ timestamp: targetTimestamp });

    if ('x' in point && typeof point.x === 'number') {
      const targetData = chart.getDataList().find((item) => item.timestamp === targetTimestamp);
      const targetValue = targetData?.close ?? targetData?.open;
      const valuePoint =
        typeof targetValue === 'number'
          ? chart.convertToPixel({ timestamp: targetTimestamp, value: targetValue })
          : null;
      const paneSize = typeof chart.getSize === 'function' ? chart.getSize(overlayPaneId, 'main') : null;
      const fallbackY = typeof paneSize?.height === 'number' ? paneSize.height / 2 : 0;
      const y = valuePoint && 'y' in valuePoint && typeof valuePoint.y === 'number' ? valuePoint.y : fallbackY;

      applyingSyncedCrosshair = true;
      try {
        chart.executeAction('onCrosshairChange', { x: point.x, y });
        showLinkedCrosshairHighlight(chart, targetTimestamp);
      } finally {
        applyingSyncedCrosshair = false;
      }
    }
  };

  chart.subscribeAction('onCrosshairChange', emitCrosshair);
  crosshairSyncTarget.addEventListener(crosshairSyncEventName, applyCrosshair);
  const chartDom = typeof chart.getDom === 'function' ? chart.getDom() : null;
  chartDom?.addEventListener('mouseleave', emitCrosshairReset);

  return () => {
    lastEmittedTimestampRef.current = null;
    hideLinkedCrosshairHighlight(chart);
    chart.unsubscribeAction('onCrosshairChange', emitCrosshair);
    crosshairSyncTarget.removeEventListener(crosshairSyncEventName, applyCrosshair);
    chartDom?.removeEventListener('mouseleave', emitCrosshairReset);
  };
}
