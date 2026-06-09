import { database } from '../../persistence/database';
import type { DrawingObject, DrawingStyle } from '../../types/domain';
import { createDrawingObject, normalizeDrawingKey, type DrawingDraft, type DrawingKey } from './drawingDefinitions';

export async function getDrawings(key: DrawingKey): Promise<DrawingObject[]> {
  const normalizedKey = normalizeDrawingKey(key);

  return database.drawings
    .where('[market+symbol+chartId+interval]')
    .equals([normalizedKey.market, normalizedKey.symbol, normalizedKey.chartId, normalizedKey.interval])
    .sortBy('createdAt');
}

export async function createDrawing(draft: DrawingDraft): Promise<DrawingObject> {
  const drawing = createDrawingObject({
    ...draft,
    symbol: draft.symbol.toUpperCase(),
  });

  await database.drawings.put(drawing);

  return drawing;
}

export async function putDrawing(drawing: DrawingObject): Promise<DrawingObject> {
  const nextDrawing = {
    ...drawing,
    symbol: drawing.symbol.toUpperCase(),
    updatedAt: Date.now(),
  };

  await database.drawings.put(nextDrawing);

  return nextDrawing;
}

export async function updateDrawing(
  id: string,
  updates: Partial<Pick<DrawingObject, 'locked' | 'points' | 'text' | 'visible'>> & {
    style?: Partial<DrawingStyle>;
  },
): Promise<DrawingObject | null> {
  const current = await database.drawings.get(id);

  if (!current) {
    return null;
  }

  const nextDrawing: DrawingObject = {
    ...current,
    ...updates,
    style: {
      ...current.style,
      ...updates.style,
    },
    updatedAt: Date.now(),
  };

  await database.drawings.put(nextDrawing);

  return nextDrawing;
}

export async function deleteDrawing(id: string): Promise<DrawingObject | null> {
  const current = await database.drawings.get(id);

  if (!current) {
    return null;
  }

  await database.drawings.delete(id);

  return current;
}
