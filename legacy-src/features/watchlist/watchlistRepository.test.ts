import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import {
  addWatchlistSymbol,
  getWatchlist,
  removeWatchlistSymbol,
  reorderWatchlist,
} from './watchlistRepository';

describe('watchlist repository', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('creates a default market-specific watchlist', async () => {
    const rows = await getWatchlist('usdM');

    expect(rows.map((row) => row.symbol)).toEqual(['BTCUSDT']);
    expect(rows[0]).toMatchObject({ market: 'usdM', sortOrder: 0, schemaVersion: 1 });
  });

  it('adds symbols without duplicates', async () => {
    await addWatchlistSymbol('usdM', 'ethusdt');
    await addWatchlistSymbol('usdM', 'ETHUSDT');

    const rows = await getWatchlist('usdM');

    expect(rows.map((row) => row.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('removes and reorders symbols', async () => {
    await addWatchlistSymbol('usdM', 'ETHUSDT');
    await addWatchlistSymbol('usdM', 'BNBUSDT');
    await reorderWatchlist('usdM', ['BNBUSDT', 'BTCUSDT', 'ETHUSDT']);
    await removeWatchlistSymbol('usdM', 'BTCUSDT');

    const rows = await getWatchlist('usdM');

    expect(rows.map((row) => `${row.symbol}:${row.sortOrder}`)).toEqual(['BNBUSDT:0', 'ETHUSDT:1']);
  });
});
