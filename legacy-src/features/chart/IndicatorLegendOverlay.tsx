import type { KLineData } from 'klinecharts';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { IndicatorConfig } from '../../types/domain';
import { calculateOhlcAmplitude } from './chartOhlcLegend';
import {
  getIndicatorLegendLabel,
  getIndicatorSeriesDefinitions,
  normalizeIndicatorConfig,
} from '../indicators/indicatorSeriesStyles';

export interface IndicatorPaneLegendGroup {
  paneId: string;
  top: number;
  configs: IndicatorConfig[];
}

interface IndicatorLegendOverlayProps {
  candle: KLineData | null;
  indicatorGroups: IndicatorPaneLegendGroup[];
  selectedIndicatorId: string | null;
  hoveredIndicatorId: string | null;
  pricePrecision: number;
  onDeleteIndicator: (config: IndicatorConfig) => void;
  onHoverIndicator: (id: string | null) => void;
  onOpenSettings: (config: IndicatorConfig) => void;
  onSelectIndicator: (config: IndicatorConfig) => void;
  onToggleIndicator: (config: IndicatorConfig) => void;
}

function formatNumber(value: number | undefined, precision: number): string {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: Math.max(0, Math.min(12, precision)),
    minimumFractionDigits: Math.max(0, Math.min(8, precision)),
  });
}

function formatAmplitude(candle: KLineData | null): string {
  const amplitude = calculateOhlcAmplitude(candle);

  if (amplitude === null) {
    return '--';
  }

  return `${amplitude.toFixed(2)}%`;
}

function IndicatorLegendRow({
  config,
  hovered,
  selected,
  onDeleteIndicator,
  onHoverIndicator,
  onOpenSettings,
  onSelectIndicator,
  onToggleIndicator,
}: {
  config: IndicatorConfig;
  hovered: boolean;
  selected: boolean;
  onDeleteIndicator: (config: IndicatorConfig) => void;
  onHoverIndicator: (id: string | null) => void;
  onOpenSettings: (config: IndicatorConfig) => void;
  onSelectIndicator: (config: IndicatorConfig) => void;
  onToggleIndicator: (config: IndicatorConfig) => void;
}) {
  const { t } = useTranslation();
  const normalizedConfig = useMemo(() => normalizeIndicatorConfig(config), [config]);
  const seriesColors = getIndicatorSeriesDefinitions(normalizedConfig.name, normalizedConfig.calcParams)
    .slice(0, 4)
    .map((series) => normalizedConfig.seriesStyles?.[series.key]?.color ?? normalizedConfig.color);
  const actionsVisible = selected || hovered;

  return (
    <div
      className={[
        'indicator-legend-row',
        selected ? 'indicator-legend-row--selected' : '',
        !normalizedConfig.visible ? 'indicator-legend-row--hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-indicator-id={normalizedConfig.id}
      onClick={() => onSelectIndicator(normalizedConfig)}
      onMouseEnter={() => onHoverIndicator(normalizedConfig.id)}
      onMouseLeave={() => onHoverIndicator(null)}
    >
      <button
        type="button"
        className="indicator-legend-row__name"
        aria-label={t('selectIndicator', { name: normalizedConfig.name })}
        onClick={(event) => {
          event.stopPropagation();
          onSelectIndicator(normalizedConfig);
        }}
      >
        <span className="indicator-legend-row__swatches" aria-hidden="true">
          {seriesColors.map((color, index) => (
            <span key={`${color}-${index}`} style={{ backgroundColor: color }} />
          ))}
        </span>
        <span>{getIndicatorLegendLabel(normalizedConfig)}</span>
      </button>
      <div className={actionsVisible ? 'indicator-legend-row__actions' : 'indicator-legend-row__actions indicator-legend-row__actions--hidden'}>
        <button
          type="button"
          aria-label={normalizedConfig.visible ? t('hideIndicator') : t('showIndicator')}
          title={normalizedConfig.visible ? t('hideIndicator') : t('showIndicator')}
          onClick={(event) => {
            event.stopPropagation();
            onToggleIndicator(normalizedConfig);
          }}
        >
          {normalizedConfig.visible ? 'E' : 'H'}
        </button>
        <button
          type="button"
          aria-label={t('indicatorSettings')}
          title={t('indicatorSettings')}
          onClick={(event) => {
            event.stopPropagation();
            onOpenSettings(normalizedConfig);
          }}
        >
          S
        </button>
        <button
          type="button"
          aria-label={t('deleteIndicator')}
          title={t('deleteIndicator')}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteIndicator(normalizedConfig);
          }}
        >
          X
        </button>
      </div>
    </div>
  );
}

export function IndicatorLegendOverlay({
  candle,
  hoveredIndicatorId,
  indicatorGroups,
  onDeleteIndicator,
  onHoverIndicator,
  onOpenSettings,
  onSelectIndicator,
  onToggleIndicator,
  pricePrecision,
  selectedIndicatorId,
}: IndicatorLegendOverlayProps) {
  return (
    <div className="chart-legend-overlay" aria-label="Chart legend">
      <div className="chart-legend-group chart-legend-group--main" style={{ top: 8 }}>
        <div className="ohlc-legend-row">
          <span>O {formatNumber(candle?.open, pricePrecision)}</span>
          <span>H {formatNumber(candle?.high, pricePrecision)}</span>
          <span>L {formatNumber(candle?.low, pricePrecision)}</span>
          <span>C {formatNumber(candle?.close, pricePrecision)}</span>
          <span>R {formatAmplitude(candle)}</span>
        </div>
        {indicatorGroups
          .find((group) => group.paneId === 'candle_pane')
          ?.configs.map((config) => (
            <IndicatorLegendRow
              key={config.id}
              config={config}
              hovered={hoveredIndicatorId === config.id}
              selected={selectedIndicatorId === config.id}
              onDeleteIndicator={onDeleteIndicator}
              onHoverIndicator={onHoverIndicator}
              onOpenSettings={onOpenSettings}
              onSelectIndicator={onSelectIndicator}
              onToggleIndicator={onToggleIndicator}
            />
          ))}
      </div>
      {indicatorGroups
        .filter((group) => group.paneId !== 'candle_pane')
        .map((group) => (
          <div key={group.paneId} className="chart-legend-group chart-legend-group--sub" style={{ top: group.top + 8 }}>
            {group.configs.map((config) => (
              <IndicatorLegendRow
                key={config.id}
                config={config}
                hovered={hoveredIndicatorId === config.id}
                selected={selectedIndicatorId === config.id}
                onDeleteIndicator={onDeleteIndicator}
                onHoverIndicator={onHoverIndicator}
                onOpenSettings={onOpenSettings}
                onSelectIndicator={onSelectIndicator}
                onToggleIndicator={onToggleIndicator}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
