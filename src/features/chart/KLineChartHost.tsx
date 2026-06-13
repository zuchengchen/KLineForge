import { type Chart, type Crosshair, type KLineData } from 'klinecharts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ChartSettings,
  ChartId,
  ConnectionState,
  DrawingObject,
  DrawingStyle,
  DrawingType,
  Interval,
  IndicatorConfig,
  MarketType,
} from '../../types/domain';
import { DrawingToolbar } from '../drawings/DrawingToolbar';
import { createDrawingObject } from '../drawings/drawingDefinitions';
import {
  deleteDrawing,
  getDrawings,
  putDrawing,
} from '../drawings/drawingRepository';
import { DrawingHistory, invertDrawingHistoryEntry, replayDrawingHistoryEntry } from '../drawings/drawingHistory';
import { toOverlayCreate } from '../drawings/klineDrawingAdapter';
import { deleteIndicatorConfig, getIndicatorConfigs, updateIndicatorConfig } from '../indicators/indicatorConfigRepository';
import { IndicatorSettingsDialog } from '../indicators/IndicatorSettingsDialog';
import type { ChartKlineLoadResult } from './chartDataLoader';
import { createDefaultDrawingPoints, persistOverlayDrawing } from './chartDrawingHelpers';
import { drawingOverlayGroupId, overlayPaneId } from './chartOverlayConstants';
import { getLatestOhlcCandle } from './chartOhlcLegend';
import { attachCrosshairSync } from './crosshairSync';
import { IndicatorLegendOverlay, type IndicatorPaneLegendGroup } from './IndicatorLegendOverlay';
import { hitTestIndicatorLine } from './indicatorHitTesting';
import { isEditableTarget } from './keyboardTargets';
import { useChartDataFeed } from './useChartDataFeed';
import { useChartIndicators } from './useChartIndicators';
import { useKLineChartInstance } from './useKLineChartInstance';
import { useChartStyleSettings } from './useChartStyleSettings';
import { useYAxisWheelZoom } from './useYAxisWheelZoom';
import './KLineChartHost.css';

interface KLineChartHostProps {
  chartId: ChartId;
  market: MarketType;
  symbol: string;
  interval: Interval;
  theme: 'dark' | 'light';
  settings: ChartSettings;
  indicatorRevision: number;
  isFullscreen: boolean;
  isActive: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onExportPng: () => void;
}

type ChartStatus = 'loading' | 'ready' | 'error';

function getChartPricePrecision(chart: Chart | null): number {
  const precision = chart?.getSymbol?.()?.pricePrecision;

  return typeof precision === 'number' && Number.isFinite(precision) ? precision : 4;
}

function resolveCrosshairCandle(chart: Chart, data?: unknown): KLineData | null {
  const crosshair = data as Crosshair | undefined;

  if (crosshair?.kLineData) {
    return crosshair.kLineData;
  }

  if (typeof crosshair?.timestamp === 'number') {
    return chart.getDataList().find((item) => item.timestamp === crosshair.timestamp) ?? null;
  }

  if (typeof crosshair?.x === 'number') {
    const point = chart.convertFromPixel([{ x: crosshair.x }]);
    const timestamp = Array.isArray(point) ? point[0]?.timestamp : point.timestamp;

    if (typeof timestamp === 'number') {
      return chart.getDataList().find((item) => item.timestamp === timestamp) ?? null;
    }
  }

  return null;
}

function areLegendGroupsEqual(left: IndicatorPaneLegendGroup[], right: IndicatorPaneLegendGroup[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((group, index) => {
    const other = right[index];

    return (
      other !== undefined &&
      group.paneId === other.paneId &&
      group.top === other.top &&
      group.configs.length === other.configs.length &&
      group.configs.every((config, configIndex) => {
        const otherConfig = other.configs[configIndex];

        return (
          otherConfig !== undefined &&
          config.id === otherConfig.id &&
          config.visible === otherConfig.visible &&
          config.updatedAt === otherConfig.updatedAt &&
          config.calcParams.join(',') === otherConfig.calcParams.join(',')
        );
      })
    );
  });
}

export function KLineChartHost({
  chartId,
  indicatorRevision,
  isActive,
  interval,
  isFullscreen,
  market,
  onEnterFullscreen,
  onExitFullscreen,
  onExportPng,
  settings,
  symbol,
  theme,
}: KLineChartHostProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const drawingHistoryRef = useRef(new DrawingHistory());
  const drawingWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const keyboardActionsRef = useRef({
    armDrawingTool: (() => undefined) as (type: DrawingType) => void,
    deleteSelectedDrawing: () => {},
    redoDrawing: () => {},
    undoDrawing: () => {},
  });
  const drawingInteractionRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const lastEmittedCrosshairTimestampRef = useRef<number | null>(null);
  const drawingsRef = useRef<DrawingObject[]>([]);
  const [status, setStatus] = useState<ChartStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<ChartKlineLoadResult['source'] | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [pendingTool, setPendingTool] = useState<DrawingType | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState({ canRedo: false, canUndo: false });
  const [legendCandle, setLegendCandle] = useState<KLineData | null>(null);
  const [indicatorConfigs, setIndicatorConfigs] = useState<IndicatorConfig[]>([]);
  const [indicatorPaneGroups, setIndicatorPaneGroups] = useState<IndicatorPaneLegendGroup[]>([]);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  const [hoveredIndicatorId, setHoveredIndicatorId] = useState<string | null>(null);
  const [settingsIndicator, setSettingsIndicator] = useState<IndicatorConfig | null>(null);
  const [localIndicatorRevision, setLocalIndicatorRevision] = useState(0);
  const [pricePrecision, setPricePrecision] = useState(4);

  const syncHistoryState = () => {
    setHistoryState({
      canRedo: drawingHistoryRef.current.canRedo(),
      canUndo: drawingHistoryRef.current.canUndo(),
    });
  };

  const enqueueDrawingWrite = (task: () => Promise<unknown>) => {
    drawingWriteQueueRef.current = drawingWriteQueueRef.current
      .then(task, task)
      .then(() => undefined)
      .catch((writeError: unknown) => {
        const message = writeError instanceof Error ? writeError.message : 'Drawing write failed.';
        console.error(message);
      });
  };

  const syncDrawings = (nextDrawings: DrawingObject[]) => {
    drawingsRef.current = nextDrawings;
    setDrawings(nextDrawings);
  };

  const renderDrawings = useCallback((chart: Chart, nextDrawings: DrawingObject[]) => {
    chart.removeOverlay({ groupId: drawingOverlayGroupId });

    for (const drawing of nextDrawings) {
      chart.removeOverlay({ id: drawing.id });
      chart.createOverlay({
        ...toOverlayCreate(drawing),
        paneId: overlayPaneId,
        onSelected: () => {
          drawingInteractionRef.current = true;
          setSelectedDrawingId(drawing.id);
        },
        onDeselected: () => {
          drawingInteractionRef.current = false;
          setPendingTool(null);
          setSelectedDrawingId((currentId) => (currentId === drawing.id ? null : currentId));
        },
        onDrawEnd: (event) => {
          drawingInteractionRef.current = false;
          setPendingTool(null);
          const nextDrawing = persistOverlayDrawing(event.overlay, drawing);
          void putDrawing(nextDrawing).then((savedDrawing) => {
            syncDrawings(drawingsRef.current.map((item) => (item.id === savedDrawing.id ? savedDrawing : item)));
          });
        },
        onPressedMoveStart: () => {
          drawingInteractionRef.current = true;
        },
        onPressedMoving: () => {
          drawingInteractionRef.current = true;
        },
        onPressedMoveEnd: (event) => {
          drawingInteractionRef.current = false;
          if (drawing.locked) {
            return;
          }

          const before = drawingsRef.current.find((item) => item.id === drawing.id) ?? drawing;
          const nextDrawing = persistOverlayDrawing(event.overlay, before);

          void putDrawing(nextDrawing).then((savedDrawing) => {
            syncDrawings(drawingsRef.current.map((item) => (item.id === savedDrawing.id ? savedDrawing : item)));
            drawingHistoryRef.current.push({ action: 'move', before, after: savedDrawing });
            syncHistoryState();
          });
        },
      });
    }
  }, []);

  useEffect(() => {
    if (pendingTool === null && selectedDrawingId === null) {
      drawingInteractionRef.current = false;
    }
  }, [pendingTool, selectedDrawingId]);

  const refreshIndicatorConfigs = useCallback(async () => {
    const nextConfigs = await getIndicatorConfigs({ market, symbol, chartId, interval });

    setIndicatorConfigs(nextConfigs);
    setSettingsIndicator((current) =>
      current ? nextConfigs.find((config) => config.id === current.id) ?? null : null,
    );
    setSelectedIndicatorId((current) =>
      current && nextConfigs.some((config) => config.id === current) ? current : null,
    );
    setLocalIndicatorRevision((revision) => revision + 1);
  }, [chartId, interval, market, symbol]);

  const handleChartInitError = useCallback((message: string) => {
    setStatus('error');
    setError(message);
  }, []);

  useKLineChartInstance({
    chartId,
    chartRef,
    containerRef,
    onInitError: handleChartInitError,
    theme,
  });

  useChartStyleSettings({ chartRef, settings });
  useYAxisWheelZoom({
    chartRef,
    isVerticalPanDisabled: pendingTool !== null || selectedDrawingId !== null,
    resetKey: `${market}:${symbol}:${interval}`,
    verticalPanBlockRef: drawingInteractionRef,
  });

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    return attachCrosshairSync(chart, chartId, interval, lastEmittedCrosshairTimestampRef);
  }, [chartId, interval]);

  useChartIndicators({
    chartId,
    chartRef,
    indicatorRevision: indicatorRevision + localIndicatorRevision,
    interval,
    market,
    selectedIndicatorId,
    symbol,
  });

  useEffect(() => {
    let active = true;

    getIndicatorConfigs({ market, symbol, chartId, interval }).then((configs) => {
      if (active) {
        setIndicatorConfigs(configs);
        setSelectedIndicatorId(null);
        setHoveredIndicatorId(null);
        setSettingsIndicator(null);
      }
    });

    return () => {
      active = false;
    };
  }, [chartId, indicatorRevision, interval, market, symbol]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const updateLegendCandle = (data?: unknown) => {
      setLegendCandle(resolveCrosshairCandle(chart, data) ?? getLatestOhlcCandle(chart.getDataList()));
    };

    const restoreLatest = () => setLegendCandle(getLatestOhlcCandle(chart.getDataList()));
    const chartDom = chart.getDom();

    restoreLatest();
    chart.subscribeAction('onCrosshairChange', updateLegendCandle);
    chartDom?.addEventListener('mouseleave', restoreLatest);

    return () => {
      chart.unsubscribeAction('onCrosshairChange', updateLegendCandle);
      chartDom?.removeEventListener('mouseleave', restoreLatest);
    };
  }, [chartRef, chartId, interval, market, symbol, status]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const updatePrecision = () => setPricePrecision(getChartPricePrecision(chart));

    updatePrecision();
    chart.subscribeAction('onVisibleRangeChange', updatePrecision);

    return () => chart.unsubscribeAction('onVisibleRangeChange', updatePrecision);
  }, [chartRef, chartId, interval, market, symbol, status]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    let animationFrameId: number | null = null;
    const updatePaneGroups = () => {
      const visibleConfigs = indicatorConfigs;
      const groupsByPane = new Map<string, IndicatorConfig[]>();

      for (const config of visibleConfigs) {
        const paneId = config.pane === 'main' ? 'candle_pane' : `${chartId}-${config.name}-pane`;
        groupsByPane.set(paneId, [...(groupsByPane.get(paneId) ?? []), config]);
      }

      const nextGroups = [...groupsByPane.entries()].map(([paneId, configs]) => ({
          paneId,
          top: paneId === 'candle_pane' ? 0 : chart.getSize(paneId)?.top ?? 0,
          configs,
        }));

      setIndicatorPaneGroups((currentGroups) =>
        areLegendGroupsEqual(currentGroups, nextGroups) ? currentGroups : nextGroups,
      );
    };
    const schedulePaneGroupUpdate = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        updatePaneGroups();
      });
    };

    updatePaneGroups();
    const resizeObserver = new ResizeObserver(schedulePaneGroupUpdate);
    const root = chart.getDom();

    if (root) {
      resizeObserver.observe(root);
    }

    const onVisibleRangeChange = () => schedulePaneGroupUpdate();
    chart.subscribeAction('onVisibleRangeChange', onVisibleRangeChange);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      chart.unsubscribeAction('onVisibleRangeChange', onVisibleRangeChange);
    };
  }, [chartId, chartRef, indicatorConfigs, localIndicatorRevision, status]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    let active = true;

    drawingHistoryRef.current.clear();
    syncHistoryState();
    setSelectedDrawingId(null);

    getDrawings({ market, symbol, chartId, interval }).then((storedDrawings) => {
      if (!active || chartRef.current !== chart) {
        return;
      }

      syncDrawings(storedDrawings);
      renderDrawings(chart, storedDrawings);
    });

    return () => {
      active = false;
    };
  }, [chartId, interval, market, renderDrawings, symbol]);

  useChartDataFeed({
    chartId,
    chartRef,
    interval,
    loadGenerationRef,
    market,
    onConnectionState: setConnectionState,
    onDataSource: setDataSource,
    onError: setError,
    onStatus: setStatus,
    symbol,
  });

  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null;

  const commitDrawingList = (nextDrawings: DrawingObject[]) => {
    const chart = chartRef.current;

    syncDrawings(nextDrawings);

    if (chart) {
      renderDrawings(chart, nextDrawings);
    }
  };

  const createChartDrawing = async (type: DrawingType) => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const points = createDefaultDrawingPoints(chart, type);

    if (points.length === 0) {
      return;
    }

    const draft = createDrawingObject({
      market,
      symbol,
      chartId,
      interval,
      type,
      points,
      text: type === 'text' ? 'Note' : type === 'measurement' ? 'Measure' : undefined,
    });
    const drawing = draft;
    const nextDrawings = [...drawingsRef.current, drawing];

    drawingHistoryRef.current.push({ action: 'create', after: drawing });
    syncHistoryState();
    setSelectedDrawingId(drawing.id);
    commitDrawingList(nextDrawings);
    enqueueDrawingWrite(() => putDrawing(drawing));
  };

  const armDrawingTool = async (type: DrawingType) => {
    setPendingTool(type);
    await createChartDrawing(type);
  };

  const updateSelectedDrawing = async (
    updates: Partial<Pick<DrawingObject, 'locked' | 'points' | 'text' | 'visible'>> & {
      style?: Partial<DrawingStyle>;
    },
    action: 'style' | 'text' | 'move' | 'visibility' | 'lock' = 'style',
  ) => {
    const currentDrawing = drawingsRef.current.find((drawing) => drawing.id === selectedDrawingId);

    if (!currentDrawing) {
      return;
    }

    if (currentDrawing.locked && action !== 'style' && action !== 'visibility' && action !== 'lock') {
      return;
    }

    const before = currentDrawing;
    const updated: DrawingObject = {
      ...currentDrawing,
      ...updates,
      style: {
        ...currentDrawing.style,
        ...updates.style,
      },
      updatedAt: Date.now(),
    };
    const historyAction = action === 'visibility' || action === 'lock' ? 'style' : action;

    drawingHistoryRef.current.push({ action: historyAction, before, after: updated });
    syncHistoryState();
    commitDrawingList(drawingsRef.current.map((drawing) => (drawing.id === updated.id ? updated : drawing)));
    enqueueDrawingWrite(() => putDrawing(updated));
  };

  const deleteSelectedDrawing = async () => {
    const currentDrawing = drawingsRef.current.find((drawing) => drawing.id === selectedDrawingId);

    if (!currentDrawing) {
      return;
    }

    const deleted = currentDrawing;

    drawingHistoryRef.current.push({ action: 'delete', before: deleted });
    syncHistoryState();
    setPendingTool(null);
    setSelectedDrawingId(null);
    commitDrawingList(drawingsRef.current.filter((drawing) => drawing.id !== currentDrawing.id));
    enqueueDrawingWrite(() => deleteDrawing(currentDrawing.id));
  };

  const restoreHistoryState = async (drawing: DrawingObject | null) => {
    if (!drawing) {
      return;
    }

    commitDrawingList(
      drawingsRef.current.some((item) => item.id === drawing.id)
        ? drawingsRef.current.map((item) => (item.id === drawing.id ? drawing : item))
        : [...drawingsRef.current, drawing],
    );
    enqueueDrawingWrite(() => putDrawing(drawing));
  };

  const removeHistoryState = async (drawing: DrawingObject | null) => {
    if (!drawing) {
      return;
    }

    commitDrawingList(drawingsRef.current.filter((item) => item.id !== drawing.id));
    enqueueDrawingWrite(() => deleteDrawing(drawing.id));
  };

  const undoDrawing = async () => {
    const entry = drawingHistoryRef.current.undo();

    if (!entry) {
      return;
    }

    const target = invertDrawingHistoryEntry(entry);

    if (target) {
      await restoreHistoryState(target);
      setSelectedDrawingId(target.id);
    } else {
      await removeHistoryState(entry.after ?? null);
      setSelectedDrawingId(null);
    }

    syncHistoryState();
  };

  const redoDrawing = async () => {
    const entry = drawingHistoryRef.current.redo();

    if (!entry) {
      return;
    }

    const target = replayDrawingHistoryEntry(entry);

    if (target) {
      await restoreHistoryState(target);
      setSelectedDrawingId(target.id);
    } else {
      await removeHistoryState(entry.before ?? null);
      setSelectedDrawingId(null);
    }

    syncHistoryState();
  };

  const selectIndicator = (config: IndicatorConfig) => {
    setSelectedDrawingId(null);
    setPendingTool(null);
    setSelectedIndicatorId(config.id);
  };

  const toggleIndicator = async (config: IndicatorConfig) => {
    await updateIndicatorConfig(config.id, { visible: !config.visible });
    await refreshIndicatorConfigs();
  };

  const removeIndicator = async (config: IndicatorConfig) => {
    await deleteIndicatorConfig(config.id);
    if (selectedIndicatorId === config.id) {
      setSelectedIndicatorId(null);
    }
    if (settingsIndicator?.id === config.id) {
      setSettingsIndicator(null);
    }
    await refreshIndicatorConfigs();
  };

  const openIndicatorSettings = (config: IndicatorConfig) => {
    selectIndicator(config);
    setSettingsIndicator(config);
  };

  useEffect(() => {
    const chart = chartRef.current;
    const root = chart?.getDom();

    if (!chart || !root) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      if (pendingTool !== null || selectedDrawingId !== null || drawingInteractionRef.current || isEditableTarget(event.target)) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const dataList = chart.getDataList();

      for (const config of indicatorConfigs) {
        const hitId = hitTestIndicatorLine({
          config,
          dataList,
          point,
          toPixel: ({ paneId, timestamp, value }) => {
            const pixel = chart.convertToPixel({ timestamp, value }, { paneId, absolute: true });

            return 'x' in pixel &&
              'y' in pixel &&
              typeof pixel.x === 'number' &&
              typeof pixel.y === 'number'
              ? { x: pixel.x, y: pixel.y }
              : null;
          },
        });

        if (hitId) {
          event.stopPropagation();
          setSelectedIndicatorId(hitId);
          return;
        }
      }
    };

    root.addEventListener('click', onClick);

    return () => root.removeEventListener('click', onClick);
  }, [chartRef, indicatorConfigs, pendingTool, selectedDrawingId]);

  useEffect(() => {
    keyboardActionsRef.current = {
      armDrawingTool: (type: DrawingType) => {
        void armDrawingTool(type);
      },
      deleteSelectedDrawing: () => {
        void deleteSelectedDrawing();
      },
      redoDrawing: () => {
        void redoDrawing();
      },
      undoDrawing: () => {
        void undoDrawing();
      },
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!isActive) {
        return;
      }

      const key = event.key.toLowerCase();
      const commandPressed = event.ctrlKey || event.metaKey;

      if (event.key === 'Escape') {
        setPendingTool(null);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        event.preventDefault();
        keyboardActionsRef.current.deleteSelectedDrawing();
        return;
      }

      if (commandPressed && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        keyboardActionsRef.current.undoDrawing();
        return;
      }

      if ((commandPressed && key === 'y') || (commandPressed && event.shiftKey && key === 'z')) {
        event.preventDefault();
        keyboardActionsRef.current.redoDrawing();
        return;
      }

      const shortcutMap: Partial<Record<string, DrawingType>> = {
        h: 'horizontal-line',
        m: 'measurement',
        r: 'rectangle',
        t: 'trend-line',
        v: 'vertical-line',
      };
      const tool = shortcutMap[key];

      if (tool) {
        event.preventDefault();
        keyboardActionsRef.current.armDrawingTool(tool);
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);

    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isActive, selectedDrawingId]);

  return (
    <div
      className="kline-chart-host"
      data-chart-id={chartId}
      data-status={status}
      data-source={dataSource ?? ''}
      data-connection-state={connectionState}
    >
      <div ref={containerRef} className="kline-chart-host__canvas" />
      <IndicatorLegendOverlay
        candle={legendCandle}
        hoveredIndicatorId={hoveredIndicatorId}
        indicatorGroups={indicatorPaneGroups}
        onDeleteIndicator={(config) => void removeIndicator(config)}
        onHoverIndicator={setHoveredIndicatorId}
        onOpenSettings={openIndicatorSettings}
        onSelectIndicator={selectIndicator}
        onToggleIndicator={(config) => void toggleIndicator(config)}
        pricePrecision={pricePrecision}
        selectedIndicatorId={selectedIndicatorId}
      />
      <div className="kline-chart-host__actions">
        <button type="button" onClick={onExportPng}>
          PNG
        </button>
        <button type="button" onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}>
          {isFullscreen ? 'Esc' : 'F'}
        </button>
      </div>
      <DrawingToolbar
        activeDrawing={selectedDrawing}
        canRedo={historyState.canRedo}
        canUndo={historyState.canUndo}
        drawings={drawings}
        pendingTool={pendingTool}
        onCreate={(type) => void armDrawingTool(type)}
        onDelete={() => void deleteSelectedDrawing()}
        onRedo={() => void redoDrawing()}
        onSelect={(id) => {
          if (id === null) {
            setPendingTool(null);
          }

          setSelectedDrawingId(id);
        }}
        onStyleChange={(style) => void updateSelectedDrawing({ style }, 'style')}
        onToggleHidden={() => void updateSelectedDrawing({ visible: !selectedDrawing?.visible }, 'visibility')}
        onToggleLocked={() => void updateSelectedDrawing({ locked: !selectedDrawing?.locked }, 'lock')}
        onUndo={() => void undoDrawing()}
      />
      {status !== 'ready' && (
        <div className="kline-chart-host__status" role="status">
          {status === 'loading' ? t('loadingKlines') : error}
        </div>
      )}
      {status === 'ready' && dataSource && (
        <div className="kline-chart-host__source" aria-label={t('klineDataSource')}>
          {t(`dataSources.${dataSource}`)}
        </div>
      )}
      <div className={`kline-chart-host__connection kline-chart-host__connection--${connectionState}`}>
        {t(`connectionStates.${connectionState}`)}
      </div>
      {settingsIndicator && (
        <IndicatorSettingsDialog
          key={settingsIndicator.id}
          config={settingsIndicator}
          onClose={() => setSettingsIndicator(null)}
          onSaved={() => void refreshIndicatorConfigs()}
        />
      )}
    </div>
  );
}
