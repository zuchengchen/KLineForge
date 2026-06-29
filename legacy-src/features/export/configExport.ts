import { createDefaultSession, createDefaultSettings } from '../../app/defaults';
import {
  allChartIds,
  chartLayoutModes,
  normalizeActiveChartId,
  normalizeChartIntervals,
  normalizeFullscreenChartId,
} from '../../types/chartLayout';
import { database, type WatchlistRecord } from '../../persistence/database';
import {
  supportedIntervals,
  type ChartId,
  type ChartIntervalMap,
  type ChartLayout,
  type ChartSettings,
  type DrawingObject,
  type DrawingPoint,
  type DrawingStyle,
  type DrawingType,
  type IndicatorConfig,
  type IndicatorLineStyle,
  type IndicatorName,
  type IndicatorSeriesStyle,
  type IndicatorSource,
  type IndicatorTemplate,
  type Interval,
  type LastSessionState,
  type MarketType,
} from '../../types/domain';
import { defaultDrawingStyle, drawingPointCount } from '../drawings/drawingDefinitions';
import { indicatorDefinitions } from '../indicators/indicatorDefinitions';
import {
  getIndicatorSeriesDefinitions,
  isValidIndicatorColor,
  isValidIndicatorLineStyle,
  isValidIndicatorSource,
  normalizeIndicatorConfig,
  normalizeIndicatorParams,
  normalizeIndicatorTemplate,
  supportsIndicatorSource,
} from '../indicators/indicatorSeriesStyles';

export interface KLineForgeConfigExport {
  schemaVersion: 1;
  app: 'KLineForge';
  exportedAt: string;
  data: {
    settings: ChartSettings | null;
    lastSession: LastSessionState | null;
    watchlists: WatchlistRecord[];
    drawings: DrawingObject[];
    indicatorConfigs: IndicatorConfig[];
    indicatorTemplates: IndicatorTemplate[];
  };
}

const marketTypes = new Set<MarketType>(['spot', 'usdM']);
const chartIds = new Set<ChartId>(allChartIds);
const chartLayouts = new Set<ChartLayout>(chartLayoutModes);
const intervals = new Set<Interval>(supportedIntervals);
const drawingTypes = new Set<DrawingType>([
  'horizontal-line',
  'measurement',
  'rectangle',
  'text',
  'trend-line',
  'vertical-line',
]);
const indicatorNames = new Set<IndicatorName>(indicatorDefinitions.map((definition) => definition.name));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`Config import validation failed: ${message}`);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${path} must be a non-empty string.`);
  }

  return value;
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path} must be a finite number.`);
  }

  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`${path} must be a boolean.`);
  }

  return value;
}

function assertMarket(value: unknown, path: string): MarketType {
  if (!marketTypes.has(value as MarketType)) {
    fail(`${path} must be a supported market.`);
  }

  return value as MarketType;
}

function assertChartId(value: unknown, path: string): ChartId {
  if (!chartIds.has(value as ChartId)) {
    fail(`${path} must be a supported chart id.`);
  }

  return value as ChartId;
}

function assertChartLayout(value: unknown, path: string): ChartLayout {
  if (!chartLayouts.has(value as ChartLayout)) {
    fail(`${path} must be 1, 2, 3 or 4.`);
  }

  return value as ChartLayout;
}

function assertInterval(value: unknown, path: string): Interval {
  if (!intervals.has(value as Interval)) {
    fail(`${path} must be a supported interval.`);
  }

  return value as Interval;
}

function assertNumberArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    fail(`${path} must be an array of finite numbers.`);
  }

  return value;
}

function assertColor(value: unknown, path: string): string {
  const color = assertString(value, path);

  if (!isValidIndicatorColor(color)) {
    fail(`${path} must be a hex color.`);
  }

  return color;
}

function assertLineWidth(value: unknown, path: string): number {
  const lineWidth = assertNumber(value, path);

  if (lineWidth < 1 || lineWidth > 5) {
    fail(`${path} must be between 1 and 5.`);
  }

  return Math.round(lineWidth);
}

function assertIndicatorSource(value: unknown, path: string): IndicatorSource {
  if (!isValidIndicatorSource(value)) {
    fail(`${path} is unsupported.`);
  }

  return value;
}

function assertIndicatorLineStyle(value: unknown, path: string): IndicatorLineStyle {
  if (!isValidIndicatorLineStyle(value)) {
    fail(`${path} is unsupported.`);
  }

  return value;
}

function validateChartIntervals(value: unknown, leftInterval: Interval, rightInterval: Interval): ChartIntervalMap {
  if (value === undefined) {
    return normalizeChartIntervals(undefined, leftInterval, rightInterval);
  }

  const record = assertNullableRecord(value, 'data.lastSession.chartIntervals');

  if (record === null) {
    fail('data.lastSession.chartIntervals must be an object.');
  }

  return {
    left: record.left === undefined ? leftInterval : assertInterval(record.left, 'data.lastSession.chartIntervals.left'),
    right: record.right === undefined ? rightInterval : assertInterval(record.right, 'data.lastSession.chartIntervals.right'),
    third: record.third === undefined ? '4h' : assertInterval(record.third, 'data.lastSession.chartIntervals.third'),
    fourth: record.fourth === undefined ? '1d' : assertInterval(record.fourth, 'data.lastSession.chartIntervals.fourth'),
  };
}

function assertNullableRecord(value: unknown, path: string): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    fail(`${path} must be an object or null.`);
  }

  return value;
}

function assertObjectArray(value: unknown, path: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    fail(`${path} must be an array of objects.`);
  }

  return value;
}

function normalizeSymbol(value: unknown, path: string): string {
  const symbol = assertString(value, path).trim().toUpperCase();

  if (!/^[A-Z0-9]{3,30}$/.test(symbol)) {
    fail(`${path} contains an invalid symbol.`);
  }

  return symbol;
}

function validateSettings(value: unknown): ChartSettings | null {
  const record = assertNullableRecord(value, 'data.settings');

  if (record === null) {
    return null;
  }

  const defaults = createDefaultSettings('en-US', 1);

  if (record.schemaVersion !== 1) {
    fail('data.settings.schemaVersion must be 1.');
  }

  if (!['dark', 'light'].includes(String(record.theme))) {
    fail('data.settings.theme is unsupported.');
  }

  if (!['zh-CN', 'en-US'].includes(String(record.language))) {
    fail('data.settings.language is unsupported.');
  }

  if (!['green-up-red-down', 'red-up-green-down'].includes(String(record.priceColorMode))) {
    fail('data.settings.priceColorMode is unsupported.');
  }

  if (!['candle', 'hollow-candle', 'line'].includes(String(record.chartStyle))) {
    fail('data.settings.chartStyle is unsupported.');
  }

  return {
    ...defaults,
    schemaVersion: 1,
    theme: record.theme as ChartSettings['theme'],
    language: record.language as ChartSettings['language'],
    priceColorMode: record.priceColorMode as ChartSettings['priceColorMode'],
    chartStyle: record.chartStyle as ChartSettings['chartStyle'],
    showGrid: assertBoolean(record.showGrid, 'data.settings.showGrid'),
    showLastPriceLine: assertBoolean(record.showLastPriceLine, 'data.settings.showLastPriceLine'),
    showCrosshair: assertBoolean(record.showCrosshair, 'data.settings.showCrosshair'),
    updatedAt: assertNumber(record.updatedAt, 'data.settings.updatedAt'),
  };
}

function validateLastSession(value: unknown): LastSessionState | null {
  const record = assertNullableRecord(value, 'data.lastSession');

  if (record === null) {
    return null;
  }

  const defaults = createDefaultSession(1);

  if (record.schemaVersion !== 1) {
    fail('data.lastSession.schemaVersion must be 1.');
  }
  const leftInterval = assertInterval(record.leftInterval, 'data.lastSession.leftInterval');
  const rightInterval = assertInterval(record.rightInterval, 'data.lastSession.rightInterval');
  const chartLayout =
    record.chartLayout === undefined ? defaults.chartLayout : assertChartLayout(record.chartLayout, 'data.lastSession.chartLayout');
  const chartIntervals = validateChartIntervals(record.chartIntervals, leftInterval, rightInterval);
  const activeChartId = normalizeActiveChartId(assertChartId(record.activeChartId, 'data.lastSession.activeChartId'), chartLayout);
  const fullscreenChartId =
    record.fullscreenChartId === null
      ? null
      : normalizeFullscreenChartId(assertChartId(record.fullscreenChartId, 'data.lastSession.fullscreenChartId'), chartLayout);

  return {
    ...defaults,
    schemaVersion: 1,
    market: assertMarket(record.market, 'data.lastSession.market'),
    symbol: normalizeSymbol(record.symbol, 'data.lastSession.symbol'),
    chartLayout,
    chartIntervals,
    leftInterval: chartIntervals.left,
    rightInterval: chartIntervals.right,
    activeChartId,
    fullscreenChartId,
    sidebarCollapsed: assertBoolean(record.sidebarCollapsed, 'data.lastSession.sidebarCollapsed'),
    updatedAt: assertNumber(record.updatedAt, 'data.lastSession.updatedAt'),
  };
}

function validateWatchlists(value: unknown): WatchlistRecord[] {
  return assertObjectArray(value, 'data.watchlists').map((record, index) => {
    if (record.schemaVersion !== 1) {
      fail(`data.watchlists[${index}].schemaVersion must be 1.`);
    }

    return {
      schemaVersion: 1,
      market: assertMarket(record.market, `data.watchlists[${index}].market`),
      symbol: normalizeSymbol(record.symbol, `data.watchlists[${index}].symbol`),
      sortOrder: assertNumber(record.sortOrder, `data.watchlists[${index}].sortOrder`),
      createdAt: assertNumber(record.createdAt, `data.watchlists[${index}].createdAt`),
      updatedAt: assertNumber(record.updatedAt, `data.watchlists[${index}].updatedAt`),
    };
  });
}

function validateDrawingPoint(value: unknown, path: string): DrawingPoint {
  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }

  const price = assertString(value.price, `${path}.price`);

  if (!Number.isFinite(Number(price))) {
    fail(`${path}.price must be numeric.`);
  }

  return {
    timestamp: assertNumber(value.timestamp, `${path}.timestamp`),
    price,
  };
}

function validateDrawingStyle(value: unknown, path: string): DrawingStyle {
  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }

  const lineStyle = assertString(value.lineStyle, `${path}.lineStyle`);

  if (!['solid', 'dashed'].includes(lineStyle)) {
    fail(`${path}.lineStyle is unsupported.`);
  }

  return {
    ...defaultDrawingStyle,
    lineColor: assertString(value.lineColor, `${path}.lineColor`),
    lineWidth: assertNumber(value.lineWidth, `${path}.lineWidth`),
    lineStyle: lineStyle as DrawingStyle['lineStyle'],
    opacity: assertNumber(value.opacity, `${path}.opacity`),
    textColor: assertString(value.textColor, `${path}.textColor`),
    textSize: assertNumber(value.textSize, `${path}.textSize`),
    fillColor: assertString(value.fillColor, `${path}.fillColor`),
    fillOpacity: assertNumber(value.fillOpacity, `${path}.fillOpacity`),
  };
}

function validateDrawings(value: unknown): DrawingObject[] {
  return assertObjectArray(value, 'data.drawings').map((record, index) => {
    if (record.schemaVersion !== 1) {
      fail(`data.drawings[${index}].schemaVersion must be 1.`);
    }

    const type = record.type as DrawingType;

    if (!drawingTypes.has(type)) {
      fail(`data.drawings[${index}].type is unsupported.`);
    }

    if (!Array.isArray(record.points)) {
      fail(`data.drawings[${index}].points must be an array.`);
    }

    const points = record.points.map((point, pointIndex) =>
      validateDrawingPoint(point, `data.drawings[${index}].points[${pointIndex}]`),
    );

    if (points.length !== drawingPointCount(type)) {
      fail(`data.drawings[${index}].points has the wrong number of anchors.`);
    }

    return {
      id: assertString(record.id, `data.drawings[${index}].id`),
      schemaVersion: 1,
      market: assertMarket(record.market, `data.drawings[${index}].market`),
      symbol: normalizeSymbol(record.symbol, `data.drawings[${index}].symbol`),
      chartId: assertChartId(record.chartId, `data.drawings[${index}].chartId`),
      interval: assertInterval(record.interval, `data.drawings[${index}].interval`),
      type,
      points,
      text: record.text === undefined ? undefined : assertString(record.text, `data.drawings[${index}].text`),
      style: validateDrawingStyle(record.style, `data.drawings[${index}].style`),
      locked: assertBoolean(record.locked, `data.drawings[${index}].locked`),
      visible: assertBoolean(record.visible, `data.drawings[${index}].visible`),
      createdAt: assertNumber(record.createdAt, `data.drawings[${index}].createdAt`),
      updatedAt: assertNumber(record.updatedAt, `data.drawings[${index}].updatedAt`),
    };
  });
}

function assertIndicatorName(value: unknown, path: string): IndicatorName {
  const name = value as IndicatorName;

  if (!indicatorNames.has(name)) {
    fail(`${path} is unsupported.`);
  }

  return name;
}

function validateIndicatorSeriesStyles(
  value: unknown,
  name: IndicatorName,
  calcParams: number[],
  path: string,
): Record<string, IndicatorSeriesStyle> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }

  const allowedKeys = new Set(getIndicatorSeriesDefinitions(name, calcParams).map((series) => series.key));
  const styles: Record<string, IndicatorSeriesStyle> = {};

  for (const [key, rawStyle] of Object.entries(value)) {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key} is not valid for ${name}.`);
    }

    if (!isRecord(rawStyle)) {
      fail(`${path}.${key} must be an object.`);
    }

    styles[key] = {
      color: assertColor(rawStyle.color, `${path}.${key}.color`),
      lineWidth: assertLineWidth(rawStyle.lineWidth, `${path}.${key}.lineWidth`),
      lineStyle: assertIndicatorLineStyle(rawStyle.lineStyle, `${path}.${key}.lineStyle`),
      visible: assertBoolean(rawStyle.visible, `${path}.${key}.visible`),
    };
  }

  return styles;
}

function validateIndicatorConfigs(value: unknown): IndicatorConfig[] {
  return assertObjectArray(value, 'data.indicatorConfigs').map((record, index) => {
    if (record.schemaVersion !== 1) {
      fail(`data.indicatorConfigs[${index}].schemaVersion must be 1.`);
    }

    const name = assertIndicatorName(record.name, `data.indicatorConfigs[${index}].name`);

    if (!['main', 'sub'].includes(String(record.pane))) {
      fail(`data.indicatorConfigs[${index}].pane is unsupported.`);
    }

    const calcParams = normalizeIndicatorParams(
      name,
      assertNumberArray(record.calcParams, `data.indicatorConfigs[${index}].calcParams`),
    );
    const source =
      record.source === undefined
        ? undefined
        : assertIndicatorSource(record.source, `data.indicatorConfigs[${index}].source`);

    if (source !== undefined && !supportsIndicatorSource(name)) {
      fail(`data.indicatorConfigs[${index}].source is not applicable to ${name}.`);
    }

    return normalizeIndicatorConfig({
      id: assertString(record.id, `data.indicatorConfigs[${index}].id`),
      schemaVersion: 1,
      market: assertMarket(record.market, `data.indicatorConfigs[${index}].market`),
      symbol: normalizeSymbol(record.symbol, `data.indicatorConfigs[${index}].symbol`),
      chartId: assertChartId(record.chartId, `data.indicatorConfigs[${index}].chartId`),
      interval: assertInterval(record.interval, `data.indicatorConfigs[${index}].interval`),
      name,
      pane: record.pane as IndicatorConfig['pane'],
      visible: assertBoolean(record.visible, `data.indicatorConfigs[${index}].visible`),
      calcParams,
      color: assertColor(record.color, `data.indicatorConfigs[${index}].color`),
      lineWidth: assertLineWidth(record.lineWidth, `data.indicatorConfigs[${index}].lineWidth`),
      source,
      seriesStyles: validateIndicatorSeriesStyles(
        record.seriesStyles,
        name,
        calcParams,
        `data.indicatorConfigs[${index}].seriesStyles`,
      ),
      settingsVersion: record.settingsVersion === undefined ? undefined : 1,
      createdAt: assertNumber(record.createdAt, `data.indicatorConfigs[${index}].createdAt`),
      updatedAt: assertNumber(record.updatedAt, `data.indicatorConfigs[${index}].updatedAt`),
    });
  });
}

function validateIndicatorTemplates(value: unknown): IndicatorTemplate[] {
  if (value === undefined) {
    return [];
  }

  return assertObjectArray(value, 'data.indicatorTemplates').map((record, index) => {
    if (record.schemaVersion !== 1) {
      fail(`data.indicatorTemplates[${index}].schemaVersion must be 1.`);
    }

    const indicatorName = assertIndicatorName(record.indicatorName, `data.indicatorTemplates[${index}].indicatorName`);
    const calcParams = normalizeIndicatorParams(
      indicatorName,
      assertNumberArray(record.calcParams, `data.indicatorTemplates[${index}].calcParams`),
    );
    const source =
      record.source === undefined
        ? undefined
        : assertIndicatorSource(record.source, `data.indicatorTemplates[${index}].source`);

    if (source !== undefined && !supportsIndicatorSource(indicatorName)) {
      fail(`data.indicatorTemplates[${index}].source is not applicable to ${indicatorName}.`);
    }

    return normalizeIndicatorTemplate({
      id: assertString(record.id, `data.indicatorTemplates[${index}].id`),
      schemaVersion: 1,
      name: assertString(record.name, `data.indicatorTemplates[${index}].name`),
      indicatorName,
      calcParams,
      visible: assertBoolean(record.visible, `data.indicatorTemplates[${index}].visible`),
      color: assertColor(record.color, `data.indicatorTemplates[${index}].color`),
      lineWidth: assertLineWidth(record.lineWidth, `data.indicatorTemplates[${index}].lineWidth`),
      source,
      seriesStyles:
        validateIndicatorSeriesStyles(
          record.seriesStyles,
          indicatorName,
          calcParams,
          `data.indicatorTemplates[${index}].seriesStyles`,
        ) ?? {},
      isDefault: assertBoolean(record.isDefault, `data.indicatorTemplates[${index}].isDefault`),
      createdAt: assertNumber(record.createdAt, `data.indicatorTemplates[${index}].createdAt`),
      updatedAt: assertNumber(record.updatedAt, `data.indicatorTemplates[${index}].updatedAt`),
    });
  });
}

export async function createConfigExport(now = new Date()): Promise<KLineForgeConfigExport> {
  const [settings, lastSession, watchlists, drawings, indicatorConfigs, indicatorTemplates] = await Promise.all([
    database.settings.get('chartSettings'),
    database.settings.get('lastSession'),
    database.watchlists.toArray(),
    database.drawings.toArray(),
    database.indicatorConfigs.toArray(),
    database.indicatorTemplates.toArray(),
  ]);

  return {
    schemaVersion: 1,
    app: 'KLineForge',
    exportedAt: now.toISOString(),
    data: {
      settings: (settings?.value as ChartSettings | undefined) ?? null,
      lastSession: (lastSession?.value as LastSessionState | undefined) ?? null,
      watchlists,
      drawings,
      indicatorConfigs: indicatorConfigs.map(normalizeIndicatorConfig),
      indicatorTemplates: indicatorTemplates.map(normalizeIndicatorTemplate),
    },
  };
}

export function validateConfigExport(value: unknown): KLineForgeConfigExport {
  if (!isRecord(value)) {
    fail('Config import must be a JSON object.');
  }

  if (value.schemaVersion !== 1 || value.app !== 'KLineForge' || !isRecord(value.data)) {
    fail('Config import is not a valid KLineForge export.');
  }

  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    fail('exportedAt must be an ISO date string.');
  }

  const data = value.data;

  return {
    schemaVersion: 1,
    app: 'KLineForge',
    exportedAt: value.exportedAt,
    data: {
      settings: validateSettings(data.settings),
      lastSession: validateLastSession(data.lastSession),
      watchlists: validateWatchlists(data.watchlists),
      drawings: validateDrawings(data.drawings),
      indicatorConfigs: validateIndicatorConfigs(data.indicatorConfigs),
      indicatorTemplates: validateIndicatorTemplates(data.indicatorTemplates),
    },
  };
}

export async function importConfigExport(payload: KLineForgeConfigExport): Promise<void> {
  const validated = validateConfigExport(payload);

  await database.transaction(
    'rw',
    [
      database.settings,
      database.watchlists,
      database.drawings,
      database.indicatorConfigs,
      database.indicatorTemplates,
    ],
    async () => {
      if (validated.data.settings) {
        await database.settings.put({
          key: 'chartSettings',
          value: validated.data.settings,
          schemaVersion: 1,
          updatedAt: Date.now(),
        });
      }

      if (validated.data.lastSession) {
        await database.settings.put({
          key: 'lastSession',
          value: validated.data.lastSession,
          schemaVersion: 1,
          updatedAt: Date.now(),
        });
      }

      await database.watchlists.clear();
      await database.drawings.clear();
      await database.indicatorConfigs.clear();
      await database.indicatorTemplates.clear();
      await database.watchlists.bulkPut(validated.data.watchlists);
      await database.drawings.bulkPut(validated.data.drawings);
      await database.indicatorConfigs.bulkPut(validated.data.indicatorConfigs);
      await database.indicatorTemplates.bulkPut(validated.data.indicatorTemplates);
    },
  );
}

export function serializeConfigExport(payload: KLineForgeConfigExport): string {
  return JSON.stringify(payload, null, 2);
}
