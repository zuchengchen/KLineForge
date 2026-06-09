import type { Chart, Overlay } from 'klinecharts';
import type { DrawingObject, DrawingPoint, DrawingType } from '../../types/domain';
import { drawingPointCount } from '../drawings/drawingDefinitions';
import { toDrawingPoints } from '../drawings/klineDrawingAdapter';

export const overlayPaneId = 'candle_pane';

export function createDefaultDrawingPoints(chart: Chart, type: DrawingType): DrawingPoint[] {
  const data = chart.getDataList();
  const last = data.at(-1);
  const previous = data.at(-Math.min(20, data.length)) ?? data[0] ?? last;

  if (!last) {
    return [];
  }

  const high = Number(last.high ?? last.close);
  const low = Number(last.low ?? last.close);
  const close = Number(last.close);
  const spread = Math.max(Math.abs(high - low), close * 0.002, 1);
  const pointCount = drawingPointCount(type);
  const first = {
    timestamp: previous?.timestamp ?? last.timestamp,
    price: String(close - spread),
  };
  const second = {
    timestamp: last.timestamp,
    price: String(close + spread),
  };

  if (type === 'horizontal-line' || type === 'vertical-line') {
    return [{ timestamp: last.timestamp, price: String(close) }];
  }

  if (type === 'text') {
    return [{ timestamp: last.timestamp, price: String(close + spread) }];
  }

  return pointCount === 1 ? [first] : [first, second];
}

export function persistOverlayDrawing(overlay: Overlay, drawing: DrawingObject): DrawingObject {
  return {
    ...drawing,
    points: toDrawingPoints(overlay.points),
    locked: overlay.lock,
    visible: overlay.visible,
    updatedAt: Date.now(),
  };
}

