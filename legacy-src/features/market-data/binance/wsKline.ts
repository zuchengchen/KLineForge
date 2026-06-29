import type { KLineData } from 'klinecharts';
import type { Interval, Kline, MarketType } from '../../../types/domain';
import { binanceEndpoints } from './endpoints';
import { normalizeBinanceKline } from './normalizers';

export interface BinanceKlineStreamPayload {
  e: string;
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean;
    q: string;
    V: string;
    Q: string;
  };
}

export function getKlineStreamUrl(market: MarketType, symbol: string, interval: Interval): string {
  const baseUrl =
    market === 'spot' ? binanceEndpoints.spotStreamBaseUrl : binanceEndpoints.usdMStreamBaseUrl;
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

  return `${baseUrl}/${streamName}`;
}

export function normalizeKlineStreamPayload(payload: BinanceKlineStreamPayload): KLineData {
  return {
    timestamp: payload.k.t,
    open: Number(payload.k.o),
    high: Number(payload.k.h),
    low: Number(payload.k.l),
    close: Number(payload.k.c),
    volume: Number(payload.k.v),
    turnover: Number(payload.k.q),
  };
}

export function normalizeKlineStreamPayloadToKline(
  market: MarketType,
  payload: BinanceKlineStreamPayload,
  now = Date.now(),
): Kline {
  return normalizeBinanceKline(
    market,
    payload.k.s,
    payload.k.i as Interval,
    [
      payload.k.t,
      payload.k.o,
      payload.k.h,
      payload.k.l,
      payload.k.c,
      payload.k.v,
      payload.k.T,
      payload.k.q,
      payload.k.n,
      payload.k.V,
      payload.k.Q,
      '0',
    ],
    'websocket',
    now,
  );
}

export function loadLatestKlineFromStream(
  market: MarketType,
  symbol: string,
  interval: Interval,
  timeoutMs = 12_000,
): Promise<KLineData> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(getKlineStreamUrl(market, symbol, interval));
    const timeout = window.setTimeout(() => {
      socket.close();
      reject(new Error('Timed out waiting for Binance K-line stream data.'));
    }, timeoutMs);

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as BinanceKlineStreamPayload;

        window.clearTimeout(timeout);
        socket.close();
        resolve(normalizeKlineStreamPayload(payload));
      } catch (error) {
        window.clearTimeout(timeout);
        socket.close();
        reject(error instanceof Error ? error : new Error('Invalid Binance K-line stream payload.'));
      }
    });

    socket.addEventListener('error', () => {
      window.clearTimeout(timeout);
      socket.close();
      reject(new Error('Binance K-line stream connection failed.'));
    });
  });
}
