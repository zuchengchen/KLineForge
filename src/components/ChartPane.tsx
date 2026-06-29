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
  resetKey?: Accessor<string>;
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
  let macdSeries: ISeriesApi<'Histogram'> | undefined;
  let macdDifSeries: ISeriesApi<'Line'> | undefined;
  let macdDeaSeries: ISeriesApi<'Line'> | undefined;
  let rsiSeries: ISeriesApi<'Line'> | undefined;
  let atrSeries: ISeriesApi<'Line'> | undefined;
  let kdjKSeries: ISeriesApi<'Line'> | undefined;
  let kdjDSeries: ISeriesApi<'Line'> | undefined;
  let kdjJSeries: ISeriesApi<'Line'> | undefined;
  let supertrendSeries: ISeriesApi<'Line'> | undefined;
  let applyingExternalRange = false;
  let externalRangeUnlockFrame: number | undefined;
  let externalRangeUnlockFollowupFrame: number | undefined;
  let latestResetKey: string | undefined;
  let shouldFitNextData = true;
  let previousInputPoints: ChartPoint[] | undefined;
  let currentLodApplied = false;
  const priceLines = new Map<string, IPriceLine>();
  const drawingSeries = new Map<string, ISeriesApi<'Line'>>();

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
    macdSeries = chart.addSeries(HistogramSeries, {
      color: '#22ab9444',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      priceScaleId: 'right',
    }, 1);
    macdDifSeries = chart.addSeries(LineSeries, {
      color: '#f6c343',
      lineWidth: 1,
      priceLineVisible: false,
    }, 1);
    macdDeaSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceLineVisible: false,
    }, 1);
    rsiSeries = chart.addSeries(LineSeries, {
      color: '#fb7185',
      lineWidth: 1,
      priceLineVisible: false,
    }, 2);
    atrSeries = chart.addSeries(LineSeries, {
      color: '#14b8a6',
      lineWidth: 1,
      priceLineVisible: false,
    }, 3);
    kdjKSeries = chart.addSeries(LineSeries, {
      color: '#f6c343',
      lineWidth: 1,
      priceLineVisible: false,
    }, 4);
    kdjDSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceLineVisible: false,
    }, 4);
    kdjJSeries = chart.addSeries(LineSeries, {
      color: '#fb7185',
      lineWidth: 1,
      priceLineVisible: false,
    }, 4);
    chart.panes()[0]?.setStretchFactor(8);
    chart.panes()[1]?.setStretchFactor(2);
    chart.panes()[2]?.setStretchFactor(2);
    chart.panes()[3]?.setStretchFactor(2);
    chart.panes()[4]?.setStretchFactor(2);
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
    const nextResetKey = props.resetKey?.();

    if (nextResetKey !== latestResetKey) {
      latestResetKey = nextResetKey;
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
    volumeSeries?.setData(
      props.indicatorSettings().volume
        ? renderedPoints.map((point) => ({
            time: point.time as Time,
            value: point.volume,
            color: point.close >= point.open ? '#22ab9444' : '#f2364544',
          }))
        : [],
    );

    const setDataMs = Math.round(performance.now() - startedAt);

    if (renderedPoints.length > 0) {
      if (shouldFitContent) {
        chart?.timeScale().fitContent();
        shouldFitNextData = false;
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
    macdSeries?.setData(
      (settings.macd ? indicators : [])
        .filter((row) => typeof row.macd === 'number')
        .map((row) => ({
          time: row.time as Time,
          value: row.macd ?? 0,
          color: (row.macd ?? 0) >= 0 ? '#22ab9466' : '#f2364566',
        })),
    );
    macdDifSeries?.setData(
      (settings.macd ? indicators : [])
        .filter((row) => typeof row.macdDif === 'number')
        .map((row) => ({ time: row.time as Time, value: row.macdDif ?? 0 })),
    );
    macdDeaSeries?.setData(
      (settings.macd ? indicators : [])
        .filter((row) => typeof row.macdDea === 'number')
        .map((row) => ({ time: row.time as Time, value: row.macdDea ?? 0 })),
    );
    rsiSeries?.setData(
      (settings.rsi ? indicators : [])
        .filter((row) => typeof row.rsi14 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.rsi14 ?? 0 })),
    );
    atrSeries?.setData(
      (settings.atr ? indicators : [])
        .filter((row) => typeof row.atr14 === 'number')
        .map((row) => ({ time: row.time as Time, value: row.atr14 ?? 0 })),
    );
    kdjKSeries?.setData(
      (settings.kdj ? indicators : [])
        .filter((row) => typeof row.kdjK === 'number')
        .map((row) => ({ time: row.time as Time, value: row.kdjK ?? 0 })),
    );
    kdjDSeries?.setData(
      (settings.kdj ? indicators : [])
        .filter((row) => typeof row.kdjD === 'number')
        .map((row) => ({ time: row.time as Time, value: row.kdjD ?? 0 })),
    );
    kdjJSeries?.setData(
      (settings.kdj ? indicators : [])
        .filter((row) => typeof row.kdjJ === 'number')
        .map((row) => ({ time: row.time as Time, value: row.kdjJ ?? 0 })),
    );
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

    if (areLogicalRangesEqual(chart.timeScale().getVisibleLogicalRange(), range)) {
      return;
    }

    applyingExternalRange = true;
    chart.timeScale().setVisibleLogicalRange(range);
    scheduleExternalRangeUnlock();
  });

  onCleanup(() => {
    window.removeEventListener('resize', resize);
    cancelExternalRangeUnlock();
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
    }
    drawingSeries.clear();
    chart?.remove();
    chart = undefined;
  });

  function cancelExternalRangeUnlock() {
    if (externalRangeUnlockFrame !== undefined) {
      window.cancelAnimationFrame(externalRangeUnlockFrame);
      externalRangeUnlockFrame = undefined;
    }

    if (externalRangeUnlockFollowupFrame !== undefined) {
      window.cancelAnimationFrame(externalRangeUnlockFollowupFrame);
      externalRangeUnlockFollowupFrame = undefined;
    }
  }

  function scheduleExternalRangeUnlock() {
    cancelExternalRangeUnlock();
    externalRangeUnlockFrame = window.requestAnimationFrame(() => {
      externalRangeUnlockFrame = undefined;
      externalRangeUnlockFollowupFrame = window.requestAnimationFrame(() => {
        externalRangeUnlockFollowupFrame = undefined;
        applyingExternalRange = false;
      });
    });
  }

  return (
    <section class="chart-pane">
      <header class="chart-pane__header">
        <span>{props.title}</span>
        <span>
          {props.liveStatus()?.source ?? 'history'} · {props.liveStatus()?.isClosed ? 'closed' : 'live'} · VOL/MA/EMA/BOLL/MACD/RSI/ATR/KDJ/ST
        </span>
      </header>
      <div ref={(element) => { containerRef.current = element; }} class="chart-pane__surface" />
    </section>
  );
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

export function areLogicalRangesEqual(
  first: LogicalRange | null | undefined,
  second: LogicalRange | null | undefined,
  tolerance = 0.0001,
) {
  if (!first || !second) {
    return first === second;
  }

  return Math.abs(first.from - second.from) <= tolerance && Math.abs(first.to - second.to) <= tolerance;
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
