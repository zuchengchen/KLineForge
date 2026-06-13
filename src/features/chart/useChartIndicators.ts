import type { Chart } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartId, Interval, MarketType } from '../../types/domain';
import { getIndicatorConfigs } from '../indicators/indicatorConfigRepository';
import { getIndicatorSeriesDefinitions, normalizeIndicatorConfig } from '../indicators/indicatorSeriesStyles';

interface UseChartIndicatorsParams {
  chartId: ChartId;
  chartRef: MutableRefObject<Chart | null>;
  indicatorRevision: number;
  interval: Interval;
  market: MarketType;
  selectedIndicatorId?: string | null;
  symbol: string;
}

export function useChartIndicators({
  chartId,
  chartRef,
  indicatorRevision,
  interval,
  market,
  selectedIndicatorId = null,
  symbol,
}: UseChartIndicatorsParams): void {
  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    let active = true;

    getIndicatorConfigs({ market, symbol, chartId, interval }).then((configs) => {
      if (!active || chartRef.current !== chart) {
        return;
      }

      chart.removeIndicator();

      for (const config of configs) {
        if (!config.visible) {
          continue;
        }

        const normalizedConfig = normalizeIndicatorConfig(config);
        const selected = normalizedConfig.id === selectedIndicatorId;
        const seriesDefinitions = getIndicatorSeriesDefinitions(normalizedConfig.name, normalizedConfig.calcParams);
        const lines = seriesDefinitions
          .filter((series) => series.kind === 'line')
          .map((series) => {
            const style = normalizedConfig.seriesStyles?.[series.key];
            const visible = style?.visible ?? true;

            return {
              color: visible ? style?.color ?? normalizedConfig.color : 'rgba(0, 0, 0, 0)',
              size: visible ? (style?.lineWidth ?? normalizedConfig.lineWidth) + (selected ? 1 : 0) : 0,
              style: style?.lineStyle ?? 'solid',
              dashedValue: [4, 4],
            };
          });
        const bars = seriesDefinitions
          .filter((series) => series.kind === 'histogram')
          .map((series) => {
            const style = normalizedConfig.seriesStyles?.[series.key];
            const visible = style?.visible ?? true;
            const color = visible ? style?.color ?? normalizedConfig.color : 'rgba(0, 0, 0, 0)';

            return {
              upColor: color,
              downColor: color,
              noChangeColor: color,
              borderColor: color,
              borderSize: selected ? 2 : 1,
              borderStyle: style?.lineStyle ?? 'solid',
              borderDashedValue: [4, 4],
            };
          });

        chart.createIndicator(
          {
            id: normalizedConfig.id,
            name: normalizedConfig.name,
            calcParams: normalizedConfig.calcParams,
            extendData: {
              source: normalizedConfig.source,
            },
            styles: {
              bars,
              lines,
            },
          },
          {
            isStack: true,
            pane:
              normalizedConfig.pane === 'main'
                ? { id: 'candle_pane' }
                : { id: `${chartId}-${normalizedConfig.name}-pane` },
          },
        );
      }
    });

    return () => {
      active = false;
    };
  }, [chartId, chartRef, indicatorRevision, interval, market, selectedIndicatorId, symbol]);
}
