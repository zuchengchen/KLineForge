import type { Chart, Crosshair } from 'klinecharts';
import { describe, expect, it, vi } from 'vitest';
import type { ChartId, Interval } from '../../types/domain';
import { attachCrosshairSync } from './crosshairSync';

type CrosshairCallback = (data?: Crosshair) => void;

function createChartMock(dataList: Array<{ timestamp: number; close: number; open: number }> = []) {
  let crosshairCallback: CrosshairCallback | null = null;
  const dom = document.createElement('div');
  const convertFromPixel = vi.fn((points: Array<{ x?: number }>) =>
    points.map((point) => ({
      timestamp: typeof point.x === 'number' ? point.x * 1000 : undefined,
    })),
  );
  const convertToPixel = vi.fn(({ timestamp, value }: { timestamp: number; value?: number }) => ({
    x: timestamp / 1000,
    ...(typeof value === 'number' ? { y: value * 10 } : {}),
  }));
  const executeAction = vi.fn();
  const createOverlay = vi.fn();
  const removeOverlay = vi.fn();
  const chart = {
    subscribeAction: vi.fn((_type: string, callback: CrosshairCallback) => {
      crosshairCallback = callback;
    }),
    unsubscribeAction: vi.fn(),
    convertFromPixel,
    convertToPixel,
    executeAction,
    createOverlay,
    removeOverlay,
    getDataList: vi.fn(() => dataList),
    getSize: vi.fn(() => ({ width: 518, height: 320, left: 0, top: 0 })),
    getBarSpace: vi.fn(() => ({ bar: 8, halfBar: 4, gapBar: 6, halfGapBar: 3 })),
    getDom: vi.fn(() => dom),
  } as unknown as Chart;

  return {
    chart,
    convertFromPixel,
    convertToPixel,
    createOverlay,
    dom,
    executeAction,
    removeOverlay,
    emitCrosshair: (data?: Crosshair) => crosshairCallback?.(data),
  };
}

function attach(chartMock: ReturnType<typeof createChartMock>, chartId: ChartId, interval: Interval) {
  return attachCrosshairSync(chartMock.chart, chartId, interval, { current: null });
}

describe('crosshair sync', () => {
  it('maps a lower-timeframe crosshair to the containing higher-timeframe candle', () => {
    const left = createChartMock();
    const right = createChartMock();
    const leftDetach = attach(left, 'left', '5m');
    const rightDetach = attach(right, 'right', '1h');
    const fiveMinuteOpenTime = Date.UTC(2026, 5, 10, 10, 25);
    const oneHourOpenTime = Date.UTC(2026, 5, 10, 10, 0);

    left.emitCrosshair({ x: fiveMinuteOpenTime / 1000, y: 10 });

    expect(left.convertFromPixel).toHaveBeenCalledWith([{ x: fiveMinuteOpenTime / 1000 }]);
    expect(right.convertToPixel).toHaveBeenCalledWith({ timestamp: oneHourOpenTime });
    expect(right.executeAction).toHaveBeenCalledWith('onCrosshairChange', {
      x: oneHourOpenTime / 1000,
      y: 160,
    });
    expect(right.createOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'klineforge-linked-crosshair',
        points: [{ timestamp: oneHourOpenTime }],
      }),
    );

    leftDetach();
    rightDetach();
  });

  it('maps a higher-timeframe crosshair to the same open-time bucket on a lower-timeframe chart', () => {
    const left = createChartMock();
    const right = createChartMock();
    const leftDetach = attach(left, 'left', '5m');
    const rightDetach = attach(right, 'right', '1h');
    const oneHourOpenTime = Date.UTC(2026, 5, 10, 10, 0);

    right.emitCrosshair({ x: oneHourOpenTime / 1000, y: 10 });

    expect(right.convertFromPixel).toHaveBeenCalledWith([{ x: oneHourOpenTime / 1000 }]);
    expect(left.convertToPixel).toHaveBeenCalledWith({ timestamp: oneHourOpenTime });
    expect(left.executeAction).toHaveBeenCalledWith('onCrosshairChange', {
      x: oneHourOpenTime / 1000,
      y: 160,
    });
    expect(left.createOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        points: [{ timestamp: oneHourOpenTime }],
      }),
    );

    leftDetach();
    rightDetach();
  });

  it('clears the linked highlight when the source crosshair is cleared', () => {
    const left = createChartMock();
    const right = createChartMock();
    const leftDetach = attach(left, 'left', '5m');
    const rightDetach = attach(right, 'right', '1h');

    left.emitCrosshair({ timestamp: Date.UTC(2026, 5, 10, 10, 25) });
    left.dom.dispatchEvent(new Event('mouseleave'));

    expect(right.removeOverlay).toHaveBeenCalledWith({ groupId: 'klineforge-linked-crosshair' });

    leftDetach();
    rightDetach();
  });

  it('places the linked crosshair horizontal line on the target candle close when data is available', () => {
    const left = createChartMock();
    const targetTimestamp = Date.UTC(2026, 5, 10, 10, 0);
    const right = createChartMock([{ timestamp: targetTimestamp, open: 101, close: 123 }]);
    const leftDetach = attach(left, 'left', '5m');
    const rightDetach = attach(right, 'right', '1h');

    left.emitCrosshair({ x: Date.UTC(2026, 5, 10, 10, 25) / 1000, y: 10 });

    expect(right.convertToPixel).toHaveBeenCalledWith({ timestamp: targetTimestamp, value: 123 });
    expect(right.executeAction).toHaveBeenCalledWith('onCrosshairChange', {
      x: targetTimestamp / 1000,
      y: 1230,
    });

    leftDetach();
    rightDetach();
  });
});
