import type { AxisCreateRangeCallback, AxisCreateRangeParams, AxisRange, Chart } from 'klinecharts';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, type MutableRefObject } from 'react';
import { useYAxisWheelZoom } from './useYAxisWheelZoom';

interface TestHarnessProps {
  chart: Chart;
  isVerticalPanDisabled?: boolean;
  resetKey?: string;
  verticalPanBlockRef?: MutableRefObject<boolean>;
}

interface YAxisOverrideCall {
  createRange?: AxisCreateRangeCallback;
  gap?: {
    bottom: number;
    top: number;
  };
  paneId: string;
}

function TestHarness({
  chart,
  isVerticalPanDisabled = false,
  resetKey = 'usdM:BTCUSDT:5m',
  verticalPanBlockRef,
}: TestHarnessProps) {
  const chartRef = useRef<Chart | null>(chart);

  useYAxisWheelZoom({ chartRef, isVerticalPanDisabled, resetKey, verticalPanBlockRef });

  return null;
}

function createChartMock() {
  const yAxisDom = document.createElement('div');
  const mainDom = document.createElement('div');
  const overrideYAxis = vi.fn();
  const chart = {
    getDom: vi.fn((_paneId?: string, position?: string) => {
      if (position === 'main') {
        return mainDom;
      }

      if (position === 'yAxis') {
        return yAxisDom;
      }

      return null;
    }),
    getSize: vi.fn(() => ({ width: 520, height: 320, left: 0, top: 0 })),
    convertFromPixel: vi.fn((points: Array<{ y?: number }>) =>
      points.map((point) => ({
        value: typeof point.y === 'number' ? 200 - point.y / 2 : undefined,
      })),
    ),
    overrideYAxis,
  } as unknown as Chart;

  Object.defineProperty(yAxisDom, 'getBoundingClientRect', {
    value: () => ({
      bottom: 320,
      height: 320,
      left: 0,
      right: 60,
      top: 0,
      width: 60,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });

  return { chart, mainDom, overrideYAxis, yAxisDom };
}

function createDefaultRange(from = 40, to = 200): AxisRange {
  const range = to - from;

  return {
    displayFrom: from,
    displayRange: range,
    displayTo: to,
    from,
    range,
    realFrom: from,
    realRange: range,
    realTo: to,
    to,
  };
}

function getLastYAxisOverride(overrideYAxis: ReturnType<typeof vi.fn>): YAxisOverrideCall {
  return overrideYAxis.mock.lastCall?.[0] as YAxisOverrideCall;
}

function getManualRange(overrideYAxis: ReturnType<typeof vi.fn>): AxisRange {
  const createRange = getLastYAxisOverride(overrideYAxis).createRange;

  expect(createRange).toBeTypeOf('function');

  return createRange?.({ defaultRange: createDefaultRange() } as AxisCreateRangeParams) as AxisRange;
}

function dispatchPointerEvent(target: EventTarget, type: string, init: MouseEventInit = {}) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      clientY: 100,
      ...init,
    }),
  );
}

describe('useYAxisWheelZoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zooms the candle price axis with the mouse wheel and resets on double click', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} />);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientY: 160,
      deltaY: -120,
    });

    Object.defineProperty(wheelEvent, 'preventDefault', { value: preventDefault });
    Object.defineProperty(wheelEvent, 'stopPropagation', { value: stopPropagation });

    yAxisDom.dispatchEvent(wheelEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(overrideYAxis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gap: { top: 0, bottom: 0 },
        paneId: 'candle_pane',
      }),
    );
    expect(getManualRange(overrideYAxis).range).toBeLessThan(160);

    yAxisDom.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(overrideYAxis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gap: { top: 0.2, bottom: 0.1 },
        paneId: 'candle_pane',
      }),
    );

    unmount();
  });

  it('pans the candle price axis vertically from the y-axis without changing the range span', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} />);

    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gap: { top: 0, bottom: 0 },
        paneId: 'candle_pane',
      }),
    );

    const range = getManualRange(overrideYAxis);

    expect(range.from).toBeCloseTo(56);
    expect(range.to).toBeCloseTo(216);
    expect(range.range).toBeCloseTo(160);

    dispatchPointerEvent(globalThis, 'pointerup', { clientY: 132, buttons: 0 });
    unmount();
  });

  it('resets manual vertical pan and zoom when the reset key changes', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { rerender, unmount } = render(<TestHarness chart={chart} resetKey="usdM:BTCUSDT:5m" />);

    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(getManualRange(overrideYAxis).from).toBeCloseTo(56);

    rerender(<TestHarness chart={chart} resetKey="usdM:ETHUSDT:5m" />);

    expect(overrideYAxis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gap: { top: 0.2, bottom: 0.1 },
        paneId: 'candle_pane',
      }),
    );

    expect(getLastYAxisOverride(overrideYAxis).createRange?.({ defaultRange: createDefaultRange(10, 20) } as AxisCreateRangeParams)).toEqual(
      createDefaultRange(10, 20),
    );

    unmount();
  });

  it('does not start vertical panning for non-primary buttons or interactive targets', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} />);
    const initialOverrideCount = overrideYAxis.mock.calls.length;

    dispatchPointerEvent(yAxisDom, 'pointerdown', { button: 2, buttons: 2, clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    const button = document.createElement('button');
    yAxisDom.append(button);

    dispatchPointerEvent(button, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount);

    unmount();
  });

  it('does not start vertical panning while drawing interactions are disabled', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} isVerticalPanDisabled />);
    const initialOverrideCount = overrideYAxis.mock.calls.length;

    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount);

    unmount();
  });

  it('does not start vertical panning while a drawing interaction block ref is active', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const verticalPanBlockRef = { current: true };
    const { unmount } = render(<TestHarness chart={chart} verticalPanBlockRef={verticalPanBlockRef} />);
    const initialOverrideCount = overrideYAxis.mock.calls.length;

    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount);

    verticalPanBlockRef.current = false;
    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount + 1);

    unmount();
  });

  it('does not take over ordinary main chart drags', () => {
    const { chart, mainDom, overrideYAxis } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} />);
    const initialOverrideCount = overrideYAxis.mock.calls.length;

    dispatchPointerEvent(mainDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount);

    unmount();
  });

  it('cleans up y-axis and window pointer listeners on unmount', () => {
    const { chart, overrideYAxis, yAxisDom } = createChartMock();
    const { unmount } = render(<TestHarness chart={chart} />);
    const initialOverrideCount = overrideYAxis.mock.calls.length;

    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    unmount();
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });
    dispatchPointerEvent(yAxisDom, 'pointerdown', { clientY: 100 });
    dispatchPointerEvent(globalThis, 'pointermove', { clientY: 132 });

    expect(overrideYAxis).toHaveBeenCalledTimes(initialOverrideCount);
  });
});
