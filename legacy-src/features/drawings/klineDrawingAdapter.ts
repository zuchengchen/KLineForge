import type { OverlayCreate, Point } from 'klinecharts';
import type { DrawingObject, DrawingPoint, DrawingStyle, DrawingType } from '../../types/domain';
import { drawingOverlayGroupId } from '../chart/chartOverlayConstants';

const overlayNameByDrawingType: Record<DrawingType, string> = {
  'trend-line': 'segment',
  'horizontal-line': 'horizontalStraightLine',
  'vertical-line': 'verticalStraightLine',
  rectangle: 'rect',
  text: 'simpleAnnotation',
  measurement: 'segment',
};

export function toOverlayPoints(points: DrawingPoint[]): Array<Partial<Point>> {
  return points.map((point) => ({
    timestamp: point.timestamp,
    value: Number(point.price),
  }));
}

export function toDrawingPoints(points: Array<Partial<Point>>): DrawingPoint[] {
  return points
    .filter((point): point is Partial<Point> & Pick<Point, 'timestamp' | 'value'> => {
      return typeof point.timestamp === 'number' && typeof point.value === 'number';
    })
    .map((point) => ({
      timestamp: point.timestamp,
      price: String(point.value),
    }));
}

export function toOverlayStyles(style: DrawingStyle): OverlayCreate['styles'] {
  const lineStyle = {
    color: style.lineColor,
    size: style.lineWidth,
    style: style.lineStyle,
  };

  return {
    line: lineStyle,
    rect: {
      color: `rgba(47, 129, 247, ${style.fillOpacity})`,
      borderColor: style.lineColor,
      borderSize: style.lineWidth,
      borderStyle: style.lineStyle,
    },
    text: {
      color: style.textColor,
      size: style.textSize,
      backgroundColor: `rgba(17, 24, 38, ${Math.max(0.25, style.opacity * 0.72)})`,
      borderColor: style.lineColor,
      borderSize: 1,
    },
  };
}

export function toOverlayCreate(drawing: DrawingObject): OverlayCreate {
  return {
    id: drawing.id,
    groupId: drawingOverlayGroupId,
    name: overlayNameByDrawingType[drawing.type],
    points: toOverlayPoints(drawing.points),
    lock: drawing.locked,
    visible: drawing.visible,
    extendData: drawing.text ?? drawing.type,
    styles: toOverlayStyles(drawing.style),
  };
}
