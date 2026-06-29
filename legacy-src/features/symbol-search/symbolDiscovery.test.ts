import { describe, expect, it } from 'vitest';
import { filterSymbolRows, sortLeaderboard, type SymbolSearchRow } from './symbolDiscovery';

const rows: SymbolSearchRow[] = [
  { symbol: 'BTCUSDT', lastPrice: '100', priceChangePercent: '1', quoteVolume: '1000' },
  { symbol: 'ETHUSDT', lastPrice: '50', priceChangePercent: '-2', quoteVolume: '2000' },
  { symbol: 'SOLUSDT', lastPrice: '10', priceChangePercent: '4', quoteVolume: '500' },
];

describe('symbol discovery', () => {
  it('filters rows by symbol query', () => {
    expect(filterSymbolRows(rows, 'eth').map((row) => row.symbol)).toEqual(['ETHUSDT']);
    expect(filterSymbolRows(rows, '').map((row) => row.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('sorts leaderboards', () => {
    expect(sortLeaderboard(rows, 'gainers').map((row) => row.symbol)).toEqual(['SOLUSDT', 'BTCUSDT', 'ETHUSDT']);
    expect(sortLeaderboard(rows, 'losers').map((row) => row.symbol)).toEqual(['ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
    expect(sortLeaderboard(rows, 'volume').map((row) => row.symbol)).toEqual(['ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
  });
});
