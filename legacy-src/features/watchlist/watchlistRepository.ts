import { database, type WatchlistRecord } from '../../persistence/database';
import type { MarketType } from '../../types/domain';

const defaultWatchlistSymbols = ['BTCUSDT'];

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export async function getWatchlist(market: MarketType): Promise<WatchlistRecord[]> {
  const rows = await database.watchlists.where('market').equals(market).sortBy('sortOrder');

  if (rows.length > 0) {
    return rows;
  }

  const now = Date.now();
  const defaults = defaultWatchlistSymbols.map((symbol, index) => ({
    schemaVersion: 1,
    market,
    symbol,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  })) satisfies WatchlistRecord[];

  await database.watchlists.bulkPut(defaults);

  return defaults;
}

export async function addWatchlistSymbol(market: MarketType, symbol: string): Promise<WatchlistRecord[]> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return getWatchlist(market);
  }

  const existing = await getWatchlist(market);

  if (existing.some((row) => row.symbol === normalizedSymbol)) {
    return existing;
  }

  const now = Date.now();
  await database.watchlists.put({
    schemaVersion: 1,
    market,
    symbol: normalizedSymbol,
    sortOrder: existing.length,
    createdAt: now,
    updatedAt: now,
  });

  return getWatchlist(market);
}

export async function removeWatchlistSymbol(market: MarketType, symbol: string): Promise<WatchlistRecord[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  await database.watchlists.delete([market, normalizedSymbol]);

  return reorderWatchlist(
    market,
    (await getWatchlist(market)).filter((row) => row.symbol !== normalizedSymbol).map((row) => row.symbol),
  );
}

export async function reorderWatchlist(market: MarketType, symbols: string[]): Promise<WatchlistRecord[]> {
  const now = Date.now();
  const uniqueSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const existing = await getWatchlist(market);
  const existingBySymbol = new Map(existing.map((row) => [row.symbol, row]));
  const rows = uniqueSymbols.map((symbol, index) => {
    const previous = existingBySymbol.get(symbol);

    return {
      schemaVersion: 1,
      market,
      symbol,
      sortOrder: index,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    } satisfies WatchlistRecord;
  });

  await database.transaction('rw', database.watchlists, async () => {
    await database.watchlists.where('market').equals(market).delete();
    await database.watchlists.bulkPut(rows);
  });

  return rows;
}
