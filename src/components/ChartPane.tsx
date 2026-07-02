import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  LineSeries,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineWidth,
  type LogicalRange,
  type Time,
} from 'lightweight-charts';
import { createEffect, onCleanup, type Accessor } from 'solid-js';
import type { ChartId, ChartPoint, DrawingObject, IndicatorInstance, IndicatorSeries } from '../services/types';
import { tauriResizeEventNameForTests } from '../services/tauriWindowResize';

export interface ChartPaneMetrics {
  inputRows: number;
  renderedRows: number;
  lodApplied: boolean;
  setDataMs: number;
  rafMs: number;
  updatedAt: number;
}

interface ChartPaneProps {
  chartId: ChartId;
  title: string;
  points: Accessor<ChartPoint[]>;
  indicators: Accessor<IndicatorSeries[]>;
  indicatorInstances: Accessor<IndicatorInstance[]>;
  indicatorStatus: Accessor<string | undefined>;
  drawings: Accessor<DrawingObject[]>;
  liveStatus: Accessor<{ source: string; isClosed: boolean; time: number } | undefined>;
  resetKey?: Accessor<string>;
  fitKey?: Accessor<string>;
  fitNextDataKey?: Accessor<string>;
  theme: Accessor<string>;
  syncCrosshair?: Accessor<{ time: number; price: number } | null>;
  onCrosshairMove?: (point: { time: number; price: number } | null) => void;
  onReady?: (actions: { exportPng: () => string }) => void;
  onPerformanceUpdate?: (metrics: ChartPaneMetrics) => void;
}

export function ChartPane(props: ChartPaneProps) {
  const containerRef: { current?: HTMLDivElement } = {};
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  let latestResetKey: string | undefined;
  let latestFitKey: string | undefined;
  let latestFitNextDataKey: string | undefined;
  let shouldFitNextData = true;
  let previousInputPoints: ChartPoint[] | undefined;
  let currentRenderedRows = 0;
  let currentLodApplied = false;
  let lastAppliedCrosshair: { time: number; price: number } | null = null;
  let fitContentFrame: number | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const priceLines = new Map<string, IPriceLine>();
  const drawingSeries = new Map<string, ISeriesApi<'Line'>>();
  const indicatorSeriesMap = new Map<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>();

  const applyChartSize = () => {
    if (!containerRef.current || !chart) {
      return false;
    }

    chart.applyOptions({
      height: containerRef.current.clientHeight,
      width: containerRef.current.clientWidth,
    });

    return true;
  };

  const cancelScheduledFit = () => {
    if (fitContentFrame === undefined) {
      return;
    }

    window.cancelAnimationFrame(fitContentFrame);
    fitContentFrame = undefined;
  };

  const scheduleFitChartContent = () => {
    if (!chart || !shouldFitChartAfterResize({ renderedRows: currentRenderedRows })) {
      return false;
    }

    cancelScheduledFit();

    fitContentFrame = window.requestAnimationFrame(() => {
      fitContentFrame = undefined;
      if (!chart || !shouldFitChartAfterResize({ renderedRows: currentRenderedRows })) {
        return;
      }

      applyChartSize();
      chart.timeScale().fitContent();
    });

    return true;
  };

  const fitChartContent = () => {
    if (!chart || !shouldFitChartAfterResize({ renderedRows: currentRenderedRows })) {
      return false;
    }

    applyChartSize();
    chart.timeScale().fitContent();
    scheduleFitChartContent();

    return true;
  };

  const resize = () => {
    if (!applyChartSize()) {
      return;
    }

    scheduleFitChartContent();
  };

  createEffect(() => {
    if (!containerRef.current || chart) {
      return;
    }

    chart = createChart(containerRef.current, {
      autoSize: false,
      handleScale: {
        mouseWheel: true,
      },
      handleScroll: {
        mouseWheel: false,
        vertTouchDrag: false,
      },
      layout: {
        background: { type: ColorType.Solid, color: props.theme() === 'light' ? '#f7f8fb' : '#101318' },
        textColor: props.theme() === 'light' ? '#1f2937' : '#d6dde8',
        attributionLogo: false,
      },
      grid: {
        horzLines: { color: props.theme() === 'light' ? '#e3e7ef' : '#242a35' },
        vertLines: { color: props.theme() === 'light' ? '#e3e7ef' : '#242a35' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: props.theme() === 'light' ? '#ccd3df' : '#303847',
      },
      timeScale: {
        borderColor: props.theme() === 'light' ? '#ccd3df' : '#303847',
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: 'en-US',
      },
    });
    candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22ab94',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#22ab94',
      wickDownColor: '#f23645',
    });
    chart.panes()[0]?.setStretchFactor(8);
    chart.panes()[1]?.setStretchFactor(2);
    chart.panes()[2]?.setStretchFactor(2);
    chart.panes()[3]?.setStretchFactor(2);
    chart.panes()[4]?.setStretchFactor(2);
    chart.subscribeCrosshairMove((param) => {
      if (!props.onCrosshairMove || !param.time || !candleSeries) {
        props.onCrosshairMove?.(null);
        return;
      }

      const row = param.seriesData.get(candleSeries);
      const price = row && 'close' in row ? row.close : undefined;
      props.onCrosshairMove(typeof price === 'number' ? { time: param.time as number, price } : null);
    });
    props.onReady?.({
      exportPng: () => chart?.takeScreenshot(true, true).toDataURL('image/png') ?? '',
    });
    registerChartDebugHandle(props.chartId, {
      getVisibleLogicalRange: () => chart?.timeScale().getVisibleLogicalRange() ?? null,
      getLastAppliedCrosshair: () => lastAppliedCrosshair,
    });
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', resize);
    window.addEventListener(tauriResizeEventNameForTests(), resize);
  });

  createEffect(() => {
    const nextResetKey = props.resetKey?.();

    if (nextResetKey !== latestResetKey) {
      latestResetKey = nextResetKey;
      shouldFitNextData = true;
    }
  });

  createEffect(() => {
    const nextFitKey = props.fitKey?.();

    if (nextFitKey !== latestFitKey) {
      latestFitKey = nextFitKey;

      if (!fitChartContent()) {
        shouldFitNextData = true;
      }
    }
  });

  createEffect(() => {
    const nextFitNextDataKey = props.fitNextDataKey?.();

    if (nextFitNextDataKey !== latestFitNextDataKey) {
      latestFitNextDataKey = nextFitNextDataKey;
      shouldFitNextData = true;
    }
  });

  createEffect(() => {
    if (!chart) {
      return;
    }

    const light = props.theme() === 'light';
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: light ? '#f7f8fb' : '#101318' },
        textColor: light ? '#1f2937' : '#d6dde8',
      },
      grid: {
        horzLines: { color: light ? '#e3e7ef' : '#242a35' },
        vertLines: { color: light ? '#e3e7ef' : '#242a35' },
      },
    });
  });

  createEffect(() => {
    const points = props.points();
    const startedAt = performance.now();
    const renderData = createRenderablePoints(points);
    const renderedPoints = renderData.points;
    const dataReferenceChanged = points !== previousInputPoints;
    const shouldFitContent = shouldAutoFitChartData({
      dataReferenceChanged,
      hasPreviousData: previousInputPoints !== undefined,
      pendingReset: shouldFitNextData,
      renderedRows: renderedPoints.length,
    });

    currentLodApplied = renderData.lodApplied;
    currentRenderedRows = renderedPoints.length;
    previousInputPoints = points;

    candleSeries?.setData(
      renderedPoints.map((point) => ({
        time: point.time as Time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })),
    );
    const setDataMs = Math.round(performance.now() - startedAt);

    if (renderedPoints.length > 0) {
      if (shouldFitContent) {
        if (fitChartContent()) {
          shouldFitNextData = false;
        }
      }
    }

    requestAnimationFrame(() => {
      props.onPerformanceUpdate?.({
        inputRows: points.length,
        renderedRows: renderedPoints.length,
        lodApplied: renderData.lodApplied,
        setDataMs,
        rafMs: Math.round(performance.now() - startedAt),
        updatedAt: Date.now(),
      });
    });
  });

  createEffect(() => {
    if (!chart) {
      return;
    }

    const indicators = currentLodApplied ? [] : props.indicators();
    const nextIds = new Set(indicators.map((series) => series.id));

    for (const [id, series] of indicatorSeriesMap) {
      if (!nextIds.has(id)) {
        chart.removeSeries(series);
        indicatorSeriesMap.delete(id);
      }
    }

    for (const indicator of indicators) {
      const series = getOrCreateIndicatorSeries(chart, indicatorSeriesMap, indicator);
      applyIndicatorSeriesOptions(series, indicator);
      series.setData(
        indicator.data.map((point) => ({
          time: point.time as Time,
          value: point.value,
          color: point.color,
        })),
      );
    }
  });

  createEffect(() => {
    const drawings = props.drawings();

    if (!chart || !candleSeries) {
      return;
    }

    for (const line of priceLines.values()) {
      candleSeries.removePriceLine(line);
    }
    priceLines.clear();
    for (const series of drawingSeries.values()) {
      chart.removeSeries(series);
    }
    drawingSeries.clear();

    for (const drawing of drawings) {
      renderDrawing(chart, candleSeries, priceLines, drawingSeries, drawing);
    }
  });

  createEffect(() => {
    const crosshair = props.syncCrosshair?.();

    if (!chart || !candleSeries) {
      return;
    }

    if (!crosshair) {
      lastAppliedCrosshair = null;
      chart.clearCrosshairPosition();
      return;
    }

    lastAppliedCrosshair = crosshair;
    chart.setCrosshairPosition(crosshair.price, crosshair.time as Time, candleSeries);
  });

  onCleanup(() => {
    cancelScheduledFit();
    window.removeEventListener('resize', resize);
    window.removeEventListener(tauriResizeEventNameForTests(), resize);
    resizeObserver?.disconnect();
    unregisterChartDebugHandle(props.chartId);
    if (candleSeries) {
      for (const line of priceLines.values()) {
        candleSeries.removePriceLine(line);
      }
    }
    priceLines.clear();
    if (chart) {
      for (const series of drawingSeries.values()) {
        chart.removeSeries(series);
      }
      for (const series of indicatorSeriesMap.values()) {
        chart.removeSeries(series);
      }
    }
    drawingSeries.clear();
    indicatorSeriesMap.clear();
    chart?.remove();
    chart = undefined;
  });

  return (
    <section class="chart-pane">
      <header class="chart-pane__header">
        <span>{props.title}</span>
        <span>
          {props.liveStatus()?.source ?? 'history'} · {props.liveStatus()?.isClosed ? 'closed' : 'live'} ·{' '}
          {props.indicatorStatus() ?? indicatorLegend(props.indicatorInstances())}
        </span>
      </header>
      <div ref={(element) => { containerRef.current = element; }} class="chart-pane__surface" />
    </section>
  );
}

function getOrCreateIndicatorSeries(
  chart: IChartApi,
  seriesMap: Map<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>,
  indicator: IndicatorSeries,
) {
  const current = seriesMap.get(indicator.id);

  if (current) {
    return current;
  }

  const options = indicatorSeriesOptions(indicator);
  const series =
    indicator.seriesType === 'histogram'
      ? chart.addSeries(HistogramSeries, options, indicator.pane)
      : chart.addSeries(LineSeries, options, indicator.pane);

  seriesMap.set(indicator.id, series);

  if (indicator.priceScaleId === 'volume') {
    applyVolumeScaleMargins(chart);
  }

  return series;
}

function applyVolumeScaleMargins(chart: IChartApi) {
  try {
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });
  } catch {
    // The custom scale exists only after Lightweight Charts attaches the volume series.
  }
}

function applyIndicatorSeriesOptions(
  series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'>,
  indicator: IndicatorSeries,
) {
  series.applyOptions(indicatorSeriesOptions(indicator));
}

function indicatorSeriesOptions(indicator: IndicatorSeries) {
  return {
    color: indicator.style.color,
    lineWidth: clampLineWidth(indicator.style.lineWidth),
    lineStyle: toLightweightLineStyle(indicator.style.lineStyle),
    priceFormat: indicator.seriesType === 'histogram' && indicator.priceScaleId === 'volume'
      ? { type: 'volume' as const }
      : { type: 'price' as const, precision: 4, minMove: 0.0001 },
    priceLineVisible: false,
    lastValueVisible: true,
    ...(indicator.priceScaleId ? { priceScaleId: indicator.priceScaleId } : {}),
  };
}

export function toLightweightLineStyle(style: IndicatorSeries['style']['lineStyle']) {
  switch (style) {
    case 'dotted':
      return LineStyle.Dotted;
    case 'dashed':
      return LineStyle.Dashed;
    case 'large-dashed':
      return LineStyle.LargeDashed;
    case 'sparse-dotted':
      return LineStyle.SparseDotted;
    case 'solid':
    default:
      return LineStyle.Solid;
  }
}

function clampLineWidth(width: number): LineWidth {
  if (width <= 1) {
    return 1;
  }
  if (width === 2) {
    return 2;
  }
  if (width === 3) {
    return 3;
  }

  return 4;
}

function indicatorLegend(instances: IndicatorInstance[]) {
  const enabled = instances.filter((instance) => instance.enabled).map((instance) => instance.name);

  if (enabled.length === 0) {
    return 'No indicators';
  }

  return enabled.slice(0, 6).join(' · ') + (enabled.length > 6 ? ` · +${enabled.length - 6}` : '');
}

function renderDrawing(
  chart: IChartApi,
  candleSeries: ISeriesApi<'Candlestick'>,
  priceLines: Map<string, IPriceLine>,
  drawingSeries: Map<string, ISeriesApi<'Line'>>,
  drawing: DrawingObject,
) {
  const color = drawing.payload.color ?? '#f6c343';

  if (drawing.drawingType === 'horizontal-line' && typeof drawing.payload.price === 'number') {
    const line = candleSeries.createPriceLine({
      price: drawing.payload.price,
      color,
      lineWidth: 1,
      title: drawing.payload.text ?? drawing.drawingType,
    });
    priceLines.set(drawing.id, line);
    return;
  }

  const points = drawingPoints(drawing);

  if (!points) {
    return;
  }

  if (drawing.drawingType === 'rectangle') {
    const [start, end] = points;
    const startEdgeEnd = start.time === end.time ? start.time + 1 : start.time + Math.max(1, Math.round((end.time - start.time) * 0.01));
    const endEdgeEnd = end.time + Math.max(1, Math.round((end.time - start.time) * 0.01));
    addDrawingLine(chart, drawingSeries, `${drawing.id}:top`, color, [
      { time: start.time as Time, value: start.value },
      { time: end.time as Time, value: start.value },
    ]);
    addDrawingLine(chart, drawingSeries, `${drawing.id}:right`, color, [
      { time: end.time as Time, value: start.value },
      { time: endEdgeEnd as Time, value: end.value },
    ]);
    addDrawingLine(chart, drawingSeries, `${drawing.id}:bottom`, color, [
      { time: start.time as Time, value: end.value },
      { time: end.time as Time, value: end.value },
    ]);
    addDrawingLine(chart, drawingSeries, `${drawing.id}:left`, color, [
      { time: start.time as Time, value: start.value },
      { time: startEdgeEnd as Time, value: end.value },
    ]);
    return;
  }

  if (drawing.drawingType === 'text') {
    const line = candleSeries.createPriceLine({
      price: points[0].value,
      color,
      lineWidth: 1,
      title: drawing.payload.text ?? 'Text',
    });
    priceLines.set(drawing.id, line);
    return;
  }

  addDrawingLine(chart, drawingSeries, drawing.id, color, points.map((point) => ({ time: point.time as Time, value: point.value })));

  if (drawing.drawingType === 'measurement' && drawing.payload.text) {
    const line = candleSeries.createPriceLine({
      price: points[1].value,
      color,
      lineWidth: 1,
      title: drawing.payload.text,
    });
    priceLines.set(`${drawing.id}:label`, line);
  }
}

function drawingPoints(drawing: DrawingObject): [{ time: number; value: number }, { time: number; value: number }] | null {
  const { startTime, startPrice, endTime, endPrice } = drawing.payload;

  if (
    typeof startTime !== 'number' ||
    typeof startPrice !== 'number' ||
    typeof endTime !== 'number' ||
    typeof endPrice !== 'number'
  ) {
    return null;
  }

  return [
    { time: startTime, value: startPrice },
    { time: endTime === startTime ? endTime + 1 : endTime, value: endPrice },
  ];
}

function addDrawingLine(
  chart: IChartApi,
  drawingSeries: Map<string, ISeriesApi<'Line'>>,
  id: string,
  color: string,
  data: { time: Time; value: number }[],
) {
  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
  });

  series.setData(data);
  drawingSeries.set(id, series);
}

const maxDetailedRows = 200_000;
const maxLodRows = 160_000;

export function shouldAutoFitChartData(params: {
  dataReferenceChanged: boolean;
  hasPreviousData: boolean;
  pendingReset: boolean;
  renderedRows: number;
}) {
  if (params.renderedRows <= 0) {
    return false;
  }

  return !params.hasPreviousData || (params.pendingReset && params.dataReferenceChanged);
}

export function shouldFitChartAfterResize(params: { renderedRows: number }) {
  return params.renderedRows > 0;
}

type ChartDebugHandle = {
  getVisibleLogicalRange: () => LogicalRange | null;
  getLastAppliedCrosshair: () => { time: number; price: number } | null;
};

type ChartDebugWindow = Window & {
  __KLINEFORGE_CHART_DEBUG__?: Partial<Record<ChartId, ChartDebugHandle>>;
};

function registerChartDebugHandle(chartId: ChartId, handle: ChartDebugHandle) {
  if (typeof window === 'undefined') {
    return;
  }

  const debugWindow = window as ChartDebugWindow;
  debugWindow.__KLINEFORGE_CHART_DEBUG__ ??= {};
  debugWindow.__KLINEFORGE_CHART_DEBUG__[chartId] = handle;
}

function unregisterChartDebugHandle(chartId: ChartId) {
  if (typeof window === 'undefined') {
    return;
  }

  delete (window as ChartDebugWindow).__KLINEFORGE_CHART_DEBUG__?.[chartId];
}

function createRenderablePoints(points: ChartPoint[]) {
  if (points.length <= maxDetailedRows) {
    return {
      points,
      lodApplied: false,
    };
  }

  const bucketSize = Math.ceil(points.length / maxLodRows);
  const rendered: ChartPoint[] = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const first = points[index];
    const last = points[Math.min(index + bucketSize - 1, points.length - 1)];
    let high = first.high;
    let low = first.low;
    let volume = 0;

    for (let bucketIndex = index; bucketIndex < Math.min(index + bucketSize, points.length); bucketIndex += 1) {
      const point = points[bucketIndex];

      high = Math.max(high, point.high);
      low = Math.min(low, point.low);
      volume += point.volume;
    }

    rendered.push({
      time: first.time,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    });
  }

  return {
    points: rendered,
    lodApplied: true,
  };
}
