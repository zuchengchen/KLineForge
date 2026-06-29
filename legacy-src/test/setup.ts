import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverMock;

vi.mock('klinecharts', async () => {
  const actual = await vi.importActual<typeof import('klinecharts')>('klinecharts');

  return {
    ...actual,
    init: vi.fn(() => ({
      setStyles: vi.fn(),
      setSymbol: vi.fn(),
      setPeriod: vi.fn(),
      setDataLoader: vi.fn(),
      subscribeAction: vi.fn(),
      unsubscribeAction: vi.fn(),
      executeAction: vi.fn(),
      convertToPixel: vi.fn(() => ({ x: 1 })),
      convertFromPixel: vi.fn(() => [{ timestamp: Date.now() }]),
      overrideYAxis: vi.fn(),
      createIndicator: vi.fn(),
      removeIndicator: vi.fn(),
      createOverlay: vi.fn(),
      removeOverlay: vi.fn(),
      getOverlays: vi.fn(() => []),
      getDataList: vi.fn(() => []),
      getDom: vi.fn(() => document.createElement('div')),
      getSize: vi.fn(() => ({ width: 520, height: 320, left: 0, top: 0 })),
      getBarSpace: vi.fn(() => ({ bar: 8, halfBar: 4, gapBar: 6, halfGapBar: 3 })),
      resize: vi.fn(),
    })),
    dispose: vi.fn(),
  };
});
