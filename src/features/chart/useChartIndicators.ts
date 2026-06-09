import type { Chart } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartId, Interval, MarketType } from '../../types/domain';
import { getIndicatorConfigs } from '../indicators/indicatorConfigRepository';

interface UseChartIndicatorsParams {
  chartId: ChartId;
  chartRef: MutableRefObject<Chart | null>;
  indicatorRevision: number;
  interval: Interval;
  market: MarketType;
  symbol: string;
}

export function useChartIndicators({
  chartId,
  chartRef,
  indicatorRevision,
  interval,
  market,
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

        chart.createIndicator(
          {
            id: config.id,
            name: config.name,
            calcParams: config.calcParams,
            styles: {
              lines: [
                {
                  color: config.color,
                  size: config.lineWidth,
                },
              ],
            },
          },
          {
            isStack: true,
            pane: config.pane === 'main' ? { id: 'candle_pane' } : { id: `${chartId}-${config.name}-pane` },
          },
        );
      }
    });

    return () => {
      active = false;
    };
  }, [chartId, chartRef, indicatorRevision, interval, market, symbol]);
}

