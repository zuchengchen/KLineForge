import type { Chart, DataLoader } from 'klinecharts';
import { useEffect, type MutableRefObject } from 'react';
import type { ChartId, ConnectionState, Interval, MarketType } from '../../types/domain';
import { indexedDbKlineCache } from '../cache';
import { BinanceDirectMarketDataProvider, type KlineStream } from '../market-data';
import { registerChartDebugHandle, unregisterChartDebugHandle } from './chartDebugHandles';
import { loadChartKlines, loadEarlierChartKlines, type ChartKlineLoadResult } from './chartDataLoader';
import { intervalToPeriod, toKLineChartData } from './klineChartAdapter';

const provider = new BinanceDirectMarketDataProvider();

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
    chart.setSymbol({
      ticker: symbol,
      pricePrecision: 2,
      volumePrecision: 4,
    });
    chart.setPeriod(intervalToPeriod(interval));

    let liveStream: KlineStream | null = null;
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
        let lastDeliveredOpenTime: number | null = null;
        liveStream?.close();
        liveStream = provider.createKlineStream({
          market,
          symbol,
          intervals: [interval],
          onKline: (kline) => {
            if (lastDeliveredOpenTime !== null && kline.openTime < lastDeliveredOpenTime) {
              return;
            }

            lastDeliveredOpenTime = kline.openTime;
            callback(toKLineChartData(kline));
            void indexedDbKlineCache.writeKlines({ market, symbol, interval }, [kline]);
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

        if (import.meta.env.DEV) {
          registerChartDebugHandle(chartId, chart, liveStream);
        }
      },
      unsubscribeBar: () => {
        liveStream?.close();
        liveStream = null;
        unregisterChartDebugHandle(chartId);
      },
    };

    chart.setDataLoader(dataLoader);
    chart.resize();

    return () => {
      liveStream?.close();
      liveStream = null;
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
