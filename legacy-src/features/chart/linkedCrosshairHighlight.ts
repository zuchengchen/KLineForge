import { registerOverlay, type Chart, type OverlayTemplate } from 'klinecharts';
import { linkedCrosshairOverlayGroupId, overlayPaneId } from './chartOverlayConstants';

const overlayName = 'klineforgeLinkedCrosshairBarHighlight';
const overlayId = 'klineforge-linked-crosshair-highlight';
let registered = false;

export function registerLinkedCrosshairHighlightOverlay(): void {
  if (registered) {
    return;
  }

  const template: OverlayTemplate = {
    name: overlayName,
    totalStep: 1,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ chart, coordinates, bounding }) => {
      const x = coordinates[0]?.x;

      if (typeof x !== 'number') {
        return [];
      }

      const barSpace = chart.getBarSpace();
      const width = Math.max(barSpace.gapBar + 2, Math.min(barSpace.bar, 18));

      if (x < -width / 2 || x > bounding.width + width / 2) {
        return [];
      }

      const left = Math.max(0, x - width / 2);
      const right = Math.min(bounding.width, left + width);

      return [
        {
          type: 'rect',
          attrs: {
            x: left,
            y: 0,
            width: Math.max(1, right - left),
            height: bounding.height,
          },
          styles: {
            style: 'stroke_fill',
            color: 'rgba(245, 184, 75, 0.13)',
            borderColor: 'rgba(245, 184, 75, 0.72)',
            borderSize: 1,
            borderStyle: 'solid',
            borderDashedValue: [2, 2],
            borderRadius: 2,
          },
          ignoreEvent: true,
        },
      ];
    },
  };

  registerOverlay(template);
  registered = true;
}

export function showLinkedCrosshairHighlight(chart: Chart, timestamp: number): void {
  registerLinkedCrosshairHighlightOverlay();
  chart.removeOverlay({ id: overlayId });
  chart.createOverlay({
    id: overlayId,
    groupId: linkedCrosshairOverlayGroupId,
    name: overlayName,
    paneId: overlayPaneId,
    points: [{ timestamp }],
    lock: true,
    zLevel: Number.MAX_SAFE_INTEGER - 1,
  });
}

export function hideLinkedCrosshairHighlight(chart: Chart): void {
  chart.removeOverlay({ groupId: linkedCrosshairOverlayGroupId });
}
