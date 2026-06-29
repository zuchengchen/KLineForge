import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  chartLayoutI18nKeys,
  chartLayoutModes,
  chartNameI18nKeys,
  getChartNumber,
  getSessionChartInterval,
  getVisibleChartIds,
} from '../../types/chartLayout';
import { supportedIntervals, type ChartId, type ChartLayout, type Interval } from '../../types/domain';
import { useSessionStore } from '../../app/stores/sessionStore';
import { KLineChartHost } from '../../features/chart/KLineChartHost';
import { getChartExportHandle } from '../../features/chart/chartExportRegistry';
import { cacheQueueRunner, ensureCacheTasksForSymbol } from '../../features/cache';
import { downloadDataUrl } from '../../features/export/downloads';
import { loadMarketInfo, type MarketInfoSnapshot } from '../../features/market-data/marketInfo';
import { loadSymbolRows, type SymbolSearchRow } from '../../features/symbol-search/symbolDiscovery';
import {
  addWatchlistSymbol,
  getWatchlist,
  removeWatchlistSymbol,
  reorderWatchlist,
} from '../../features/watchlist/watchlistRepository';
import type { WatchlistRecord } from '../../persistence/database';
import {
  loadPersistedSession,
  loadPersistedSettings,
  persistSession,
  persistSettings,
} from '../../persistence/settingsPersistence';
import './AppShell.css';

const CacheManagementPage = lazy(() =>
  import('../../features/cache/CacheManagementPage').then((module) => ({
    default: module.CacheManagementPage,
  })),
);
const ExportPanel = lazy(() =>
  import('../../features/export/ExportPanel').then((module) => ({
    default: module.ExportPanel,
  })),
);
const IndicatorPanel = lazy(() =>
  import('../../features/indicators/IndicatorPanel').then((module) => ({
    default: module.IndicatorPanel,
  })),
);
const SymbolSearchPanel = lazy(() =>
  import('../../features/symbol-search/SymbolSearchPanel').then((module) => ({
    default: module.SymbolSearchPanel,
  })),
);

function ChartPane({ chartId }: { chartId: ChartId }) {
  const { t } = useTranslation();
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [indicatorRevision, setIndicatorRevision] = useState(0);
  const session = useSessionStore((state) => state.session);
  const settings = useSessionStore((state) => state.settings);
  const setActiveChart = useSessionStore((state) => state.setActiveChart);
  const setFullscreenChart = useSessionStore((state) => state.setFullscreenChart);
  const setInterval = useSessionStore((state) => state.setInterval);
  const interval = getSessionChartInterval(session, chartId);
  const title = t(chartNameI18nKeys[chartId]);
  const isFullscreen = session.fullscreenChartId === chartId;
  const exportPng = () => {
    const handle = getChartExportHandle(chartId);

    if (!handle) {
      return;
    }

    downloadDataUrl(`klineforge-${chartId}-${session.symbol}-${new Date().toISOString().replaceAll(':', '-')}.png`, handle.exportPng());
  };

  return (
    <section
      className={`chart-pane ${session.activeChartId === chartId ? 'chart-pane--active' : ''}`}
      aria-label={title}
      data-chart-id={chartId}
      onClick={() => setActiveChart(chartId)}
    >
      <header className="chart-pane__header">
        <div>
          <strong>{title}</strong>
          <span>
            {session.symbol} {interval}
          </span>
        </div>
        <label>
          {t('interval')}
          <select value={interval} onChange={(event) => setInterval(chartId, event.target.value as Interval)}>
            {supportedIntervals.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setIndicatorPanelOpen(true)}>
          {t('indicators')}
        </button>
      </header>
      <KLineChartHost
        chartId={chartId}
        market={session.market}
        symbol={session.symbol}
        interval={interval}
        theme={settings.theme}
        settings={settings}
        indicatorRevision={indicatorRevision}
        isFullscreen={isFullscreen}
        isActive={session.activeChartId === chartId}
        onEnterFullscreen={() => setFullscreenChart(chartId)}
        onExitFullscreen={() => setFullscreenChart(null)}
        onExportPng={exportPng}
      />
      {indicatorPanelOpen && (
        <Suspense fallback={null}>
          <IndicatorPanel
            chartId={chartId}
            interval={interval}
            market={session.market}
            symbol={session.symbol}
            onChanged={() => setIndicatorRevision((revision) => revision + 1)}
            onClose={() => setIndicatorPanelOpen(false)}
          />
        </Suspense>
      )}
    </section>
  );
}

function ChartLayoutControl({
  chartLayout,
  compact = false,
  onChange,
}: {
  chartLayout: ChartLayout;
  compact?: boolean;
  onChange: (chartLayout: ChartLayout) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={compact ? 'chart-layout-control chart-layout-control--compact' : 'chart-layout-control'}
      aria-label={compact ? t('chartLayoutQuickSwitch') : t('chartLayout')}
    >
      {chartLayoutModes.map((layout) => (
        <button
          key={layout}
          type="button"
          className={layout === chartLayout ? 'chart-layout-control__button chart-layout-control__button--active' : 'chart-layout-control__button'}
          aria-label={t(chartLayoutI18nKeys[layout])}
          aria-pressed={layout === chartLayout}
          onClick={() => onChange(layout)}
        >
          {layout}
        </button>
      ))}
    </div>
  );
}

function formatNumber(value: string | undefined, maximumFractionDigits = 8): string {
  if (value === undefined || value === '--') {
    return '--';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(number);
}

function formatPercent(value: string | undefined): string {
  if (value === undefined) {
    return '--';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return `${number.toFixed(2)}%`;
}

function formatCompact(value: string | undefined): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '--';
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    notation: 'compact',
  }).format(number);
}

function formatTime(value: number | undefined): string {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AppShell() {
  const { i18n, t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chart' | 'cache'>('chart');
  const [marketInfo, setMarketInfo] = useState<MarketInfoSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [tickerRows, setTickerRows] = useState<SymbolSearchRow[]>([]);
  const session = useSessionStore((state) => state.session);
  const settings = useSessionStore((state) => state.settings);
  const hydrated = useSessionStore((state) => state.hydrated);
  const hydrate = useSessionStore((state) => state.hydrate);
  const toggleSidebar = useSessionStore((state) => state.toggleSidebar);
  const setMarket = useSessionStore((state) => state.setMarket);
  const setSymbol = useSessionStore((state) => state.setSymbol);
  const setTheme = useSessionStore((state) => state.setTheme);
  const setLanguage = useSessionStore((state) => state.setLanguage);
  const setPriceColorMode = useSessionStore((state) => state.setPriceColorMode);
  const setChartStyle = useSessionStore((state) => state.setChartStyle);
  const setShowCrosshair = useSessionStore((state) => state.setShowCrosshair);
  const setShowGrid = useSessionStore((state) => state.setShowGrid);
  const setShowLastPriceLine = useSessionStore((state) => state.setShowLastPriceLine);
  const setFullscreenChart = useSessionStore((state) => state.setFullscreenChart);
  const setSidebarCollapsed = useSessionStore((state) => state.setSidebarCollapsed);
  const setChartLayout = useSessionStore((state) => state.setChartLayout);
  const visibleChartIds = useMemo(() => getVisibleChartIds(session.chartLayout), [session.chartLayout]);
  const renderedChartIds = session.fullscreenChartId ? [session.fullscreenChartId] : visibleChartIds;
  const visibleIntervals = useMemo(
    () => visibleChartIds.map((chartId) => session.chartIntervals[chartId]),
    [session.chartIntervals, visibleChartIds],
  );
  const visibleIntervalKey = visibleIntervals.join('|');
  const marketBarIntervals = visibleChartIds
    .map((chartId) => `${getChartNumber(chartId)}:${session.chartIntervals[chartId]}`)
    .join(' / ');

  useEffect(() => {
    let active = true;

    async function loadState() {
      const [persistedSession, persistedSettings] = await Promise.all([
        loadPersistedSession(),
        loadPersistedSettings(),
      ]);

      if (active) {
        hydrate(persistedSession, persistedSettings);
      }
    }

    void loadState();

    return () => {
      active = false;
    };
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.priceColor = settings.priceColorMode;
  }, [settings.priceColorMode, settings.theme]);

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
  }, [i18n, settings.language]);

  useEffect(() => {
    if (hydrated) {
      void persistSession(session);
    }
  }, [hydrated, session]);

  useEffect(() => {
    if (hydrated) {
      void persistSettings(settings);
    }
  }, [hydrated, settings]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void ensureCacheTasksForSymbol(session.market, session.symbol, visibleIntervals).then(() =>
      cacheQueueRunner.start(),
    );
  }, [hydrated, session.market, session.symbol, visibleIntervalKey, visibleIntervals]);

  useEffect(() => {
    let active = true;

    Promise.all([getWatchlist(session.market), loadSymbolRows(session.market)]).then(([rows, tickers]) => {
      if (active) {
        setWatchlist(rows);
        setTickerRows(tickers);
      }
    });

    return () => {
      active = false;
    };
  }, [session.market]);

  useEffect(() => {
    let active = true;

    void loadMarketInfo(session.market, session.symbol).then((snapshot) => {
      if (active) {
        setMarketInfo(snapshot);
      }
    });

    const intervalId = globalThis.setInterval(() => {
      void loadMarketInfo(session.market, session.symbol).then((snapshot) => {
        if (active) {
          setMarketInfo(snapshot);
        }
      });
    }, 15_000);

    return () => {
      active = false;
      globalThis.clearInterval(intervalId);
    };
  }, [session.market, session.symbol]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape') {
        setSymbolSearchOpen(false);
        setSettingsOpen(false);
        setFullscreenChart(null);
        return;
      }

      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        setSymbolSearchOpen(true);
      }

      if ((event.key === 'f' || event.key === 'F') && !settingsOpen && !symbolSearchOpen) {
        event.preventDefault();
        setFullscreenChart(session.fullscreenChartId ? null : session.activeChartId);
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);

    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [session.activeChartId, session.fullscreenChartId, setFullscreenChart, settingsOpen, symbolSearchOpen]);

  const addToWatchlist = async (symbol: string) => {
    setWatchlist(await addWatchlistSymbol(session.market, symbol));
  };

  const deleteFromWatchlist = async (symbol: string) => {
    setWatchlist(await removeWatchlistSymbol(session.market, symbol));
  };

  const moveWatchlistSymbol = async (symbol: string, direction: -1 | 1) => {
    const index = watchlist.findIndex((row) => row.symbol === symbol);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= watchlist.length) {
      return;
    }

    const symbols = watchlist.map((row) => row.symbol);
    const [item] = symbols.splice(index, 1);
    symbols.splice(nextIndex, 0, item);
    setWatchlist(await reorderWatchlist(session.market, symbols));
  };

  const selectSymbol = (symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();

    setWatchlist((currentWatchlist) =>
      currentWatchlist.some((row) => row.symbol === normalizedSymbol)
        ? currentWatchlist
        : [
            ...currentWatchlist,
            {
              schemaVersion: 1,
              market: session.market,
              symbol: normalizedSymbol,
              sortOrder: currentWatchlist.length,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
    );
    setSymbol(symbol);
    setActiveView('chart');
    setSymbolSearchOpen(false);
    void addToWatchlist(symbol);
  };

  const tickerBySymbol = new Map(tickerRows.map((row) => [row.symbol, row]));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${session.sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <button className="sidebar__toggle" type="button" onClick={toggleSidebar}>
          {session.sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
        </button>
        {!session.sidebarCollapsed && (
          <>
            <div className="brand">
              <h1>KLineForge</h1>
              <p>{t('appSubtitle')}</p>
            </div>
            <label className="field">
              {t('market')}
              <select
                value={session.market}
                onChange={(event) => {
                  const nextMarket = event.target.value === 'spot' ? 'spot' : 'usdM';
                  setMarket(nextMarket);
                  void getWatchlist(nextMarket).then(setWatchlist);
                  void loadSymbolRows(nextMarket).then(setTickerRows);
                }}
              >
                <option value="usdM">USD-M Futures</option>
                <option value="spot">Spot</option>
              </select>
            </label>
            <button className="sidebar__search-button" type="button" onClick={() => setSymbolSearchOpen(true)}>
              {t('symbolSearch')}
            </button>
            <section className="sidebar__panel">
              <h2>{t('watchlist')}</h2>
              <div className="watchlist">
                {watchlist.map((row, index) => (
                  <article key={row.symbol} className={`watchlist__row ${session.symbol === row.symbol ? 'watchlist__row--active' : ''}`}>
                    <button type="button" className="watchlist__symbol" onClick={() => setSymbol(row.symbol)}>
                      <strong>{row.symbol}</strong>
                      <span>
                        {tickerBySymbol.get(row.symbol)?.lastPrice ?? '--'}
                        {' · '}
                        {Number(tickerBySymbol.get(row.symbol)?.priceChangePercent ?? 0).toFixed(2)}%
                      </span>
                    </button>
                    <div className="watchlist__actions">
                      <button type="button" aria-label={`${t('moveUp')} ${row.symbol}`} disabled={index === 0} onClick={() => void moveWatchlistSymbol(row.symbol, -1)}>
                        ↑
                      </button>
                      <button type="button" aria-label={`${t('moveDown')} ${row.symbol}`} disabled={index === watchlist.length - 1} onClick={() => void moveWatchlistSymbol(row.symbol, 1)}>
                        ↓
                      </button>
                      <button type="button" aria-label={`${t('delete')} ${row.symbol}`} onClick={() => void deleteFromWatchlist(row.symbol)}>
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="sidebar__panel">
              <h2>{t('cache')}</h2>
              <button className="sidebar__cache-button" type="button" onClick={() => setActiveView('cache')}>
                {t('cacheManagement')}
              </button>
            </section>
            <Suspense fallback={null}>
              <ExportPanel
                market={session.market}
                symbol={session.symbol}
                chartIntervals={session.chartIntervals}
                visibleChartIds={renderedChartIds}
              />
            </Suspense>
            <button className="sidebar__settings-button" type="button" onClick={() => setSettingsOpen(true)}>
              {t('settings')}
            </button>
          </>
        )}
      </aside>
      <main className={`workspace ${session.fullscreenChartId ? 'workspace--fullscreen' : ''}`}>
        <header className="market-bar">
          <div className="market-bar__title">
            <span>{t('marketInfo')}</span>
            <strong>{session.symbol}</strong>
          </div>
          <div className="market-bar__stats">
            <span>
              {t('lastPrice')}: {formatNumber(marketInfo?.ticker?.lastPrice)}
            </span>
            <span className={Number(marketInfo?.ticker?.priceChangePercent ?? 0) >= 0 ? 'price-change--up' : 'price-change--down'}>
              24h: {formatPercent(marketInfo?.ticker?.priceChangePercent)}
            </span>
            <span>
              {t('high24h')}: {formatNumber(marketInfo?.ticker?.highPrice)}
            </span>
            <span>
              {t('low24h')}: {formatNumber(marketInfo?.ticker?.lowPrice)}
            </span>
            <span>
              {t('baseVolume24h')}: {formatCompact(marketInfo?.ticker?.volume)}
            </span>
            <span>
              {t('quoteVolume24h')}: {formatCompact(marketInfo?.ticker?.quoteVolume)}
            </span>
            {session.market === 'usdM' && (
              <>
                <span>
                  {t('fundingRate')}: {formatPercent(String(Number(marketInfo?.futuresInfo?.fundingRate ?? 0) * 100))}
                </span>
                <span>
                  {t('markPrice')}: {formatNumber(marketInfo?.futuresInfo?.markPrice)}
                </span>
                <span>
                  {t('indexPrice')}: {formatNumber(marketInfo?.futuresInfo?.indexPrice)}
                </span>
                <span>
                  {t('nextFundingTime')}: {formatTime(marketInfo?.futuresInfo?.nextFundingTime)}
                </span>
              </>
            )}
          </div>
          <div className="market-bar__meta">
            <span>{session.market === 'usdM' ? 'USD-M Futures' : 'Spot'}</span>
            <span>{marketBarIntervals}</span>
            <ChartLayoutControl compact chartLayout={session.chartLayout} onChange={setChartLayout} />
          </div>
        </header>
        {activeView === 'chart' ? (
          <div
            className={`chart-grid chart-grid--layout-${session.chartLayout} ${session.fullscreenChartId ? 'chart-grid--fullscreen' : ''}`}
          >
            {renderedChartIds.map((chartId) => (
              <ChartPane key={chartId} chartId={chartId} />
            ))}
          </div>
        ) : (
          <Suspense fallback={<div className="workspace__loading">{t('loadingCache')}</div>}>
            <CacheManagementPage
              market={session.market}
              symbol={session.symbol}
              intervals={visibleIntervals}
            />
          </Suspense>
        )}
      </main>
      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <section
            className="settings-panel"
            aria-label={t('settings')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-panel__header">
              <h2>{t('settings')}</h2>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Esc
              </button>
            </header>
            <label>
              {t('theme')}
              <select value={settings.theme} onChange={(event) => setTheme(event.target.value === 'light' ? 'light' : 'dark')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label>
              {t('language')}
              <select
                value={settings.language}
                onChange={(event) => setLanguage(event.target.value === 'zh-CN' ? 'zh-CN' : 'en-US')}
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
            <label>
              {t('priceColor')}
              <select
                value={settings.priceColorMode}
                onChange={(event) =>
                  setPriceColorMode(
                    event.target.value === 'red-up-green-down' ? 'red-up-green-down' : 'green-up-red-down',
                  )
                }
              >
                <option value="green-up-red-down">Green up / Red down</option>
                <option value="red-up-green-down">Red up / Green down</option>
              </select>
            </label>
            <label>
              {t('chartLayout')}
              <select
                value={session.chartLayout}
                onChange={(event) => setChartLayout(Number(event.target.value) as ChartLayout)}
              >
                {chartLayoutModes.map((layout) => (
                  <option key={layout} value={layout}>
                    {t(chartLayoutI18nKeys[layout])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('chartStyle')}
              <select
                value={settings.chartStyle}
                onChange={(event) =>
                  setChartStyle(event.target.value === 'hollow-candle' || event.target.value === 'line' ? event.target.value : 'candle')
                }
              >
                <option value="candle">{t('chartStyles.candle')}</option>
                <option value="hollow-candle">{t('chartStyles.hollowCandle')}</option>
                <option value="line">{t('chartStyles.line')}</option>
              </select>
            </label>
            <label className="settings-panel__toggle">
              <input type="checkbox" checked={settings.showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
              {t('gridLines')}
            </label>
            <label className="settings-panel__toggle">
              <input
                type="checkbox"
                checked={settings.showLastPriceLine}
                onChange={(event) => setShowLastPriceLine(event.target.checked)}
              />
              {t('latestPriceLine')}
            </label>
            <label className="settings-panel__toggle">
              <input
                type="checkbox"
                checked={settings.showCrosshair}
                onChange={(event) => setShowCrosshair(event.target.checked)}
              />
              {t('crosshair')}
            </label>
            <label className="settings-panel__toggle">
              <input
                type="checkbox"
                checked={!session.sidebarCollapsed}
                onChange={(event) => setSidebarCollapsed(!event.target.checked)}
              />
              {t('sidebarExpanded')}
            </label>
          </section>
        </div>
      )}
      {symbolSearchOpen && (
        <Suspense fallback={null}>
          <SymbolSearchPanel
            activeSymbol={session.symbol}
            market={session.market}
            onAddToWatchlist={(symbol) => void addToWatchlist(symbol)}
            onClose={() => setSymbolSearchOpen(false)}
            onSelectSymbol={selectSymbol}
          />
        </Suspense>
      )}
    </div>
  );
}
