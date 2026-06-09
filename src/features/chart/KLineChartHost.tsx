import { type Chart } from 'klinecharts';
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
import type { ChartKlineLoadResult } from './chartDataLoader';
import { createDefaultDrawingPoints, overlayPaneId, persistOverlayDrawing } from './chartDrawingHelpers';
import { attachCrosshairSync } from './crosshairSync';
import { isEditableTarget } from './keyboardTargets';
import { useChartDataFeed } from './useChartDataFeed';
import { useChartIndicators } from './useChartIndicators';
import { useKLineChartInstance } from './useKLineChartInstance';
import { useChartStyleSettings } from './useChartStyleSettings';
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
    chart.removeOverlay();

    for (const drawing of nextDrawings) {
      chart.createOverlay({
        ...toOverlayCreate(drawing),
        paneId: overlayPaneId,
        onSelected: () => setSelectedDrawingId(drawing.id),
        onDrawEnd: (event) => {
          const nextDrawing = persistOverlayDrawing(event.overlay, drawing);
          void putDrawing(nextDrawing).then((savedDrawing) => {
            syncDrawings(drawingsRef.current.map((item) => (item.id === savedDrawing.id ? savedDrawing : item)));
          });
        },
        onPressedMoveEnd: (event) => {
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

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    return attachCrosshairSync(chart, chartId, lastEmittedCrosshairTimestampRef);
  }, [chartId]);

  useChartIndicators({ chartId, chartRef, indicatorRevision, interval, market, symbol });

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
        onSelect={setSelectedDrawingId}
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
    </div>
  );
}
