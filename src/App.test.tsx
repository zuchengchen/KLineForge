import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { App, createLargePeriodPrefetchRequests, shouldRetryEmptyKlineLoad } from './App';

describe('App', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the Tauri performance shell', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);

    expect(root.textContent).toContain('KLineForge');
  });

  it('prefetches larger non-visible periods for multi-period analysis', () => {
    const requests = createLargePeriodPrefetchRequests({
      market: 'usdM',
      symbol: 'BTCUSDT',
      leftInterval: '5m',
      rightInterval: '1h',
      limit: 1000,
    });

    expect(requests.map((request) => request.interval)).toEqual(['2h', '4h', '1d', '1W', '1M']);
    expect(requests.every((request) => request.symbol === 'BTCUSDT' && request.limit === 1000)).toBe(true);
  });

  it('retries K-line loads only after empty or failed completed requests', () => {
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: true, error: undefined })).toBe(false);
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: false, error: undefined })).toBe(true);
    expect(
      shouldRetryEmptyKlineLoad({
        data: { points: [], source: 'sqlite-cache+binance-rest', cached: false },
        loading: false,
        error: undefined,
      }),
    ).toBe(true);
    expect(
      shouldRetryEmptyKlineLoad({
        data: { points: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }], source: 'sqlite-cache', cached: true },
        loading: false,
        error: undefined,
      }),
    ).toBe(false);
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: false, error: new Error('network') })).toBe(true);
  });
});
