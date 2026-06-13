import type { AxisCreateRangeCallback, AxisCreateRangeParams, AxisGap, AxisRange, Chart } from 'klinecharts';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { overlayPaneId } from './chartOverlayConstants';

interface UseYAxisWheelZoomParams {
  chartRef: MutableRefObject<Chart | null>;
  isVerticalPanDisabled?: boolean;
  verticalPanBlockRef?: MutableRefObject<boolean>;
  resetKey: string;
}

interface ManualYAxisRange {
  from: number;
  to: number;
}

interface VisiblePriceRangeResult {
  paneHeight: number;
  range: ManualYAxisRange;
}

interface ActiveVerticalPan {
  paneHeight: number;
  pointerId: number | null;
  startClientY: number;
  startRange: ManualYAxisRange;
}

interface CandleYAxisOverride {
  paneId: string;
  createRange?: AxisCreateRangeCallback;
  gap?: AxisGap;
}

const defaultYAxisGap = { top: 0.2, bottom: 0.1 };
const manualYAxisGap = { top: 0, bottom: 0 };
const zoomIntensity = 0.0018;
const minRangeRatio = 0.00001;

function toAxisRange(range: ManualYAxisRange): AxisRange {
  const from = Math.min(range.from, range.to);
  const to = Math.max(range.from, range.to);
  const span = Math.max(to - from, Math.max(Math.abs(to), 1) * minRangeRatio);

  return {
    from,
    to,
    range: span,
    realFrom: from,
    realTo: to,
    realRange: span,
    displayFrom: from,
    displayTo: to,
    displayRange: span,
  };
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * 240;
  }

  return event.deltaY;
}

function getDefaultManualRange(params: AxisCreateRangeParams): ManualYAxisRange {
  const { defaultRange } = params;

  return {
    from: defaultRange.realFrom,
    to: defaultRange.realTo,
  };
}

function overrideCandleYAxis(chart: Chart, override: CandleYAxisOverride): void {
  if (typeof chart.overrideYAxis === 'function') {
    chart.overrideYAxis(override as unknown as Parameters<Chart['overrideYAxis']>[0]);
  }
}

function getConvertedValue(result: ReturnType<Chart['convertFromPixel']>): number | null {
  const point = Array.isArray(result) ? result[0] : result;
  const value = point?.value;

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getVisiblePriceRange(chart: Chart): VisiblePriceRangeResult | null {
  const paneSize = chart.getSize(overlayPaneId, 'main');

  if (!paneSize || paneSize.height <= 0) {
    return null;
  }

  const topValue = getConvertedValue(chart.convertFromPixel([{ y: 0 }], { paneId: overlayPaneId }));
  const bottomValue = getConvertedValue(chart.convertFromPixel([{ y: paneSize.height }], { paneId: overlayPaneId }));

  if (topValue === null || bottomValue === null || topValue === bottomValue) {
    return null;
  }

  return {
    paneHeight: paneSize.height,
    range: {
      from: Math.min(bottomValue, topValue),
      to: Math.max(bottomValue, topValue),
    },
  };
}

function isPrimaryPanStart(event: PointerEvent): boolean {
  if ('isPrimary' in event && event.isPrimary === false) {
    return false;
  }

  return event.button === 0 && (event.buttons === 0 || (event.buttons & 1) === 1);
}

function isPrimaryButtonStillPressed(event: PointerEvent): boolean {
  return (event.buttons & 1) === 1;
}

function isInteractivePanTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        'button',
        'a[href]',
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="checkbox"]',
        '[role="combobox"]',
        '[role="link"]',
        '[role="listbox"]',
        '[role="menu"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[role="radio"]',
        '[role="slider"]',
        '[role="spinbutton"]',
        '[role="switch"]',
        '[role="tab"]',
        '[data-drawing-tool]',
        '.drawing-tools',
        '.kline-chart-host__actions',
      ].join(','),
    ),
  );
}

export function useYAxisWheelZoom({
  chartRef,
  isVerticalPanDisabled = false,
  resetKey,
  verticalPanBlockRef,
}: UseYAxisWheelZoomParams): void {
  const manualRangeRef = useRef<ManualYAxisRange | null>(null);
  const activeVerticalPanRef = useRef<ActiveVerticalPan | null>(null);

  useEffect(() => {
    manualRangeRef.current = null;
    activeVerticalPanRef.current = null;

    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    overrideCandleYAxis(chart, {
      paneId: overlayPaneId,
      gap: defaultYAxisGap,
      createRange: ({ defaultRange }: AxisCreateRangeParams) => defaultRange,
    });
  }, [chartRef, resetKey]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const yAxisDom = chart.getDom(overlayPaneId, 'yAxis');

    if (!yAxisDom) {
      return;
    }

    const applyManualRange = () => {
      overrideCandleYAxis(chart, {
        paneId: overlayPaneId,
        gap: manualYAxisGap,
        createRange: (params: AxisCreateRangeParams) => toAxisRange(manualRangeRef.current ?? getDefaultManualRange(params)),
      });
    };

    const resetManualRange = () => {
      manualRangeRef.current = null;
      overrideCandleYAxis(chart, {
        paneId: overlayPaneId,
        gap: defaultYAxisGap,
        createRange: ({ defaultRange }: AxisCreateRangeParams) => defaultRange,
      });
    };

    const onWheel = (event: WheelEvent) => {
      const visibleRange = getVisiblePriceRange(chart);

      if (!visibleRange || !yAxisDom) {
        return;
      }

      const yAxisRect = yAxisDom.getBoundingClientRect();
      const anchorY = Math.max(0, Math.min(visibleRange.paneHeight, event.clientY - yAxisRect.top));
      const pointAtCursor = chart.convertFromPixel([{ y: anchorY }], { paneId: overlayPaneId });
      const anchorValue = getConvertedValue(pointAtCursor);

      if (anchorValue === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const baseRange = manualRangeRef.current ?? visibleRange.range;

      const delta = normalizeWheelDelta(event);
      const scale = Math.exp(delta * zoomIntensity);
      const fromDistance = anchorValue - baseRange.from;
      const toDistance = baseRange.to - anchorValue;
      const nextFrom = anchorValue - fromDistance * scale;
      const nextTo = anchorValue + toDistance * scale;

      if (Number.isFinite(nextFrom) && Number.isFinite(nextTo) && nextTo > nextFrom) {
        manualRangeRef.current = { from: nextFrom, to: nextTo };
        applyManualRange();
      }
    };

    const endVerticalPan = () => {
      const activePan = activeVerticalPanRef.current;

      if (activePan && activePan.pointerId !== null && typeof yAxisDom.releasePointerCapture === 'function') {
        try {
          yAxisDom.releasePointerCapture(activePan.pointerId);
        } catch {
          // The browser may already have released capture after pointerup/cancel.
        }
      }

      activeVerticalPanRef.current = null;
    };

    const isVerticalPanBlocked = () => isVerticalPanDisabled || verticalPanBlockRef?.current === true;

    const onPointerDown = (event: PointerEvent) => {
      if (isVerticalPanBlocked() || !isPrimaryPanStart(event) || isInteractivePanTarget(event.target)) {
        return;
      }

      const visibleRange = getVisiblePriceRange(chart);

      if (!visibleRange) {
        return;
      }

      activeVerticalPanRef.current = {
        paneHeight: visibleRange.paneHeight,
        pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
        startClientY: event.clientY,
        startRange: manualRangeRef.current ?? visibleRange.range,
      };

      if (activeVerticalPanRef.current.pointerId !== null && typeof yAxisDom.setPointerCapture === 'function') {
        try {
          yAxisDom.setPointerCapture(activeVerticalPanRef.current.pointerId);
        } catch {
          // Pointer capture can fail in non-browser tests or after an interrupted event stream.
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const activePan = activeVerticalPanRef.current;

      if (!activePan) {
        return;
      }

      if (isVerticalPanBlocked() || !isPrimaryButtonStillPressed(event)) {
        endVerticalPan();
        return;
      }

      if (activePan.pointerId !== null && typeof event.pointerId === 'number' && event.pointerId !== activePan.pointerId) {
        return;
      }

      const span = activePan.startRange.to - activePan.startRange.from;
      const priceDelta = ((event.clientY - activePan.startClientY) / activePan.paneHeight) * span;
      const nextFrom = activePan.startRange.from + priceDelta;
      const nextTo = activePan.startRange.to + priceDelta;

      if (Number.isFinite(nextFrom) && Number.isFinite(nextTo) && nextTo > nextFrom) {
        manualRangeRef.current = { from: nextFrom, to: nextTo };
        applyManualRange();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const activePan = activeVerticalPanRef.current;

      if (!activePan) {
        return;
      }

      if (activePan.pointerId === null || typeof event.pointerId !== 'number' || event.pointerId === activePan.pointerId) {
        endVerticalPan();
      }
    };

    yAxisDom?.addEventListener('wheel', onWheel, { passive: false });
    yAxisDom?.addEventListener('dblclick', resetManualRange);
    yAxisDom?.addEventListener('pointerdown', onPointerDown);
    globalThis.addEventListener('pointermove', onPointerMove);
    globalThis.addEventListener('pointerup', onPointerUp);
    globalThis.addEventListener('pointercancel', onPointerUp);

    return () => {
      endVerticalPan();
      yAxisDom?.removeEventListener('wheel', onWheel);
      yAxisDom?.removeEventListener('dblclick', resetManualRange);
      yAxisDom?.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('pointermove', onPointerMove);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('pointercancel', onPointerUp);
    };
  }, [chartRef, isVerticalPanDisabled, verticalPanBlockRef]);
}
