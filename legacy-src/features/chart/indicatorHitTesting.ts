import type { Coordinate, KLineData } from 'klinecharts';
import type { IndicatorConfig } from '../../types/domain';
import { calculateIndicatorResultForConfig } from '../indicators/klineIndicatorRegistry';
import {
  getIndicatorSeriesDefinitions,
  normalizeIndicatorConfig,
} from '../indicators/indicatorSeriesStyles';

export interface IndicatorHitTestCandidate {
  config: IndicatorConfig;
  dataList: KLineData[];
  point: Coordinate;
  toPixel: (point: { timestamp: number; value: number; paneId: string }) => Coordinate | null;
  tolerance?: number;
}

function distanceToSegment(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

export function hitTestIndicatorLine({
  config,
  dataList,
  point,
  toPixel,
  tolerance = 8,
}: IndicatorHitTestCandidate): string | null {
  const normalizedConfig = normalizeIndicatorConfig(config);

  if (!normalizedConfig.visible || dataList.length < 2) {
    return null;
  }

  const paneId = normalizedConfig.pane === 'main' ? 'candle_pane' : `${normalizedConfig.chartId}-${normalizedConfig.name}-pane`;
  const results = calculateIndicatorResultForConfig(
    dataList,
    normalizedConfig.name,
    normalizedConfig.calcParams,
    normalizedConfig.source ?? 'close',
  );
  const definitions = getIndicatorSeriesDefinitions(normalizedConfig.name, normalizedConfig.calcParams).filter(
    (series) => series.kind === 'line' && normalizedConfig.seriesStyles?.[series.key]?.visible !== false,
  );

  for (const series of definitions) {
    let previous: Coordinate | null = null;

    for (let index = 0; index < dataList.length; index += 1) {
      const value = results[index]?.[series.key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        previous = null;
        continue;
      }

      const pixel = toPixel({
        timestamp: dataList[index].timestamp,
        value,
        paneId,
      });

      if (!pixel || !Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) {
        previous = null;
        continue;
      }

      if (previous && distanceToSegment(point, previous, pixel) <= tolerance) {
        return normalizedConfig.id;
      }

      if (Math.hypot(point.x - pixel.x, point.y - pixel.y) <= tolerance) {
        return normalizedConfig.id;
      }

      previous = pixel;
    }
  }

  return null;
}
