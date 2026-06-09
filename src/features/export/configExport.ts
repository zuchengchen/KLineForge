import { createDefaultSession, createDefaultSettings } from '../../app/defaults';
import { database, type WatchlistRecord } from '../../persistence/database';
import {
  supportedIntervals,
  type ChartId,
  type ChartSettings,
  type DrawingObject,
  type DrawingPoint,
  type DrawingStyle,
  type DrawingType,
  type IndicatorConfig,
  type IndicatorName,
  type Interval,
  type LastSessionState,
  type MarketType,
} from '../../types/domain';
import { defaultDrawingStyle, drawingPointCount } from '../drawings/drawingDefinitions';
import { indicatorDefinitions } from '../indicators/indicatorDefinitions';

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
  };
}

const marketTypes = new Set<MarketType>(['spot', 'usdM']);
const chartIds = new Set<ChartId>(['left', 'right']);
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
    fail(`${path} must be left or right.`);
  }

  return value as ChartId;
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

  return {
    ...defaults,
    schemaVersion: 1,
    market: assertMarket(record.market, 'data.lastSession.market'),
    symbol: normalizeSymbol(record.symbol, 'data.lastSession.symbol'),
    leftInterval: assertInterval(record.leftInterval, 'data.lastSession.leftInterval'),
    rightInterval: assertInterval(record.rightInterval, 'data.lastSession.rightInterval'),
    activeChartId: assertChartId(record.activeChartId, 'data.lastSession.activeChartId'),
    fullscreenChartId:
      record.fullscreenChartId === null ? null : assertChartId(record.fullscreenChartId, 'data.lastSession.fullscreenChartId'),
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

function validateIndicatorConfigs(value: unknown): IndicatorConfig[] {
  return assertObjectArray(value, 'data.indicatorConfigs').map((record, index) => {
    if (record.schemaVersion !== 1) {
      fail(`data.indicatorConfigs[${index}].schemaVersion must be 1.`);
    }

    const name = record.name as IndicatorName;

    if (!indicatorNames.has(name)) {
      fail(`data.indicatorConfigs[${index}].name is unsupported.`);
    }

    if (!['main', 'sub'].includes(String(record.pane))) {
      fail(`data.indicatorConfigs[${index}].pane is unsupported.`);
    }

    return {
      id: assertString(record.id, `data.indicatorConfigs[${index}].id`),
      schemaVersion: 1,
      market: assertMarket(record.market, `data.indicatorConfigs[${index}].market`),
      symbol: normalizeSymbol(record.symbol, `data.indicatorConfigs[${index}].symbol`),
      chartId: assertChartId(record.chartId, `data.indicatorConfigs[${index}].chartId`),
      interval: assertInterval(record.interval, `data.indicatorConfigs[${index}].interval`),
      name,
      pane: record.pane as IndicatorConfig['pane'],
      visible: assertBoolean(record.visible, `data.indicatorConfigs[${index}].visible`),
      calcParams: assertNumberArray(record.calcParams, `data.indicatorConfigs[${index}].calcParams`),
      color: assertString(record.color, `data.indicatorConfigs[${index}].color`),
      lineWidth: assertNumber(record.lineWidth, `data.indicatorConfigs[${index}].lineWidth`),
      createdAt: assertNumber(record.createdAt, `data.indicatorConfigs[${index}].createdAt`),
      updatedAt: assertNumber(record.updatedAt, `data.indicatorConfigs[${index}].updatedAt`),
    };
  });
}

export async function createConfigExport(now = new Date()): Promise<KLineForgeConfigExport> {
  const [settings, lastSession, watchlists, drawings, indicatorConfigs] = await Promise.all([
    database.settings.get('chartSettings'),
    database.settings.get('lastSession'),
    database.watchlists.toArray(),
    database.drawings.toArray(),
    database.indicatorConfigs.toArray(),
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
      indicatorConfigs,
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
    },
  };
}

export async function importConfigExport(payload: KLineForgeConfigExport): Promise<void> {
  const validated = validateConfigExport(payload);

  await database.transaction(
    'rw',
    database.settings,
    database.watchlists,
    database.drawings,
    database.indicatorConfigs,
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
      await database.watchlists.bulkPut(validated.data.watchlists);
      await database.drawings.bulkPut(validated.data.drawings);
      await database.indicatorConfigs.bulkPut(validated.data.indicatorConfigs);
    },
  );
}

export function serializeConfigExport(payload: KLineForgeConfigExport): string {
  return JSON.stringify(payload, null, 2);
}
