import { dispose, init, type Chart } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartId } from '../../types/domain';
import { registerKLineForgeIndicators } from '../indicators/klineIndicatorRegistry';
import { registerChartExportHandle, unregisterChartExportHandle } from './chartExportRegistry';

interface UseKLineChartInstanceParams {
  chartId: ChartId;
  chartRef: MutableRefObject<Chart | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onInitError: (message: string) => void;
  theme: 'dark' | 'light';
}

export function useKLineChartInstance({
  chartId,
  chartRef,
  containerRef,
  onInitError,
  theme,
}: UseKLineChartInstanceParams): void {
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = init(container);
    chartRef.current = chart;

    if (!chart) {
      onInitError('Unable to initialize KLineCharts.');
      return;
    }

    registerKLineForgeIndicators();

    return () => {
      unregisterChartExportHandle(chartId);
      dispose(chart);
      chartRef.current = null;
    };
  }, [chartId, chartRef, containerRef, onInitError]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    registerChartExportHandle(chartId, {
      exportPng: () => chart.getConvertPictureUrl(true, 'png', theme === 'dark' ? '#0d1117' : '#ffffff'),
    });

    return () => unregisterChartExportHandle(chartId);
  }, [chartId, chartRef, theme]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const container = containerRef.current;
    let animationFrameId: number | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const resizeChart = (width: number, height: number) => {
      if (width === lastWidth && height === lastHeight) {
        return;
      }

      lastWidth = width;
      lastHeight = height;

      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;

        if (chartRef.current === chart) {
          chart.resize();
        }
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = entry?.contentRect;

      if (!box) {
        return;
      }

      resizeChart(box.width, box.height);
    });

    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
    };
  }, [chartRef, containerRef]);
}
