import type { Chart, Crosshair } from 'klinecharts';
import type { MutableRefObject } from 'react';
import type { ChartId } from '../../types/domain';

interface CrosshairSyncEvent {
  chartId: ChartId;
  timestamp: number;
}

const crosshairSyncTarget = new EventTarget();
const crosshairSyncEventName = 'klineforge:crosshair-sync';

export function attachCrosshairSync(
  chart: Chart,
  chartId: ChartId,
  lastEmittedTimestampRef: MutableRefObject<number | null>,
): () => void {
  const emitCrosshair = (data?: unknown) => {
    const timestamp = (data as Crosshair | undefined)?.timestamp;

    if (typeof timestamp !== 'number' || timestamp === lastEmittedTimestampRef.current) {
      return;
    }

    lastEmittedTimestampRef.current = timestamp;
    crosshairSyncTarget.dispatchEvent(
      new CustomEvent<CrosshairSyncEvent>(crosshairSyncEventName, {
        detail: { chartId, timestamp },
      }),
    );
  };

  const applyCrosshair = (event: Event) => {
    const detail = (event as CustomEvent<CrosshairSyncEvent>).detail;

    if (detail.chartId === chartId) {
      return;
    }

    const point = chart.convertToPixel({ timestamp: detail.timestamp });

    if ('x' in point && typeof point.x === 'number') {
      chart.executeAction('onCrosshairChange', { x: point.x });
    }
  };

  chart.subscribeAction('onCrosshairChange', emitCrosshair);
  crosshairSyncTarget.addEventListener(crosshairSyncEventName, applyCrosshair);

  return () => {
    chart.unsubscribeAction('onCrosshairChange', emitCrosshair);
    crosshairSyncTarget.removeEventListener(crosshairSyncEventName, applyCrosshair);
  };
}

