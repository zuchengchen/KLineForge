import type { ChartSettings, LastSessionState } from '../types/domain';
import { getSettingRecord, putSettingRecord } from './database';

const sessionStorageKey = 'klineforge:last-session';
const settingsStorageKey = 'klineforge:chart-settings';

function isLastSessionState(value: unknown): value is LastSessionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LastSessionState>;

  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.symbol === 'string' &&
    candidate.market !== undefined &&
    candidate.leftInterval !== undefined &&
    candidate.rightInterval !== undefined
  );
}

function isChartSettings(value: unknown): value is ChartSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChartSettings>;

  return (
    candidate.schemaVersion === 1 &&
    candidate.theme !== undefined &&
    candidate.language !== undefined &&
    candidate.priceColorMode !== undefined
  );
}

function readLocalStorage<T>(key: string, guard: (value: unknown) => value is T): T | null {
  if (typeof window === 'undefined' || window.localStorage === undefined) {
    return null;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: ChartSettings | LastSessionState): void {
  if (typeof window === 'undefined' || window.localStorage === undefined) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function loadPersistedSession(): Promise<LastSessionState | null> {
  const local = readLocalStorage(sessionStorageKey, isLastSessionState);

  if (local) {
    return local;
  }

  return getSettingRecord<LastSessionState>('lastSession');
}

export async function loadPersistedSettings(): Promise<ChartSettings | null> {
  const local = readLocalStorage(settingsStorageKey, isChartSettings);

  if (local) {
    return local;
  }

  return getSettingRecord<ChartSettings>('chartSettings');
}

export async function persistSession(session: LastSessionState): Promise<void> {
  writeLocalStorage(sessionStorageKey, session);
  await putSettingRecord('lastSession', session);
}

export async function persistSettings(settings: ChartSettings): Promise<void> {
  writeLocalStorage(settingsStorageKey, settings);
  await putSettingRecord('chartSettings', settings);
}
