import type { Chart } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartSettings } from '../../types/domain';
import { createChartStyles } from './chartStyles';

interface UseChartStyleSettingsParams {
  chartRef: MutableRefObject<Chart | null>;
  settings: ChartSettings;
}

export function useChartStyleSettings({ chartRef, settings }: UseChartStyleSettingsParams): void {
  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.setStyles(createChartStyles(settings));
  }, [chartRef, settings]);
}

