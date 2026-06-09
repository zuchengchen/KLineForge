import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChartId, IndicatorConfig, Interval, MarketType } from '../../types/domain';
import {
  addIndicatorConfig,
  deleteIndicatorConfig,
  getIndicatorConfigs,
  updateIndicatorConfig,
} from './indicatorConfigRepository';
import { indicatorDefinitions } from './indicatorDefinitions';

interface IndicatorPanelProps {
  chartId: ChartId;
  interval: Interval;
  market: MarketType;
  symbol: string;
  onClose: () => void;
  onChanged: () => void;
}

function parseParams(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 10_000): Promise<T> {
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function IndicatorPanel({ chartId, interval, market, onChanged, onClose, symbol }: IndicatorPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [configs, setConfigs] = useState<IndicatorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIndicatorName, setPendingIndicatorName] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      setConfigs(await getIndicatorConfigs({ market, symbol, chartId, interval }));
      onChanged();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
      setError(message);
      console.error(message);
    }
  };

  const addIndicator = async (name: IndicatorConfig['name']) => {
    try {
      setPendingIndicatorName(name);
      setError(null);
      setConfigs(
        await withTimeout(
          addIndicatorConfig({ market, symbol, chartId, interval }, name),
          t('indicatorUpdateTimeout'),
        ),
      );
      onChanged();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
      setError(message);
      console.error(message);
    } finally {
      setPendingIndicatorName(null);
    }
  };

  const updateIndicator = async (
    id: string,
    updates: Partial<Pick<IndicatorConfig, 'calcParams' | 'color' | 'lineWidth' | 'visible'>>,
  ) => {
    try {
      setError(null);
      await withTimeout(updateIndicatorConfig(id, updates), t('indicatorUpdateTimeout'));
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
      setError(message);
      console.error(message);
    }
  };

  const removeIndicator = async (id: string) => {
    try {
      setError(null);
      await withTimeout(deleteIndicatorConfig(id), t('indicatorUpdateTimeout'));
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
      setError(message);
      console.error(message);
    }
  };

  useEffect(() => {
    let active = true;

    getIndicatorConfigs({ market, symbol, chartId, interval })
      .then((nextConfigs) => {
        if (active) {
          setConfigs(nextConfigs);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
        setError(message);
        console.error(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [chartId, interval, market, symbol, t]);

  const visibleDefinitions = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();

    return indicatorDefinitions.filter((definition) => definition.name.includes(normalizedQuery));
  }, [query]);

  return (
    <div className="indicator-backdrop" role="presentation" onClick={onClose}>
      <section className="indicator-panel" role="dialog" aria-label={t('indicators')} onClick={(event) => event.stopPropagation()}>
        <header className="indicator-panel__header">
          <div>
            <h2>{t('indicators')}</h2>
            <span>
              {chartId} · {symbol} {interval}
            </span>
          </div>
          <button type="button" onClick={onClose}>
            Esc
          </button>
        </header>
        <label className="indicator-panel__search">
          {t('search')}
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <section>
          <h3>{t('addIndicator')}</h3>
          <div className="indicator-panel__catalog">
            {visibleDefinitions.map((definition) => (
              <button
                key={definition.name}
                type="button"
                data-indicator-catalog-name={definition.name}
                disabled={pendingIndicatorName !== null}
                onClick={() => void addIndicator(definition.name)}
              >
                {definition.name}
                <span>{t(`indicatorPanes.${definition.pane}`)}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>{t('activeIndicators')}</h3>
          <div className="indicator-panel__active">
            {loading && <div className="indicator-panel__state">{t('loadingIndicators')}</div>}
            {error && <div className="indicator-panel__state indicator-panel__state--error">{error}</div>}
            {configs.map((config) => (
              <article key={config.id} className="indicator-config-row" data-indicator-name={config.name}>
                <header>
                  <strong>{config.name}</strong>
                  <span>{t(`indicatorPanes.${config.pane}`)}</span>
                </header>
                <label>
                  {t('params')}
                  <input
                    defaultValue={config.calcParams.join(',')}
                    onBlur={(event) =>
                      void updateIndicator(config.id, { calcParams: parseParams(event.target.value) })
                    }
                  />
                </label>
                <label>
                  {t('color')}
                  <input
                    type="color"
                    defaultValue={config.color}
                    onChange={(event) => void updateIndicator(config.id, { color: event.target.value })}
                  />
                </label>
                <label>
                  {t('lineWidth')}
                  <input
                    min={1}
                    max={5}
                    type="number"
                    defaultValue={config.lineWidth}
                    onBlur={(event) =>
                      void updateIndicator(config.id, { lineWidth: Number(event.target.value) || 1 })
                    }
                  />
                </label>
                <div className="indicator-config-row__actions">
                  <button
                    type="button"
                    onClick={() => void updateIndicator(config.id, { visible: !config.visible })}
                  >
                    {config.visible ? t('hide') : t('show')}
                  </button>
                  <button type="button" onClick={() => void removeIndicator(config.id)}>
                    {t('delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
