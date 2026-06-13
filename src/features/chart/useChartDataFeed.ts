import type { Chart, DataLoader, KLineData } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartId, ConnectionState, Interval, Kline, MarketType, SymbolInfo } from '../../types/domain';
import { indexedDbKlineCache } from '../cache';
import { MarketDataProviderChain, type KlineStream } from '../market-data';
import { registerChartDebugHandle, unregisterChartDebugHandle } from './chartDebugHandles';
import { loadChartKlines, loadEarlierChartKlines, type ChartKlineLoadResult } from './chartDataLoader';
import { resolveChartSymbol } from './chartSymbolPrecision';
import { intervalToPeriod, toKLineChartData } from './klineChartAdapter';
import { createLatestKlinePoller, type LatestKlinePoller } from './latestKlinePoller';

const liveProvider = new MarketDataProviderChain();

interface UseChartDataFeedParams {
  chartId: ChartId;
  chartRef: MutableRefObject<Chart | null>;
  interval: Interval;
  loadGenerationRef: MutableRefObject<number>;
  market: MarketType;
  symbol: string;
  onConnectionState: (state: ConnectionState) => void;
  onDataSource: (source: ChartKlineLoadResult['source'] | null) => void;
  onError: (message: string | null) => void;
  onStatus: (status: 'loading' | 'ready' | 'error') => void;
}

export function useChartDataFeed({
  chartId,
  chartRef,
  interval,
  loadGenerationRef,
  market,
  onConnectionState,
  onDataSource,
  onError,
  onStatus,
  symbol,
}: UseChartDataFeedParams): void {
  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;

    onStatus('loading');
    onError(null);
    onDataSource(null);
    onConnectionState('idle');
    chart.setPeriod(intervalToPeriod(interval));

    let liveStream: KlineStream | null = null;
    let livePoller: LatestKlinePoller | null = null;
    let lastDeliveredOpenTime: number | null = null;
    let chartData: KLineData[] = [];
    let symbolInfo: SymbolInfo | null = null;
    let appliedChartSymbol: ReturnType<typeof resolveChartSymbol> | null = null;
    const applyChartSymbol = (klines: KLineData[] = chartData, fallbackPrice?: number) => {
      if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
        return;
      }

      const nextChartSymbol = resolveChartSymbol({ fallbackPrice, klines, symbol, symbolInfo });

      if (
        appliedChartSymbol?.ticker === nextChartSymbol.ticker &&
        appliedChartSymbol.pricePrecision === nextChartSymbol.pricePrecision &&
        appliedChartSymbol.volumePrecision === nextChartSymbol.volumePrecision
      ) {
        return;
      }

      appliedChartSymbol = nextChartSymbol;
      chart.setSymbol(nextChartSymbol);
    };

    applyChartSymbol();
    void liveProvider
      .getSymbols(market)
      .then((symbols) => {
        const normalizedSymbol = symbol.toUpperCase();
        const nextSymbolInfo = symbols.find((item) => item.symbol.toUpperCase() === normalizedSymbol) ?? null;

        if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
          return;
        }

        symbolInfo = nextSymbolInfo;
        applyChartSymbol();
      })
      .catch(() => undefined);

    const deliverLiveKline = (kline: Kline, callback: (data: ReturnType<typeof toKLineChartData>) => void) => {
      if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
        return;
      }

      if (lastDeliveredOpenTime !== null && kline.openTime < lastDeliveredOpenTime) {
        return;
      }

      lastDeliveredOpenTime = Math.max(lastDeliveredOpenTime ?? kline.openTime, kline.openTime);
      const nextData = toKLineChartData(kline);
      const existingIndex = chartData.findIndex((item) => item.timestamp === nextData.timestamp);

      if (existingIndex >= 0) {
        chartData = chartData.map((item, index) => (index === existingIndex ? nextData : item));
      } else {
        chartData = [...chartData, nextData];
      }

      applyChartSymbol(chartData, nextData.close);
      callback(nextData);
      void indexedDbKlineCache.writeKlines({ market, symbol, interval }, [kline]);
    };
    const stopLivePolling = () => {
      livePoller?.stop();
      livePoller = null;
    };
    const dataLoader: DataLoader = {
      getBars: async ({ callback, timestamp, type }) => {
        if (type === 'forward') {
          try {
            const result = await loadEarlierChartKlines(market, symbol, interval, timestamp);

            if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
              return;
            }

            callback(result.data, {
              forward: result.data.length > 0,
              backward: false,
            });
          } catch {
            if (loadGenerationRef.current === loadGeneration && chartRef.current === chart) {
              callback([], { forward: false, backward: false });
            }
          }

          return;
        }

        if (type !== 'init') {
          callback([], { forward: false, backward: false });
          return;
        }

        try {
          const result = await loadChartKlines(market, symbol, interval);
          const data = result.data;

          if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
            return;
          }

          if (data.length === 0) {
            throw new Error('No K-line data was returned.');
          }

          chartData = data;
          applyChartSymbol(data, data.at(-1)?.close);
          callback(data, {
            forward: result.source !== 'fallback' && data.length > 0,
            backward: false,
          });
          onDataSource(result.source);
          onStatus('ready');
        } catch (requestError) {
          if (loadGenerationRef.current !== loadGeneration || chartRef.current !== chart) {
            return;
          }

          const message = requestError instanceof Error ? requestError.message : 'Failed to load K-line data.';
          onStatus('error');
          onError(message);
          callback([], false);
        }
      },
      subscribeBar: ({ callback }) => {
        liveStream?.close();
        stopLivePolling();
        liveStream = liveProvider.createKlineStream({
          market,
          symbol,
          intervals: [interval],
          onKline: (kline) => {
            deliverLiveKline(kline, callback);
          },
          onStateChange: (state) => {
            if (chartRef.current === chart) {
              onConnectionState(state);
            }
          },
          onError: (streamError) => {
            if (chartRef.current === chart) {
              onError(streamError.message);
            }
          },
        }) as KlineStream;

        livePoller = createLatestKlinePoller({
          interval,
          market,
          provider: liveProvider,
          symbol,
          onKline: (kline) => deliverLiveKline(kline, callback),
          onError: (pollError) => {
            if (chartRef.current === chart && liveStream === null) {
              onError(pollError.message);
            }
          },
        });
        livePoller.start();

        if (import.meta.env.DEV) {
          registerChartDebugHandle(chartId, chart, liveStream);
        }
      },
      unsubscribeBar: () => {
        liveStream?.close();
        liveStream = null;
        stopLivePolling();
        unregisterChartDebugHandle(chartId);
      },
    };

    chart.setDataLoader(dataLoader);
    chart.resize();

    return () => {
      liveStream?.close();
      liveStream = null;
      stopLivePolling();
      unregisterChartDebugHandle(chartId);
      loadGenerationRef.current += 1;
    };
  }, [
    chartId,
    chartRef,
    interval,
    loadGenerationRef,
    market,
    onConnectionState,
    onDataSource,
    onError,
    onStatus,
    symbol,
  ]);
}
