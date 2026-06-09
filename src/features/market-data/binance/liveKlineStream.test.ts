import { describe, expect, it, vi } from 'vitest';
import type { Kline } from '../../../types/domain';
import { createLiveKlineStream, KlineStreamDeduplicator } from './liveKlineStream';
import type { BinanceKlineStreamPayload } from './wsKline';

function createKline(openTime: number): Kline {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: 'BTCUSDT',
    interval: '5m',
    openTime,
    open: '1',
    high: '2',
    low: '0.5',
    close: '1.5',
    volume: '10',
    closeTime: openTime + 299_999,
    quoteVolume: '15',
    tradeCount: 1,
    takerBuyBaseVolume: '5',
    takerBuyQuoteVolume: '7.5',
    isClosed: false,
    source: 'websocket',
    updatedAt: 1,
  };
}

function createPayload(openTime: number): BinanceKlineStreamPayload {
  return {
    e: 'kline',
    E: openTime,
    s: 'BTCUSDT',
    k: {
      t: openTime,
      T: openTime + 299_999,
      s: 'BTCUSDT',
      i: '5m',
      o: '1',
      c: '1.5',
      h: '2',
      l: '0.5',
      v: '10',
      n: 1,
      x: false,
      q: '15',
      V: '5',
      Q: '7.5',
    },
  };
}

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];

  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.dispatchEvent(new Event('open'));
  }

  message(payload: BinanceKlineStreamPayload) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }

  close() {
    this.dispatchEvent(new Event('close'));
  }
}

describe('live K-line stream', () => {
  it('drops out-of-order rows while accepting same-candle updates and new candles', () => {
    const deduplicator = new KlineStreamDeduplicator();

    expect(deduplicator.accept(createKline(300_000))).toBe(true);
    expect(deduplicator.accept(createKline(300_000))).toBe(true);
    expect(deduplicator.accept(createKline(0))).toBe(false);
    expect(deduplicator.accept(createKline(600_000))).toBe(true);
  });

  it('normalizes stream messages and reconnects after unexpected close', () => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    const states: string[] = [];
    const rows: Kline[] = [];
    const errors: string[] = [];

    const stream = createLiveKlineStream({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '5m',
      onKline: (kline) => rows.push(kline),
      onStateChange: (state) => states.push(state),
      onError: (error) => errors.push(error.message),
      reconnectDelayMs: 50,
      createWebSocket: (url) => new FakeWebSocket(url) as unknown as WebSocket,
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe('wss://fstream.binance.com/ws/btcusdt@kline_5m');

    FakeWebSocket.instances[0].open();
    FakeWebSocket.instances[0].message(createPayload(300_000));
    FakeWebSocket.instances[0].message(createPayload(0));
    FakeWebSocket.instances[0].message(createPayload(600_000));
    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(50);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(rows.map((row) => row.openTime)).toEqual([300_000, 600_000]);
    expect(rows[0]).toMatchObject({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '5m',
      source: 'websocket',
      open: '1',
      close: '1.5',
    });
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'reconnecting']);
    expect(errors).toEqual([]);

    stream.close();
    vi.useRealTimers();
  });
});
