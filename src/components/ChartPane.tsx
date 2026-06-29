import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LogicalRange,
  type Time,
} from 'lightweight-charts';
import { createEffect, onCleanup, type Accessor } from 'solid-js';
import type { ChartPoint, DrawingObject, IndicatorSettings, IndicatorValue } from '../services/types';

export interface ChartPaneMetrics {
  inputRows: number;
  renderedRows: number;
  lodApplied: boolean;
  setDataMs: number;
  rafMs: number;
  updatedAt: number;
}

interface ChartPaneProps {
  title: string;
  points: Accessor<ChartPoint[]>;
  indicators: Accessor<IndicatorValue[]>;
  indicatorSettings: Accessor<IndicatorSettings>;
  drawings: Accessor<DrawingObject[]>;
  liveStatus: Accessor<{ source: string; isClosed: boolean; time: number } | undefined>;
  theme: Accessor<string>;
  syncCrosshair?: Accessor<{ time: number; price: number } | null>;
  syncRange?: Accessor<LogicalRange | null>;
  onCrosshairMove?: (point: { time: number; price: number } | null) => void;
  onVisibleRangeChange?: (range: LogicalRange | null) => void;
  onReady?: (actions: { exportPng: () => string }) => void;
  onPerformanceUpdate?: (metrics: ChartPaneMetrics) => void;
}

export function ChartPane(props: ChartPaneProps) {
  const containerRef: { current?: HTMLDivElement } = {};
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  let volumeSeries: ISeriesApi<'Histogram'> | undefined;
  let ma5Series: ISeriesApi<'Line'> | undefined;
  let ma10Series: ISeriesApi<'Line'> | undefined;
  let ma30Series: ISeriesApi<'Line'> | undefined;
  let ema12Series: ISeriesApi<'Line'> | undefined;
  let ema26Series: ISeriesApi<'Line'> | undefined;
  let bollUpSeries: ISeriesApi<'Line'> | undefined;
  let bollMidSeries: ISeriesApi<'Line'> | undefined;
  let bollDownSeries: ISeriesApi<'Line'> | undefined;
  let supertrendSeries: ISeriesApi<'Line'> | undefined;
  let applyingExternalRange = false;
  let currentLodApplied = false;
  const priceLines = new Map<string, IPriceLine>();

  const resize = () => {
    if (!containerRef.current || !chart) {
      return;
    }

    chart.applyOptions({
      height: containerRef.current.clientHeight,
      width: containerRef.current.clientWidth,
    });
  };

  createEffect(() => {
    if (!containerRef.current || chart) {
      return;
    }

    chart = createChart(containerRef.current, {
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: props.theme() === 'light' ? '#f7f8fb' : '#101318' },
        textColor: props.theme() === 'light' ? '#1f2937' : '#d6dde8',
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
    volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#4b78ff66',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    ma5Series = chart.addSeries(LineSeries, {
      color: '#f6c343',
      lineWidth: 1,
      priceLineVisible: false,
    });
    ma10Series = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceLineVisible: false,
    });
    ma30Series = chart.addSeries(LineSeries, {
      color: '#fb7185',
      lineWidth: 1,
      priceLineVisible: false,
    });
    ema12Series = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 1,
      priceLineVisible: false,
    });
    ema26Series = chart.addSeries(LineSeries, {
      color: '#14b8a6',
      lineWidth: 1,
      priceLineVisible: false,
    });
    bollUpSeries = chart.addSeries(LineSeries, {
      color: '#94a3b8',
      lineWidth: 1,
      priceLineVisible: false,
    });
    bollMidSeries = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      priceLineVisible: false,
    });
    bollDownSeries = chart.addSeries(LineSeries, {
      color: '#94a3b8',
      lineWidth: 1,
      priceLineVisible: false,
    });
    supertrendSeries = chart.addSeries(LineSeries, {
      color: '#22ab94',
      lineWidth: 2,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });
    chart.subscribeCrosshairMove((param) => {
      if (!props.onCrosshairMove || !param.time || !candleSeries) {
        props.onCrosshairMove?.(null);
        return;
      }

      const row = param.seriesData.get(candleSeries);
      const price = row && 'close' in row ? row.close : undefined;
      props.onCrosshairMove(typeof price === 'number' ? { time: param.time as number, price } : null);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (applyingExternalRange) {
        return;
      }

      props.onVisibleRangeChange?.(range);
    });
    props.onReady?.({
      exportPng: () => chart?.takeScreenshot(true, true).toDataURL('image/png') ?? '',
    });
    resize();
    window.addEventListener('resize', resize);
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

    currentLodApplied = renderData.lodApplied;

    candleSeries?.setData(
      renderedPoints.map((point) => ({
        time: point.time as Time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })),
    );
    volumeSeries?.setData(
      renderedPoints.map((point) => ({
        time: point.time as Time,
        value: point.volume,
        color: point.close >= point.open ? '#22ab9444' : '#f2364544',
      })),
    );

    const setDataMs = Math.round(performance.now() - startedAt);

    if (renderedPoints.length > 0) {
      chart?.timeScale().fitContent();
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
    const indicators = currentLodApplied ? [] : props.indicators();
    const settings = props.indicatorSettings();

    ma5Series?.setData(
      (settings.ma ? indicators : [])
        .filter((row) => typeof row.ma5 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.ma5 ?? 0 })),
    );
    ma10Series?.setData(
      (settings.ma ? indicators : [])
        .filter((row) => typeof row.ma10 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.ma10 ?? 0 })),
    );
    ma30Series?.setData(
      (settings.ma ? indicators : [])
        .filter((row) => typeof row.ma30 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.ma30 ?? 0 })),
    );
    ema12Series?.setData(
      (settings.ema ? indicators : [])
        .filter((row) => typeof row.ema12 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.ema12 ?? 0 })),
    );
    ema26Series?.setData(
      (settings.ema ? indicators : [])
        .filter((row) => typeof row.ema26 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.ema26 ?? 0 })),
    );
    bollUpSeries?.setData(
      (settings.boll ? indicators : [])
        .filter((row) => typeof row.bollUp === 'number')
        .map((row) => ({ time: row.time as Time, value: row.bollUp ?? 0 })),
    );
    bollMidSeries?.setData(
      (settings.boll ? indicators : [])
        .filter((row) => typeof row.bollMid === 'number')
        .map((row) => ({ time: row.time as Time, value: row.bollMid ?? 0 })),
    );
    bollDownSeries?.setData(
      (settings.boll ? indicators : [])
        .filter((row) => typeof row.bollDown === 'number')
        .map((row) => ({ time: row.time as Time, value: row.bollDown ?? 0 })),
    );
    supertrendSeries?.setData(
      (settings.supertrend ? indicators : [])
        .filter((row) => typeof row.supertrend === 'number')
        .map((row) => ({ time: row.time as Time, value: row.supertrend ?? 0 })),
    );
  });

  createEffect(() => {
    const drawings = props.drawings();

    if (!candleSeries) {
      return;
    }

    for (const line of priceLines.values()) {
      candleSeries.removePriceLine(line);
    }
    priceLines.clear();

    for (const drawing of drawings) {
      if (drawing.drawingType !== 'horizontal-line' || typeof drawing.payload.price !== 'number') {
        continue;
      }

      const line = candleSeries.createPriceLine({
        price: drawing.payload.price,
        color: drawing.payload.color ?? '#f6c343',
        lineWidth: 1,
        title: drawing.payload.text ?? drawing.drawingType,
      });
      priceLines.set(drawing.id, line);
    }
  });

  createEffect(() => {
    const crosshair = props.syncCrosshair?.();

    if (!chart || !candleSeries) {
      return;
    }

    if (!crosshair) {
      chart.clearCrosshairPosition();
      return;
    }

    chart.setCrosshairPosition(crosshair.price, crosshair.time as Time, candleSeries);
  });

  createEffect(() => {
    const range = props.syncRange?.();

    if (!chart || !range) {
      return;
    }

    applyingExternalRange = true;
    chart.timeScale().setVisibleLogicalRange(range);
    queueMicrotask(() => {
      applyingExternalRange = false;
    });
  });

  onCleanup(() => {
    window.removeEventListener('resize', resize);
    if (candleSeries) {
      for (const line of priceLines.values()) {
        candleSeries.removePriceLine(line);
      }
    }
    priceLines.clear();
    chart?.remove();
    chart = undefined;
  });

  return (
    <section class="chart-pane">
      <header class="chart-pane__header">
        <span>{props.title}</span>
        <span>
          {props.liveStatus()?.source ?? 'history'} · {props.liveStatus()?.isClosed ? 'closed' : 'live'} · MA/BOLL/EMA/ST/VOL
        </span>
      </header>
      <div ref={(element) => { containerRef.current = element; }} class="chart-pane__surface" />
    </section>
  );
}

const maxDetailedRows = 200_000;
const maxLodRows = 160_000;

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
