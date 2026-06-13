import type {
  IndicatorConfig,
  IndicatorLineStyle,
  IndicatorName,
  IndicatorSeriesStyle,
  IndicatorSource,
  IndicatorTemplate,
} from '../../types/domain';
import { getIndicatorDefinition } from './indicatorDefinitions';

export interface IndicatorInputDefinition {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

export interface IndicatorSeriesDefinition {
  key: string;
  label: string;
  kind: 'line' | 'histogram';
  styleIndex: number;
}

export const indicatorSources: IndicatorSource[] = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'];

const sourceCapableIndicators = new Set<IndicatorName>(['MA', 'EMA', 'BOLL', 'MACD', 'RSI']);

const colorPalette = [
  '#f5b84b',
  '#2f81f7',
  '#9b8cff',
  '#16c784',
  '#ea3943',
  '#6edff6',
  '#d29922',
  '#ff7b72',
];

const lineStyleValues = new Set<IndicatorLineStyle>(['solid', 'dashed']);

const colorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function sanitizePeriod(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(500, Math.max(1, Math.round(value)));
}

function sanitizePositiveNumber(value: number, fallback: number, max = 1000): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(0.0001, value));
}

function ensureParams(params: number[], defaults: number[], maxLength = defaults.length): number[] {
  const source = params.length > 0 ? params : defaults;
  const normalized = source
    .slice(0, Math.max(maxLength, defaults.length))
    .map((value, index) => sanitizePeriod(value, defaults[index] ?? defaults.at(-1) ?? 1));

  return normalized.length > 0 ? normalized : defaults;
}

export function supportsIndicatorSource(name: IndicatorName): boolean {
  return sourceCapableIndicators.has(name);
}

export function isValidIndicatorSource(value: unknown): value is IndicatorSource {
  return indicatorSources.includes(value as IndicatorSource);
}

export function isValidIndicatorLineStyle(value: unknown): value is IndicatorLineStyle {
  return lineStyleValues.has(value as IndicatorLineStyle);
}

export function isValidIndicatorColor(value: unknown): value is string {
  return typeof value === 'string' && colorPattern.test(value);
}

export function normalizeIndicatorParams(name: IndicatorName, calcParams: number[]): number[] {
  const defaults = getIndicatorDefinition(name).defaultParams;

  switch (name) {
    case 'BOLL':
      return [
        sanitizePeriod(calcParams[0] ?? defaults[0], defaults[0]),
        sanitizePositiveNumber(calcParams[1] ?? defaults[1], defaults[1], 20),
      ];
    case 'SUPERTREND':
      return [
        sanitizePeriod(calcParams[0] ?? defaults[0], defaults[0]),
        sanitizePositiveNumber(calcParams[1] ?? defaults[1], defaults[1], 20),
      ];
    case 'ATR':
      return [sanitizePeriod(calcParams[0] ?? defaults[0], defaults[0])];
    case 'MACD':
    case 'KDJ':
      return ensureParams(calcParams, defaults, 3);
    case 'MA':
    case 'EMA':
    case 'RSI':
    case 'VOL':
      return ensureParams(calcParams, defaults, Math.max(calcParams.length, defaults.length));
    default:
      return defaults;
  }
}

export function getIndicatorInputDefinitions(name: IndicatorName, params: number[]): IndicatorInputDefinition[] {
  const normalizedParams = normalizeIndicatorParams(name, params);

  switch (name) {
    case 'BOLL':
      return [
        { key: 'period', label: 'Period', min: 1, max: 500, step: 1, integer: true },
        { key: 'multiplier', label: 'Multiplier', min: 0.1, max: 20, step: 0.1, integer: false },
      ];
    case 'SUPERTREND':
      return [
        { key: 'atrPeriod', label: 'ATR period', min: 1, max: 500, step: 1, integer: true },
        { key: 'multiplier', label: 'Multiplier', min: 0.1, max: 20, step: 0.1, integer: false },
      ];
    case 'MACD':
      return [
        { key: 'fast', label: 'Fast', min: 1, max: 500, step: 1, integer: true },
        { key: 'slow', label: 'Slow', min: 1, max: 500, step: 1, integer: true },
        { key: 'signal', label: 'Signal', min: 1, max: 500, step: 1, integer: true },
      ];
    case 'KDJ':
      return [
        { key: 'period', label: 'Period', min: 1, max: 500, step: 1, integer: true },
        { key: 'k', label: 'K', min: 1, max: 500, step: 1, integer: true },
        { key: 'd', label: 'D', min: 1, max: 500, step: 1, integer: true },
      ];
    case 'ATR':
      return [{ key: 'period', label: 'Period', min: 1, max: 500, step: 1, integer: true }];
    case 'MA':
    case 'EMA':
    case 'RSI':
    case 'VOL':
      return normalizedParams.map((_, index) => ({
        key: `period${index + 1}`,
        label: `Period ${index + 1}`,
        min: 1,
        max: 500,
        step: 1,
        integer: true,
      }));
    default:
      return [];
  }
}

export function getIndicatorSeriesDefinitions(name: IndicatorName, calcParams: number[]): IndicatorSeriesDefinition[] {
  const params = normalizeIndicatorParams(name, calcParams);

  switch (name) {
    case 'MA':
      return params.map((period, index) => ({
        key: `ma${index + 1}`,
        label: `MA ${period}`,
        kind: 'line',
        styleIndex: index,
      }));
    case 'EMA':
      return params.map((period, index) => ({
        key: `ema${index + 1}`,
        label: `EMA ${period}`,
        kind: 'line',
        styleIndex: index,
      }));
    case 'BOLL':
      return [
        { key: 'up', label: 'Upper', kind: 'line', styleIndex: 0 },
        { key: 'mid', label: 'Middle', kind: 'line', styleIndex: 1 },
        { key: 'down', label: 'Lower', kind: 'line', styleIndex: 2 },
      ];
    case 'SUPERTREND':
      return [{ key: 'supertrend', label: 'Supertrend', kind: 'line', styleIndex: 0 }];
    case 'VOL':
      return [
        { key: 'volume', label: 'Volume', kind: 'histogram', styleIndex: 0 },
        ...params.map((period, index) => ({
          key: `ma${index + 1}`,
          label: `MA ${period}`,
          kind: 'line' as const,
          styleIndex: index,
        })),
      ];
    case 'MACD':
      return [
        { key: 'dif', label: 'DIF', kind: 'line', styleIndex: 0 },
        { key: 'dea', label: 'DEA', kind: 'line', styleIndex: 1 },
        { key: 'macd', label: 'Histogram', kind: 'histogram', styleIndex: 0 },
      ];
    case 'RSI':
      return params.map((period, index) => ({
        key: `rsi${index + 1}`,
        label: `RSI ${period}`,
        kind: 'line',
        styleIndex: index,
      }));
    case 'ATR':
      return [{ key: 'atr', label: 'ATR', kind: 'line', styleIndex: 0 }];
    case 'KDJ':
      return [
        { key: 'k', label: 'K', kind: 'line', styleIndex: 0 },
        { key: 'd', label: 'D', kind: 'line', styleIndex: 1 },
        { key: 'j', label: 'J', kind: 'line', styleIndex: 2 },
      ];
    default:
      return [];
  }
}

function defaultSeriesStyle(color: string, index: number, lineWidth: number): IndicatorSeriesStyle {
  return {
    color: index === 0 ? color : colorPalette[index % colorPalette.length],
    lineWidth: Math.min(5, Math.max(1, Math.round(lineWidth || 1))),
    lineStyle: 'solid',
    visible: true,
  };
}

function normalizeSeriesStyle(
  value: IndicatorSeriesStyle | undefined,
  fallback: IndicatorSeriesStyle,
): IndicatorSeriesStyle {
  const lineWidth = value?.lineWidth;

  return {
    color: isValidIndicatorColor(value?.color) ? value.color : fallback.color,
    lineWidth:
      typeof lineWidth === 'number' && Number.isFinite(lineWidth) && lineWidth >= 1 && lineWidth <= 5
        ? Math.round(lineWidth)
        : fallback.lineWidth,
    lineStyle: isValidIndicatorLineStyle(value?.lineStyle) ? value.lineStyle : fallback.lineStyle,
    visible: typeof value?.visible === 'boolean' ? value.visible : fallback.visible,
  };
}

export function normalizeIndicatorSeriesStyles(
  name: IndicatorName,
  calcParams: number[],
  seriesStyles: Record<string, IndicatorSeriesStyle> | undefined,
  color: string,
  lineWidth: number,
): Record<string, IndicatorSeriesStyle> {
  return Object.fromEntries(
    getIndicatorSeriesDefinitions(name, calcParams).map((series, index) => {
      const fallback = defaultSeriesStyle(color, index, lineWidth);
      return [series.key, normalizeSeriesStyle(seriesStyles?.[series.key], fallback)];
    }),
  );
}

export function normalizeIndicatorConfig(config: IndicatorConfig): IndicatorConfig {
  const definition = getIndicatorDefinition(config.name);
  const calcParams = normalizeIndicatorParams(config.name, config.calcParams);
  const color = isValidIndicatorColor(config.color) ? config.color : definition.color;
  const lineWidth =
    Number.isFinite(config.lineWidth) && config.lineWidth >= 1 && config.lineWidth <= 5
      ? Math.round(config.lineWidth)
      : 1;
  const source = supportsIndicatorSource(config.name) && isValidIndicatorSource(config.source)
    ? config.source
    : supportsIndicatorSource(config.name)
      ? 'close'
      : undefined;

  return {
    ...config,
    symbol: config.symbol.toUpperCase(),
    pane: definition.pane,
    visible: Boolean(config.visible),
    calcParams,
    color,
    lineWidth,
    source,
    seriesStyles: normalizeIndicatorSeriesStyles(config.name, calcParams, config.seriesStyles, color, lineWidth),
    settingsVersion: 1,
  };
}

export function normalizeIndicatorTemplate(template: IndicatorTemplate): IndicatorTemplate {
  const definition = getIndicatorDefinition(template.indicatorName);
  const calcParams = normalizeIndicatorParams(template.indicatorName, template.calcParams);
  const color = isValidIndicatorColor(template.color) ? template.color : definition.color;
  const lineWidth =
    Number.isFinite(template.lineWidth) && template.lineWidth >= 1 && template.lineWidth <= 5
      ? Math.round(template.lineWidth)
      : 1;
  const source = supportsIndicatorSource(template.indicatorName) && isValidIndicatorSource(template.source)
    ? template.source
    : supportsIndicatorSource(template.indicatorName)
      ? 'close'
      : undefined;

  return {
    ...template,
    schemaVersion: 1,
    name: template.name.trim(),
    calcParams,
    visible: Boolean(template.visible),
    color,
    lineWidth,
    source,
    seriesStyles: normalizeIndicatorSeriesStyles(
      template.indicatorName,
      calcParams,
      template.seriesStyles,
      color,
      lineWidth,
    ),
    isDefault: Boolean(template.isDefault),
  };
}

export function applyIndicatorTemplate(
  config: IndicatorConfig,
  template: IndicatorTemplate,
  now = Date.now(),
): IndicatorConfig {
  const normalizedTemplate = normalizeIndicatorTemplate(template);

  return normalizeIndicatorConfig({
    ...config,
    calcParams: normalizedTemplate.calcParams,
    color: normalizedTemplate.color,
    lineWidth: normalizedTemplate.lineWidth,
    visible: normalizedTemplate.visible,
    source: normalizedTemplate.source,
    seriesStyles: normalizedTemplate.seriesStyles,
    updatedAt: now,
  });
}

export function getIndicatorLegendLabel(config: IndicatorConfig): string {
  return [config.name, ...normalizeIndicatorParams(config.name, config.calcParams).map((value) => String(value))].join(' ');
}
