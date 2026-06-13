import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSession, createDefaultSettings } from '../defaults';
import { useSessionStore } from './sessionStore';

describe('session store hydration', () => {
  beforeEach(() => {
    useSessionStore.setState({
      session: createDefaultSession(1),
      settings: createDefaultSettings('en-US', 1),
      hydrated: false,
    });
  });

  it('hydrates persisted session and settings', () => {
    const session = {
      ...createDefaultSession(1),
      symbol: 'ETHUSDT',
      sidebarCollapsed: true,
    };
    const settings = {
      ...createDefaultSettings('en-US', 2),
      theme: 'light' as const,
    };

    useSessionStore.getState().hydrate(session, settings);

    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().session.symbol).toBe('ETHUSDT');
    expect(useSessionStore.getState().session.sidebarCollapsed).toBe(true);
    expect(useSessionStore.getState().settings.theme).toBe('light');
  });

  it('hydrates old two-chart sessions with default layout and extra chart intervals', () => {
    const oldSession = {
      schemaVersion: 1,
      market: 'usdM',
      symbol: 'ethusdt',
      leftInterval: '15m',
      rightInterval: '4h',
      activeChartId: 'right',
      fullscreenChartId: null,
      sidebarCollapsed: false,
      updatedAt: 3,
    } as const;

    useSessionStore.getState().hydrate(oldSession, null);

    expect(useSessionStore.getState().session).toMatchObject({
      chartLayout: 2,
      leftInterval: '15m',
      rightInterval: '4h',
      activeChartId: 'right',
    });
    expect(useSessionStore.getState().session.chartIntervals).toEqual({
      left: '15m',
      right: '4h',
      third: '4h',
      fourth: '1d',
    });
  });

  it('changes layout without deleting hidden chart intervals', () => {
    const store = useSessionStore.getState();

    store.setChartLayout(4);
    useSessionStore.getState().setInterval('third', '12h');
    useSessionStore.getState().setInterval('fourth', '1w');
    useSessionStore.getState().setActiveChart('fourth');

    useSessionStore.getState().setChartLayout(1);

    expect(useSessionStore.getState().session.activeChartId).toBe('left');
    expect(useSessionStore.getState().session.chartIntervals.third).toBe('12h');
    expect(useSessionStore.getState().session.chartIntervals.fourth).toBe('1w');

    useSessionStore.getState().setChartLayout(4);

    expect(useSessionStore.getState().session.chartIntervals.third).toBe('12h');
    expect(useSessionStore.getState().session.chartIntervals.fourth).toBe('1w');
  });

  it('clears fullscreen when the fullscreen chart is hidden by layout changes', () => {
    useSessionStore.getState().setChartLayout(4);
    useSessionStore.getState().setFullscreenChart('third');

    useSessionStore.getState().setChartLayout(2);

    expect(useSessionStore.getState().session.fullscreenChartId).toBeNull();
    expect(useSessionStore.getState().session.activeChartId).toBe('left');
  });
});
