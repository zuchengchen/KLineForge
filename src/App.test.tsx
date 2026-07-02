import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  App,
  chartDataLimitForHistoryState,
  chartIndicatorLimitForData,
  completedFullHistoryRefreshKey,
  completedFullHistoryRefreshKeys,
  createLargePeriodPrefetchRequests,
  formatError,
  indicatorName,
  shouldApplyCompletedFullHistoryRefresh,
  shouldRetryEmptyKlineLoad,
} from './App';
import {
  createDefaultIndicatorInstances,
  exportConfig,
  getDrawings,
  getPreviewIndicatorDebugState,
  getSettings,
  importConfig,
  resetPreviewStateForTests,
  setPreviewCacheTasksForTests,
  saveDrawing,
  saveIndicatorInstance,
  setPreviewSettingsForTests,
} from './services/backend';
import type { AppSettings, CacheTask, DrawingObject, IndicatorInstance } from './services/types';

const chartPaneProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('./components/ChartPane', () => ({
  ChartPane: (props: Record<string, unknown>) => {
    chartPaneProps.push(props);
    return <section class="chart-pane-mock">{String(props.title)}</section>;
  },
}));

describe('App', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    chartPaneProps.length = 0;
    resetPreviewStateForTests();
  });

  it('renders the Tauri performance shell', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);

    expect(root.textContent).toContain('KLineForge');
  });

  it('toggles the sidebar visibility from the toolbar', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);

    const app = root.querySelector('main');
    const toggle = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Hide Sidebar');

    expect(app?.classList.contains('app--sidebar-hidden')).toBe(false);
    expect(toggle).toBeTruthy();

    toggle!.click();
    await tick();

    expect(app?.classList.contains('app--sidebar-hidden')).toBe(true);
    expect(root.textContent).toContain('Show Sidebar');
  });

  it('requests a chart fit when the sidebar visibility changes', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);
    await tick();

    const initialKeys = chartPaneProps.map((props) => (props.fitKey as () => string)());
    const toggle = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Hide Sidebar');

    expect(initialKeys).toEqual(['layout:sidebar', 'layout:sidebar']);
    expect(toggle).toBeTruthy();

    toggle!.click();
    await tick();

    expect(chartPaneProps.map((props) => (props.fitKey as () => string)())).toEqual(['layout:full', 'layout:full']);
  });

  it('keeps chart viewport sync unwired while retaining crosshair sync', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);

    expect(chartPaneProps).toHaveLength(2);
    expect(chartPaneProps.every((props) => typeof props.syncCrosshair === 'function')).toBe(true);
    expect(chartPaneProps.every((props) => !('syncRange' in props))).toBe(true);
    expect(chartPaneProps.every((props) => !('onVisibleRangeChange' in props))).toBe(true);
  });

  it('prefetches larger non-visible periods for multi-period analysis', () => {
    const requests = createLargePeriodPrefetchRequests({
      market: 'usdM',
      symbol: 'BTCUSDT',
      leftInterval: '5m',
      rightInterval: '1h',
      limit: 1000,
    });

    expect(requests.map((request) => request.interval)).toEqual(['2h', '4h', '1d', '1W', '1M']);
    expect(requests.every((request) => request.symbol === 'BTCUSDT' && request.limit === 1000)).toBe(true);
  });

  it('retries K-line loads only after empty or failed completed requests', () => {
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: true, error: undefined })).toBe(false);
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: false, error: undefined })).toBe(true);
    expect(
      shouldRetryEmptyKlineLoad({
        data: { points: [], source: 'sqlite-cache+binance-rest', cached: false },
        loading: false,
        error: undefined,
      }),
    ).toBe(true);
    expect(
      shouldRetryEmptyKlineLoad({
        data: { points: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }], source: 'sqlite-cache', cached: true },
        loading: false,
        error: undefined,
      }),
    ).toBe(false);
    expect(shouldRetryEmptyKlineLoad({ data: undefined, loading: false, error: new Error('network') })).toBe(true);
  });

  it('generates indicator names from editable parameters', () => {
    expect(indicatorName({ kind: 'ma', periods: [5, 10, 30] })).toBe('MA(5,10,30)');
    expect(indicatorName({ kind: 'macd', shortPeriod: 12, longPeriod: 26, signalPeriod: 9 })).toBe('MACD(12,26,9)');
    expect(indicatorName({ kind: 'supertrend', period: 10, multiplier: 3 })).toBe('Supertrend(10,3)');
  });

  it('creates the current default indicator instance set', () => {
    const instances = createDefaultIndicatorInstances('left', '1h');

    expect(instances.map((instance) => instance.name)).toEqual([
      'Volume',
      'MA(5,10,30)',
      'EMA(12,26)',
      'BOLL(20,2)',
      'MACD(12,26,9)',
      'RSI(14)',
      'ATR(14)',
      'KDJ(9,3,3)',
      'Supertrend(10,3)',
    ]);
    expect(instances.every((instance) => instance.chartId === 'left' && instance.interval === '1h')).toBe(true);
  });

  it('preserves and overwrites the left chart indicator config when switching intervals', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const sourceInstances = createDefaultIndicatorInstances('left', '5m');
    const targetInstances = createDefaultIndicatorInstances('left', '15m');
    const rightInstances = createDefaultIndicatorInstances('right', '1h');
    const customizedMa = {
      ...sourceInstances[1],
      id: 'left-5m-custom-ma',
      enabled: false,
      params: { kind: 'ma', periods: [7, 21] },
      styles: {
        7: { color: '#123456', lineWidth: 3, lineStyle: 'dashed' },
        21: { color: '#abcdef', lineWidth: 2, lineStyle: 'dotted' },
      },
    } satisfies IndicatorInstance;

    await saveIndicatorInstance(sourceInstances[0]);
    await saveIndicatorInstance(customizedMa);
    await saveIndicatorInstance({
      ...targetInstances[4],
      id: 'left-15m-old-macd',
      params: { kind: 'macd', shortPeriod: 6, longPeriod: 19, signalPeriod: 4 },
    });
    await saveIndicatorInstance({
      ...rightInstances[5],
      id: 'right-1h-rsi',
      params: { kind: 'rsi', period: 9 },
    });
    render(() => <App />, root);
    await tick();

    selectByLabel(root, '周期 L', '15m');
    await tick();
    await tick();

    const state = getPreviewIndicatorDebugState();
    const leftTarget = state['left:15m'];

    expect(leftTarget.map((instance) => instance.name)).toEqual(['Volume', 'MA(7,21)']);
    expect(leftTarget[1].enabled).toBe(false);
    expect(leftTarget[1].params).toEqual({ kind: 'ma', periods: [7, 21] });
    expect(leftTarget[1].styles).toEqual({
      7: { color: '#123456', lineWidth: 3, lineStyle: 'dashed' },
      21: { color: '#abcdef', lineWidth: 2, lineStyle: 'dotted' },
    });
    expect(state['right:1h'].map((instance) => instance.name)).toEqual(['RSI(9)']);
  });

  it('preserves the right chart indicator config independently from the left chart', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const leftInstances = createDefaultIndicatorInstances('left', '5m');
    const rightSourceInstances = createDefaultIndicatorInstances('right', '1h');
    const rightTargetInstances = createDefaultIndicatorInstances('right', '4h');

    await saveIndicatorInstance({
      ...leftInstances[1],
      id: 'left-5m-ma',
      params: { kind: 'ma', periods: [8, 13] },
    });
    await saveIndicatorInstance({
      ...rightSourceInstances[6],
      id: 'right-1h-atr',
      enabled: false,
      params: { kind: 'atr', period: 21 },
      styles: {
        atr: { color: '#12abef', lineWidth: 4, lineStyle: 'large-dashed' },
      },
    });
    await saveIndicatorInstance({
      ...rightTargetInstances[5],
      id: 'right-4h-old-rsi',
      params: { kind: 'rsi', period: 5 },
    });

    render(() => <App />, root);
    await tick();

    selectByLabel(root, '周期 R', '4h');
    await tick();
    await tick();

    const state = getPreviewIndicatorDebugState();

    expect(state['right:4h'].map((instance) => instance.name)).toEqual(['ATR(21)']);
    expect(state['right:4h'][0].enabled).toBe(false);
    expect(state['right:4h'][0].styles).toEqual({
      atr: { color: '#12abef', lineWidth: 4, lineStyle: 'large-dashed' },
    });
    expect(state['left:5m'].map((instance) => instance.name)).toEqual(['MA(8,13)']);
  });

  it('does not copy drawings when switching intervals', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const drawing: DrawingObject = {
      id: 'left-drawing',
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '5m',
      chartId: 'left',
      drawingType: 'horizontal-line',
      payload: { price: 100 },
      updatedAt: Date.now(),
    };

    await saveDrawing(drawing);
    render(() => <App />, root);
    await tick();

    selectByLabel(root, '周期 L', '15m');
    await tick();
    await tick();

    const targetDrawings = await getDrawings({
      market: 'usdM',
      symbol: 'BTCUSDT',
      interval: '15m',
      chartId: 'left',
    });

    expect(targetDrawings).toEqual([]);
  });

  it('queues full-history downloads for the switched and background intervals', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);
    await tick();

    selectByLabel(root, '周期 L', '15m');
    await tick();
    await tick();

    const tasks = [...root.querySelectorAll('[data-cache-tasks] .cache-task strong')].map(
      (element) => element.textContent,
    );

    expect(tasks).toEqual([
      'BTCUSDT 15m',
      'BTCUSDT 1h',
      'BTCUSDT 2h',
      'BTCUSDT 4h',
      'BTCUSDT 1d',
      'BTCUSDT 1W',
    ]);
  });

  it('queues full-history downloads when switching symbols', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);
    await tick();

    const ethButton = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('ETHUSDT') && button.textContent?.includes('TRADING'),
    );
    expect(ethButton).toBeTruthy();

    ethButton!.click();
    await tick();
    await tick();

    const tasks = [...root.querySelectorAll('[data-cache-tasks] .cache-task strong')].map(
      (element) => element.textContent,
    );

    expect(tasks).toEqual([
      'ETHUSDT 5m',
      'ETHUSDT 1h',
      'ETHUSDT 2h',
      'ETHUSDT 4h',
      'ETHUSDT 1d',
      'ETHUSDT 1W',
    ]);
  });

  it('detects completed full-history tasks for the active chart scope', () => {
    const tasks: CacheTask[] = [
      {
        id: 'full-history:usdM:ETHUSDT:1h',
        market: 'usdM',
        symbol: 'ETHUSDT',
        interval: '1h',
        status: 'complete',
        progress: 1,
        phase: 'complete',
        rowsWritten: 5000,
        archiveMonths: 12,
        restPages: 1,
        updatedAt: 123,
      },
    ];

    expect(completedFullHistoryRefreshKey(tasks, 'usdM', 'ethusdt', '1h')).toBe('usdM:ETHUSDT:1h:123');
    expect(completedFullHistoryRefreshKey(tasks, 'usdM', 'ETHUSDT', '5m')).toBeNull();
    expect([...completedFullHistoryRefreshKeys(tasks)]).toEqual(['usdM:ETHUSDT:1h:123']);
  });

  it('applies only newly completed full-history refreshes', () => {
    const knownRefreshKeys = new Set(['usdM:BTCUSDT:5m:456']);

    expect(
      shouldApplyCompletedFullHistoryRefresh({
        refreshKey: 'usdM:BTCUSDT:5m:456',
        knownRefreshKeys,
        appliedRefreshKey: undefined,
      }),
    ).toBe(false);
    expect(
      shouldApplyCompletedFullHistoryRefresh({
        refreshKey: 'usdM:BTCUSDT:5m:789',
        knownRefreshKeys,
        appliedRefreshKey: undefined,
      }),
    ).toBe(true);
    expect(
      shouldApplyCompletedFullHistoryRefresh({
        refreshKey: 'usdM:BTCUSDT:5m:789',
        knownRefreshKeys,
        appliedRefreshKey: 'usdM:BTCUSDT:5m:789',
      }),
    ).toBe(false);
  });

  it('requests all cached rows for a chart after its full-history task completes', () => {
    expect(
      chartDataLimitForHistoryState({
        chartLimit: 1000,
        completedRefreshKey: 'usdM:BTCUSDT:5m:456',
        request: { market: 'usdM', symbol: 'BTCUSDT', interval: '5m' },
      }),
    ).toBeUndefined();

    expect(
      chartDataLimitForHistoryState({
        chartLimit: 1000,
        completedRefreshKey: 'usdM:BTCUSDT:1h:456',
        request: { market: 'usdM', symbol: 'BTCUSDT', interval: '5m' },
      }),
    ).toBe(1000);
  });

  it('matches indicator calculation limits to the loaded chart window', () => {
    expect(
      chartIndicatorLimitForData({
        requestLimit: undefined,
        loadedRows: 50_000,
        maxRows: 200_000,
      }),
    ).toBeUndefined();
    expect(
      chartIndicatorLimitForData({
        requestLimit: undefined,
        loadedRows: 250_000,
        maxRows: 200_000,
      }),
    ).toBe(0);
    expect(
      chartIndicatorLimitForData({
        requestLimit: 1000,
        loadedRows: 1000,
        maxRows: 200_000,
      }),
    ).toBe(1000);
    expect(
      chartIndicatorLimitForData({
        requestLimit: 250_000,
        loadedRows: 1_000,
        maxRows: 200_000,
      }),
    ).toBe(0);
  });

  it('does not mark startup-completed full-history tasks for immediate all-row fitting', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    setPreviewCacheTasksForTests([
      {
        id: 'full-history:usdM:BTCUSDT:5m',
        market: 'usdM',
        symbol: 'BTCUSDT',
        interval: '5m',
        status: 'complete',
        progress: 1,
        phase: 'complete',
        rowsWritten: 5000,
        archiveMonths: 12,
        restPages: 1,
        updatedAt: 456,
      },
    ]);

    render(() => <App />, root);
    await tick();
    await tick();

    expect((chartPaneProps[0].fitNextDataKey as () => string)()).toBe('usdM:BTCUSDT:5m:1000:open:latest:history:none');
    expect((chartPaneProps[1].fitNextDataKey as () => string)()).toBe('usdM:BTCUSDT:1h:1000:open:latest:history:none');
  });

  it('persists and exports UI preference settings', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);
    await tick();

    selectByLabel(root, ['Rows', '行数'], '100000');
    await tick();
    root.querySelector<HTMLButtonElement>('[data-indicator-scope="right"]')?.click();
    await tick();
    selectByLabel(root, ['Drawing Tool', '画线工具'], 'rectangle');
    await tick();

    const settings = await getSettings();
    const exported = JSON.parse(await exportConfig()) as { schemaVersion: number; settings: AppSettings };

    expect(settings.chartLimit).toBe(100000);
    expect(settings.indicatorConfigChart).toBe('right');
    expect(settings.drawingType).toBe('rectangle');
    expect(exported.schemaVersion).toBe(3);
    expect(exported.settings.chartLimit).toBe(100000);
    expect(exported.settings.indicatorConfigChart).toBe('right');
    expect(exported.settings.drawingType).toBe('rectangle');
  });

  it('imports UI preference settings and rejects missing required settings fields', async () => {
    const config = JSON.parse(await exportConfig()) as {
      settings: AppSettings;
      watchlist: string[];
      drawings: DrawingObject[];
      indicators: IndicatorInstance[];
    };

    config.settings.chartLimit = 1000000;
    config.settings.indicatorConfigChart = 'right';
    config.settings.drawingType = 'measurement';
    await importConfig(JSON.stringify(config));

    expect(await getSettings()).toMatchObject({
      chartLimit: 1000000,
      indicatorConfigChart: 'right',
      drawingType: 'measurement',
    });

    const incomplete = {
      ...config,
      settings: {
        market: 'usdM',
        symbol: 'BTCUSDT',
        leftInterval: '5m',
        rightInterval: '1h',
        theme: 'dark',
        language: 'zh',
      },
    };

    await expect(importConfig(JSON.stringify(incomplete))).rejects.toThrow(/chartLimit/);
  });

  it('normalizes stored settings missing current UI preferences', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    setPreviewSettingsForTests({
      market: 'usdM',
      symbol: 'BTCUSDT',
      leftInterval: '5m',
      rightInterval: '1h',
      theme: 'dark',
      language: 'zh',
    });
    render(() => <App />, root);
    await tick();

    expect(root.querySelector('[data-settings-error]')).toBeNull();
    await expect(getSettings()).resolves.toMatchObject({
      chartLimit: 1000,
      indicatorConfigChart: 'left',
      drawingType: 'horizontal-line',
    });
  });

  it('formats Tauri command errors with their message', () => {
    expect(formatError({ message: 'invalid app-settings', kind: 'message' })).toBe('invalid app-settings');
    expect(formatError({ kind: 'message' })).toBe('{"kind":"message"}');
  });
});

function selectByLabel(root: HTMLElement, label: string | string[], value: string) {
  const labelsToMatch = Array.isArray(label) ? label : [label];
  const labels = [...root.querySelectorAll('label')];
  const element = labels
    .find((candidate) => labelsToMatch.some((item) => candidate.textContent?.includes(item)))
    ?.querySelector('select');

  expect(element).toBeTruthy();

  element!.value = value;
  element!.dispatchEvent(new Event('change', { bubbles: true }));
}

async function tick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
