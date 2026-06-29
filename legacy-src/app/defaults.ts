import type { ChartSettings, LastSessionState, LanguageMode } from '../types/domain';
import { defaultChartIntervals } from '../types/chartLayout';

export function detectInitialLanguage(): LanguageMode {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en-US';
}

export function createDefaultSession(now = Date.now()): LastSessionState {
  return {
    schemaVersion: 1,
    market: 'usdM',
    symbol: 'BTCUSDT',
    chartLayout: 2,
    chartIntervals: { ...defaultChartIntervals },
    leftInterval: '5m',
    rightInterval: '1h',
    activeChartId: 'left',
    fullscreenChartId: null,
    sidebarCollapsed: false,
    updatedAt: now,
  };
}

export function createDefaultSettings(
  language: LanguageMode = detectInitialLanguage(),
  now = Date.now(),
): ChartSettings {
  return {
    schemaVersion: 1,
    theme: 'dark',
    language,
    priceColorMode: 'green-up-red-down',
    chartStyle: 'candle',
    showGrid: true,
    showLastPriceLine: true,
    showCrosshair: true,
    updatedAt: now,
  };
}
