import type { Interval, Kline, MarketType } from '../../types/domain';
import type { MarketDataProvider } from '../market-data';

export interface LatestKlinePollerParams {
  interval: Interval;
  market: MarketType;
  pollMs?: number;
  provider: Pick<MarketDataProvider, 'getKlines'>;
  symbol: string;
  onError?: (error: Error) => void;
  onKline: (kline: Kline) => void;
}

export interface LatestKlinePoller {
  start: () => void;
  stop: () => void;
}

export const defaultLatestKlinePollMs = 1_000;

export function createLatestKlinePoller({
  interval,
  market,
  onError,
  onKline,
  pollMs = defaultLatestKlinePollMs,
  provider,
  symbol,
}: LatestKlinePollerParams): LatestKlinePoller {
  let timer: ReturnType<typeof window.setInterval> | null = null;
  let inFlight = false;
  let stopped = true;

  const poll = async () => {
    if (inFlight || stopped) {
      return;
    }

    inFlight = true;

    try {
      const latestRows = await provider.getKlines({ market, symbol, interval, limit: 2 });

      if (stopped) {
        return;
      }

      latestRows
        .slice()
        .sort((a, b) => a.openTime - b.openTime)
        .forEach(onKline);
    } catch (error) {
      if (!stopped) {
        onError?.(error instanceof Error ? error : new Error('Latest K-line polling failed.'));
      }
    } finally {
      inFlight = false;
    }
  };

  return {
    start: () => {
      if (timer !== null) {
        return;
      }

      stopped = false;
      void poll();
      timer = window.setInterval(() => void poll(), pollMs);
    },
    stop: () => {
      stopped = true;

      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}
