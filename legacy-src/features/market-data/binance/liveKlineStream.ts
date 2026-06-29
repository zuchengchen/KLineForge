import type { ConnectionState, Interval, Kline, MarketType } from '../../../types/domain';
import {
  getKlineStreamUrl,
  normalizeKlineStreamPayloadToKline,
  type BinanceKlineStreamPayload,
} from './wsKline';

export interface LiveKlineStreamRequest {
  market: MarketType;
  symbol: string;
  interval: Interval;
  onKline: (kline: Kline) => void;
  onStateChange: (state: ConnectionState) => void;
  onError: (error: Error) => void;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  createWebSocket?: (url: string) => WebSocket;
}

export interface LiveKlineStream {
  close: () => void;
  reconnect: () => void;
}

export class KlineStreamDeduplicator {
  private latestOpenTime: number | null = null;

  accept(kline: Kline): boolean {
    if (this.latestOpenTime !== null && kline.openTime < this.latestOpenTime) {
      return false;
    }

    this.latestOpenTime = kline.openTime;
    return true;
  }
}

function parseStreamMessage(data: unknown, market: MarketType): Kline {
  const payload = JSON.parse(String(data)) as BinanceKlineStreamPayload;

  return normalizeKlineStreamPayloadToKline(market, payload);
}

export function createLiveKlineStream(request: LiveKlineStreamRequest): LiveKlineStream {
  const reconnectDelayMs = request.reconnectDelayMs ?? 2_000;
  const maxReconnectDelayMs = request.maxReconnectDelayMs ?? 30_000;
  const createWebSocket = request.createWebSocket ?? ((url: string) => new WebSocket(url));
  const deduplicator = new KlineStreamDeduplicator();
  const url = getKlineStreamUrl(request.market, request.symbol, request.interval);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByUser = false;
  let reconnectAttempt = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = (isReconnect = false) => {
    clearReconnectTimer();
    request.onStateChange(isReconnect ? 'reconnecting' : 'connecting');

    try {
      socket = createWebSocket(url);
    } catch (error) {
      request.onStateChange('error');
      request.onError(error instanceof Error ? error : new Error('Unable to create Binance K-line stream.'));
      return;
    }

    socket.addEventListener('open', () => {
      reconnectAttempt = 0;
      request.onStateChange('connected');
    });

    socket.addEventListener('message', (event) => {
      try {
        const kline = parseStreamMessage(event.data, request.market);

        if (deduplicator.accept(kline)) {
          request.onKline(kline);
        }
      } catch (error) {
        request.onStateChange('error');
        request.onError(error instanceof Error ? error : new Error('Invalid Binance K-line stream payload.'));
      }
    });

    socket.addEventListener('error', () => {
      request.onStateChange('error');
      request.onError(new Error('Binance K-line stream connection failed.'));
    });

    socket.addEventListener('close', () => {
      socket = null;

      if (closedByUser) {
        request.onStateChange('offline');
        return;
      }

      request.onStateChange('reconnecting');
      const delayMs = Math.min(maxReconnectDelayMs, reconnectDelayMs * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => connect(true), delayMs);
    });
  };

  connect();

  return {
    close: () => {
      closedByUser = true;
      clearReconnectTimer();

      if (socket) {
        socket.close();
      } else {
        request.onStateChange('offline');
      }
    },
    reconnect: () => {
      closedByUser = false;
      reconnectAttempt = 0;
      clearReconnectTimer();

      if (socket) {
        socket.close();
      } else {
        connect(true);
      }
    },
  };
}
