import type { Chart, Crosshair } from 'klinecharts';
import type { MutableRefObject } from 'react';
import type { ChartId, Interval } from '../../types/domain';
import { alignTimestampToIntervalOpenTime } from '../market-data/intervals';

interface CrosshairSyncEvent {
  chartId: ChartId;
  interval: Interval;
  timestamp: number;
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

  const emitCrosshair = (data?: unknown) => {
    if (applyingSyncedCrosshair) {
      return;
    }

    const timestamp = (data as Crosshair | undefined)?.timestamp;

    if (typeof timestamp !== 'number' || timestamp === lastEmittedTimestampRef.current) {
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

    const targetTimestamp = alignTimestampToIntervalOpenTime(detail.timestamp, interval);
    const point = chart.convertToPixel({ timestamp: targetTimestamp });

    if ('x' in point && typeof point.x === 'number') {
      applyingSyncedCrosshair = true;
      try {
        chart.executeAction('onCrosshairChange', { x: point.x });
      } finally {
        applyingSyncedCrosshair = false;
      }
    }
  };

  chart.subscribeAction('onCrosshairChange', emitCrosshair);
  crosshairSyncTarget.addEventListener(crosshairSyncEventName, applyCrosshair);

  return () => {
    chart.unsubscribeAction('onCrosshairChange', emitCrosshair);
    crosshairSyncTarget.removeEventListener(crosshairSyncEventName, applyCrosshair);
  };
}
