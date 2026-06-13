import { render } from '@testing-library/react';
import { init, type Chart } from 'klinecharts';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKLineChartInstance } from './useKLineChartInstance';

interface ResizeObserverEntryMock {
  contentRect: {
    height: number;
    width: number;
  };
}

let resizeObserverCallback: ((entries: ResizeObserverEntryMock[]) => void) | null = null;

class ResizeObserverWithCallbackMock {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();

  constructor(callback: (entries: ResizeObserverEntryMock[]) => void) {
    resizeObserverCallback = callback;
  }
}

function TestHarness() {
  const chartRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useKLineChartInstance({
    chartId: 'left',
    chartRef,
    containerRef,
    onInitError: () => undefined,
    theme: 'dark',
  });

  return <div ref={containerRef} data-testid="chart-host" />;
}

describe('useKLineChartInstance', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    vi.useFakeTimers();
    resizeObserverCallback = null;
    globalThis.ResizeObserver = ResizeObserverWithCallbackMock as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.ResizeObserver = originalResizeObserver;
    vi.clearAllMocks();
  });

  it('coalesces ResizeObserver notifications into one chart resize per frame', async () => {
    render(<TestHarness />);

    await Promise.resolve();
    expect(resizeObserverCallback).not.toBeNull();

    const chart = vi.mocked(init).mock.results[0]?.value as Chart;
    const resize = vi.mocked(chart.resize);

    resizeObserverCallback?.([{ contentRect: { width: 640, height: 360 } }]);
    resizeObserverCallback?.([{ contentRect: { width: 640, height: 360 } }]);
    resizeObserverCallback?.([{ contentRect: { width: 800, height: 420 } }]);

    expect(resize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(16);

    expect(resize).toHaveBeenCalledTimes(1);
  });
});
