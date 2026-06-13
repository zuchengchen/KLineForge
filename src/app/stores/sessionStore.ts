import { create } from 'zustand';
import { createDefaultSession, createDefaultSettings } from '../defaults';
import {
  normalizeActiveChartId,
  normalizeChartLayout,
  normalizeFullscreenChartId,
} from '../../types/chartLayout';
import { normalizeSessionState } from '../sessionState';
import type {
  ChartLayout,
  ChartId,
  ChartSettings,
  Interval,
  LastSessionState,
  LanguageMode,
  MarketType,
  PriceColorMode,
  ThemeMode,
} from '../../types/domain';

interface SessionStore {
  session: LastSessionState;
  settings: ChartSettings;
  hydrated: boolean;
  hydrate: (session: Partial<LastSessionState> | null, settings: ChartSettings | null) => void;
  setChartLayout: (chartLayout: ChartLayout) => void;
  setMarket: (market: MarketType) => void;
  setSymbol: (symbol: string) => void;
  setInterval: (chartId: ChartId, interval: Interval) => void;
  setActiveChart: (chartId: ChartId) => void;
  setFullscreenChart: (chartId: ChartId | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageMode) => void;
  setPriceColorMode: (mode: PriceColorMode) => void;
  setChartStyle: (style: ChartSettings['chartStyle']) => void;
  setShowGrid: (showGrid: boolean) => void;
  setShowLastPriceLine: (showLastPriceLine: boolean) => void;
  setShowCrosshair: (showCrosshair: boolean) => void;
}

const touchSession = (session: LastSessionState): LastSessionState => ({
  ...session,
  updatedAt: Date.now(),
});

const touchSettings = (settings: ChartSettings): ChartSettings => ({
  ...settings,
  updatedAt: Date.now(),
});

export const useSessionStore = create<SessionStore>((set) => ({
  session: createDefaultSession(),
  settings: createDefaultSettings(),
  hydrated: false,
  hydrate: (session, settings) =>
    set((state) => ({
      session: normalizeSessionState(session, state.session),
      settings: settings ? { ...state.settings, ...settings } : state.settings,
      hydrated: true,
    })),
  setChartLayout: (chartLayout) =>
    set((state) => {
      const normalizedChartLayout = normalizeChartLayout(chartLayout, state.session.chartLayout);

      return {
        session: touchSession({
          ...state.session,
          chartLayout: normalizedChartLayout,
          activeChartId: normalizeActiveChartId(state.session.activeChartId, normalizedChartLayout),
          fullscreenChartId: normalizeFullscreenChartId(state.session.fullscreenChartId, normalizedChartLayout),
        }),
      };
    }),
  setMarket: (market) =>
    set((state) => ({
      session: touchSession({ ...state.session, market }),
    })),
  setSymbol: (symbol) =>
    set((state) => ({
      session: touchSession({ ...state.session, symbol: symbol.toUpperCase() }),
    })),
  setInterval: (chartId, interval) =>
    set((state) => ({
      session: touchSession({
        ...state.session,
        chartIntervals: {
          ...state.session.chartIntervals,
          [chartId]: interval,
        },
        leftInterval: chartId === 'left' ? interval : state.session.leftInterval,
        rightInterval: chartId === 'right' ? interval : state.session.rightInterval,
      }),
    })),
  setActiveChart: (chartId) =>
    set((state) => ({
      session: touchSession({
        ...state.session,
        activeChartId: normalizeActiveChartId(chartId, state.session.chartLayout),
      }),
    })),
  setFullscreenChart: (fullscreenChartId) =>
    set((state) => ({
      session: touchSession({
        ...state.session,
        fullscreenChartId: normalizeFullscreenChartId(fullscreenChartId, state.session.chartLayout),
      }),
    })),
  setSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => ({
      session: touchSession({ ...state.session, sidebarCollapsed }),
    })),
  toggleSidebar: () =>
    set((state) => ({
      session: touchSession({
        ...state.session,
        sidebarCollapsed: !state.session.sidebarCollapsed,
      }),
    })),
  setTheme: (theme) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, theme }),
    })),
  setLanguage: (language) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, language }),
    })),
  setPriceColorMode: (priceColorMode) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, priceColorMode }),
    })),
  setChartStyle: (chartStyle) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, chartStyle }),
    })),
  setShowGrid: (showGrid) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, showGrid }),
    })),
  setShowLastPriceLine: (showLastPriceLine) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, showLastPriceLine }),
    })),
  setShowCrosshair: (showCrosshair) =>
    set((state) => ({
      settings: touchSettings({ ...state.settings, showCrosshair }),
    })),
}));
