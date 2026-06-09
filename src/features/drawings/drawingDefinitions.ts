import type {
  ChartId,
  DrawingObject,
  DrawingPoint,
  DrawingStyle,
  DrawingType,
  Interval,
  MarketType,
} from '../../types/domain';

export interface DrawingKey {
  market: MarketType;
  symbol: string;
  chartId: ChartId;
  interval: Interval;
}

export interface DrawingDraft extends DrawingKey {
  type: DrawingType;
  points: DrawingPoint[];
  text?: string;
  style?: Partial<DrawingStyle>;
}

export const defaultDrawingStyle: DrawingStyle = {
  lineColor: '#f5b84b',
  lineWidth: 2,
  lineStyle: 'solid',
  opacity: 1,
  textColor: '#f8fafc',
  textSize: 13,
  fillColor: '#2f81f7',
  fillOpacity: 0.12,
};

export function drawingPointCount(type: DrawingType): number {
  if (type === 'horizontal-line' || type === 'vertical-line' || type === 'text') {
    return 1;
  }

  return 2;
}

export function createDrawingObject(draft: DrawingDraft, now = Date.now()): DrawingObject {
  const normalizedSymbol = draft.symbol.toUpperCase();

  return {
    id: `${draft.market}:${normalizedSymbol}:${draft.chartId}:${draft.interval}:${draft.type}:${now}`,
    schemaVersion: 1,
    market: draft.market,
    symbol: normalizedSymbol,
    chartId: draft.chartId,
    interval: draft.interval,
    type: draft.type,
    points: draft.points,
    text: draft.text,
    style: {
      ...defaultDrawingStyle,
      ...draft.style,
    },
    locked: false,
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeDrawingKey(key: DrawingKey): DrawingKey {
  return {
    ...key,
    symbol: key.symbol.toUpperCase(),
  };
}
