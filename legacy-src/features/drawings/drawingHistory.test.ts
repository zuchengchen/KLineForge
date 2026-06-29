import { describe, expect, it } from 'vitest';
import type { DrawingObject } from '../../types/domain';
import {
  DrawingHistory,
  invertDrawingHistoryEntry,
  replayDrawingHistoryEntry,
} from './drawingHistory';
import { createDrawingObject } from './drawingDefinitions';

const drawing: DrawingObject = createDrawingObject(
  {
    market: 'usdM',
    symbol: 'BTCUSDT',
    chartId: 'left',
    interval: '5m',
    type: 'trend-line',
    points: [
      { timestamp: 1, price: '1' },
      { timestamp: 2, price: '2' },
    ],
  },
  1,
);

describe('drawing history', () => {
  it('tracks undo and redo stacks for drawing operations', () => {
    const history = new DrawingHistory();

    history.push({ action: 'create', after: drawing });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    expect(history.undo()).toMatchObject({ action: 'create' });
    expect(history.canRedo()).toBe(true);

    expect(history.redo()).toMatchObject({ action: 'create' });
  });

  it('maps create and delete history to persisted drawing states', () => {
    expect(invertDrawingHistoryEntry({ action: 'create', after: drawing })).toBeNull();
    expect(replayDrawingHistoryEntry({ action: 'create', after: drawing })).toEqual(drawing);
    expect(invertDrawingHistoryEntry({ action: 'delete', before: drawing })).toEqual(drawing);
    expect(replayDrawingHistoryEntry({ action: 'delete', before: drawing })).toBeNull();
  });
});
