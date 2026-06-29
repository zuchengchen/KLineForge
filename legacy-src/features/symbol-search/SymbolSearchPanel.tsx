import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketType } from '../../types/domain';
import {
  filterSymbolRows,
  loadSymbolRows,
  sortLeaderboard,
  type LeaderboardKind,
  type SymbolSearchRow,
} from './symbolDiscovery';

interface SymbolSearchPanelProps {
  market: MarketType;
  activeSymbol: string;
  onAddToWatchlist: (symbol: string) => void;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export function SymbolSearchPanel({
  activeSymbol,
  market,
  onAddToWatchlist,
  onClose,
  onSelectSymbol,
}: SymbolSearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [leaderboardKind, setLeaderboardKind] = useState<LeaderboardKind>('gainers');
  const [rows, setRows] = useState<SymbolSearchRow[]>([]);
  const [loadedMarket, setLoadedMarket] = useState<MarketType | null>(null);
  const loading = loadedMarket !== market;

  useEffect(() => {
    let active = true;

    loadSymbolRows(market)
      .then((nextRows) => {
        if (active) {
          setRows(nextRows);
        }
      })
      .finally(() => {
        if (active) {
          setLoadedMarket(market);
        }
      });

    return () => {
      active = false;
    };
  }, [market]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);

    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const visibleRows = useMemo(
    () => sortLeaderboard(filterSymbolRows(rows, query), leaderboardKind).slice(0, 40),
    [leaderboardKind, query, rows],
  );

  return (
    <div className="symbol-search-backdrop" role="presentation" onClick={onClose}>
      <section className="symbol-search-panel" role="dialog" aria-label={t('symbolSearch')} onClick={(event) => event.stopPropagation()}>
        <header className="symbol-search-panel__header">
          <div>
            <h2>{t('symbolSearch')}</h2>
            <span>{market === 'usdM' ? 'USD-M Futures' : 'Spot'}</span>
          </div>
          <button type="button" onClick={onClose}>
            Esc
          </button>
        </header>
        <label className="symbol-search-panel__input">
          {t('search')}
          <input
            autoFocus
            value={query}
            placeholder={activeSymbol}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="symbol-search-panel__tabs" role="tablist" aria-label={t('leaderboards')}>
          {(['gainers', 'losers', 'volume'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={leaderboardKind === kind ? 'symbol-search-panel__tab--active' : ''}
              onClick={() => setLeaderboardKind(kind)}
            >
              {t(`leaderboardKinds.${kind}`)}
            </button>
          ))}
        </div>
        <div className="symbol-search-panel__list">
          {loading && <div className="symbol-search-panel__empty">{t('loadingSymbols')}</div>}
          {!loading && visibleRows.length === 0 && <div className="symbol-search-panel__empty">{t('noSymbolsFound')}</div>}
          {!loading &&
            visibleRows.map((row) => (
              <article key={row.symbol} className="symbol-search-row">
                <button type="button" className="symbol-search-row__main" onClick={() => onSelectSymbol(row.symbol)}>
                  <strong>{row.symbol}</strong>
                  <span>{row.lastPrice}</span>
                </button>
                <span className={Number(row.priceChangePercent) >= 0 ? 'price-change price-change--up' : 'price-change price-change--down'}>
                  {Number(row.priceChangePercent).toFixed(2)}%
                </span>
                <button type="button" onClick={() => onAddToWatchlist(row.symbol)}>
                  {t('add')}
                </button>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
