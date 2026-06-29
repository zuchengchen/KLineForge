import type { DrawingObject } from '../../types/domain';

export type DrawingHistoryAction = 'create' | 'delete' | 'move' | 'style' | 'text';

export interface DrawingHistoryEntry {
  action: DrawingHistoryAction;
  before?: DrawingObject;
  after?: DrawingObject;
}

export class DrawingHistory {
  private undoStack: DrawingHistoryEntry[] = [];

  private redoStack: DrawingHistoryEntry[] = [];

  push(entry: DrawingHistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack = [];
  }

  undo(): DrawingHistoryEntry | null {
    const entry = this.undoStack.pop();

    if (!entry) {
      return null;
    }

    this.redoStack.push(entry);

    return entry;
  }

  redo(): DrawingHistoryEntry | null {
    const entry = this.redoStack.pop();

    if (!entry) {
      return null;
    }

    this.undoStack.push(entry);

    return entry;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export function invertDrawingHistoryEntry(entry: DrawingHistoryEntry): DrawingObject | null {
  if (entry.action === 'create') {
    return null;
  }

  return entry.before ?? null;
}

export function replayDrawingHistoryEntry(entry: DrawingHistoryEntry): DrawingObject | null {
  if (entry.action === 'delete') {
    return null;
  }

  return entry.after ?? null;
}
