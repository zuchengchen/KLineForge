import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../persistence/database';
import {
  createDrawing,
  deleteDrawing,
  getDrawings,
  putDrawing,
  updateDrawing,
} from './drawingRepository';

const key = {
  market: 'usdM' as const,
  symbol: 'BTCUSDT',
  chartId: 'left' as const,
  interval: '5m' as const,
};

const pointA = { timestamp: 1_700_000_000_000, price: '42000.5' };
const pointB = { timestamp: 1_700_000_300_000, price: '42110.25' };

describe('drawing repository', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('persists drawings with time and price anchors', async () => {
    const drawing = await createDrawing({
      ...key,
      type: 'trend-line',
      points: [pointA, pointB],
    });

    expect(drawing.points).toEqual([pointA, pointB]);
    expect('x' in drawing.points[0]).toBe(false);
    expect('y' in drawing.points[0]).toBe(false);
    expect(await getDrawings(key)).toHaveLength(1);
  });

  it('keeps chart and interval drawings independent', async () => {
    await createDrawing({ ...key, type: 'horizontal-line', points: [pointA] });
    await createDrawing({ ...key, chartId: 'right', interval: '1h', type: 'vertical-line', points: [pointB] });

    expect((await getDrawings(key)).map((drawing) => drawing.type)).toEqual(['horizontal-line']);
    expect((await getDrawings({ ...key, chartId: 'right', interval: '1h' })).map((drawing) => drawing.type)).toEqual([
      'vertical-line',
    ]);
  });

  it('updates style, lock and visibility without deleting the drawing', async () => {
    const drawing = await createDrawing({ ...key, type: 'rectangle', points: [pointA, pointB] });
    const updated = await updateDrawing(drawing.id, {
      locked: true,
      visible: false,
      style: { lineColor: '#ff0000', lineWidth: 3 },
    });

    expect(updated).toMatchObject({
      locked: true,
      visible: false,
      style: { lineColor: '#ff0000', lineWidth: 3 },
    });
    expect(await database.drawings.get(drawing.id)).toBeDefined();
  });

  it('puts and deletes drawings for undo and redo operations', async () => {
    const drawing = await createDrawing({ ...key, type: 'text', points: [pointA], text: 'Entry' });

    await deleteDrawing(drawing.id);
    expect(await database.drawings.get(drawing.id)).toBeUndefined();

    await putDrawing(drawing);
    expect(await database.drawings.get(drawing.id)).toMatchObject({ text: 'Entry' });
  });
});
