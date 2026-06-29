import { render, waitFor } from '@testing-library/react';
import type { Chart, DataLoader, KLineData } from 'klinecharts';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartId, Interval, Kline, MarketType, SymbolInfo } from '../../types/domain';
import { useChartDataFeed } from './useChartDataFeed';

const mocks = vi.hoisted(() => ({
  createKlineStream: vi.fn(),
  getSymbols: vi.fn(),
  loadChartKlines: vi.fn(),
  loadEarlierChartKlines: vi.fn(),
}));

vi.mock('../market-data', async () => {
  const actual = await vi.importActual<typeof import('../market-data')>('../market-data');

  return {
    ...actual,
    MarketDataProviderChain: vi.fn(function MarketDataProviderChainMock() {
      return {
        createKlineStream: mocks.createKlineStream,
        getSymbols: mocks.getSymbols,
      };
    }),
  };
});

vi.mock('./chartDataLoader', () => ({
  loadChartKlines: mocks.loadChartKlines,
  loadEarlierChartKlines: mocks.loadEarlierChartKlines,
}));

function createSymbolInfo(symbol: string, overrides: Partial<SymbolInfo> = {}): SymbolInfo {
  return {
    schemaVersion: 1,
    market: 'spot',
    symbol,
    baseAsset: symbol.replace(/USDT$/, ''),
    quoteAsset: 'USDT',
    status: 'trading',
    updatedAt: 1,
    ...overrides,
  };
}

function createBar(close: number): KLineData {
  return {
    timestamp: 1,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  };
}

function createKline(symbol: string, openTime: number, close: string): Kline {
  return {
    schemaVersion: 1,
    market: 'spot',
    symbol,
    interval: '5m',
    openTime,
    open: close,
    high: close,
    low: close,
    close,
    volume: '10',
    closeTime: openTime + 299_999,
    quoteVolume: '10',
    tradeCount: 1,
    takerBuyBaseVolume: '5',
    takerBuyQuoteVolume: '5',
    isClosed: false,
    source: 'rest',
    updatedAt: 1,
  };
}

function createChartMock() {
  let dataLoader: DataLoader | null = null;
  const setDataLoader = vi.fn((nextDataLoader: DataLoader) => {
    dataLoader = nextDataLoader;
  });
  const setSymbol = vi.fn();
  const chart = {
    resize: vi.fn(),
    setDataLoader,
    setPeriod: vi.fn(),
    setSymbol,
  } as unknown as Chart;

  return {
    chart,
    getDataLoader: () => dataLoader,
    setSymbol,
  };
}

function TestHarness({
  chart,
  chartId,
  interval = '5m',
  market = 'spot',
  symbol,
}: {
  chart: Chart;
  chartId: ChartId;
  interval?: Interval;
  market?: MarketType;
  symbol: string;
}) {
  const chartRef = useRef<Chart | null>(chart);
  const loadGenerationRef = useRef(0);

  useChartDataFeed({
    chartId,
    chartRef,
    interval,
    loadGenerationRef,
    market,
    symbol,
    onConnectionState: () => undefined,
    onDataSource: () => undefined,
    onError: () => undefined,
    onStatus: () => undefined,
  });

  return null;
}

describe('useChartDataFeed', () => {
  beforeEach(() => {
    mocks.createKlineStream.mockReturnValue({ close: vi.fn() });
    mocks.getSymbols.mockResolvedValue([
      createSymbolInfo('BTCUSDT', { stepSize: '0.00100000', tickSize: '0.10' }),
      createSymbolInfo('JCTUSDT', { stepSize: '1.00000000', tickSize: '0.00000100' }),
    ]);
    mocks.loadChartKlines.mockImplementation(async (_market: MarketType, symbol: string) => ({
      data: [createBar(symbol === 'BTCUSDT' ? 65000.12 : 0.00001234)],
      diagnostics: {
        fallbackUsed: false,
        providerErrors: [],
        staleGapFilled: false,
      },
      source: 'binance-rest',
    }));
    mocks.loadEarlierChartKlines.mockResolvedValue({
      data: [],
      diagnostics: {
        fallbackUsed: false,
        providerErrors: [],
        staleGapFilled: false,
      },
      source: 'cache',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies independent symbol precision to each chart instance from symbol metadata', async () => {
    const btcChart = createChartMock();
    const jctChart = createChartMock();

    render(
      <>
        <TestHarness chart={btcChart.chart} chartId="left" symbol="BTCUSDT" />
        <TestHarness chart={jctChart.chart} chartId="right" symbol="JCTUSDT" />
      </>,
    );

    await waitFor(() => {
      expect(btcChart.setSymbol).toHaveBeenCalledWith(
        expect.objectContaining({
          pricePrecision: 1,
          ticker: 'BTCUSDT',
          volumePrecision: 3,
        }),
      );
      expect(jctChart.setSymbol).toHaveBeenCalledWith(
        expect.objectContaining({
          pricePrecision: 6,
          ticker: 'JCTUSDT',
          volumePrecision: 0,
        }),
      );
    });
  });

  it('uses the loaded K-line data as a per-chart precision fallback before metadata arrives', async () => {
    let resolveSymbols: (symbols: SymbolInfo[]) => void = () => {};
    mocks.getSymbols.mockReturnValue(
      new Promise<SymbolInfo[]>((resolve) => {
        resolveSymbols = resolve;
      }),
    );
    const btcChart = createChartMock();
    const jctChart = createChartMock();

    render(
      <>
        <TestHarness chart={btcChart.chart} chartId="left" symbol="BTCUSDT" />
        <TestHarness chart={jctChart.chart} chartId="right" symbol="JCTUSDT" />
      </>,
    );

    await waitFor(() => {
      expect(btcChart.getDataLoader()).not.toBeNull();
      expect(jctChart.getDataLoader()).not.toBeNull();
    });

    const btcCallback = vi.fn();
    const jctCallback = vi.fn();
    await btcChart.getDataLoader()?.getBars({
      callback: btcCallback,
      period: { span: 5, type: 'minute' },
      symbol: { ticker: 'BTCUSDT', pricePrecision: 4, volumePrecision: 4 },
      timestamp: null,
      type: 'init',
    });
    await jctChart.getDataLoader()?.getBars({
      callback: jctCallback,
      period: { span: 5, type: 'minute' },
      symbol: { ticker: 'JCTUSDT', pricePrecision: 4, volumePrecision: 4 },
      timestamp: null,
      type: 'init',
    });

    expect(btcChart.setSymbol).toHaveBeenCalledWith(
      expect.objectContaining({
        pricePrecision: 2,
        ticker: 'BTCUSDT',
      }),
    );
    expect(jctChart.setSymbol).toHaveBeenCalledWith(
      expect.objectContaining({
        pricePrecision: 8,
        ticker: 'JCTUSDT',
      }),
    );

    resolveSymbols([]);
  });

  it('does not reset the chart symbol when live data keeps the same precision', async () => {
    const btcChart = createChartMock();

    render(<TestHarness chart={btcChart.chart} chartId="left" symbol="BTCUSDT" />);

    await waitFor(() => {
      expect(btcChart.getDataLoader()).not.toBeNull();
    });

    const liveCallback = vi.fn();
    btcChart.getDataLoader()?.subscribeBar?.({
      callback: liveCallback,
      period: { span: 5, type: 'minute' },
      symbol: { ticker: 'BTCUSDT', pricePrecision: 4, volumePrecision: 4 },
    });

    await waitFor(() => {
      expect(btcChart.setSymbol).toHaveBeenCalledWith(
        expect.objectContaining({
          pricePrecision: 1,
          ticker: 'BTCUSDT',
          volumePrecision: 3,
        }),
      );
    });

    const symbolCallCount = btcChart.setSymbol.mock.calls.length;
    const streamRequest = mocks.createKlineStream.mock.calls[0][0];

    streamRequest.onKline(createKline('BTCUSDT', 300_000, '65001.2'));
    streamRequest.onKline(createKline('BTCUSDT', 600_000, '65002.3'));

    expect(liveCallback).toHaveBeenCalledTimes(2);
    expect(btcChart.setSymbol).toHaveBeenCalledTimes(symbolCallCount);
  });
});
