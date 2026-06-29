import { beforeEach, describe, expect, it } from 'vitest';
import { database, putSettingRecord } from '../../persistence/database';
import { createDefaultSession } from '../../app/defaults';
import {
  clearAllCacheTasksAndKlines,
  deleteCacheTaskAndInterval,
  ensureCacheTasksForSymbol,
  getCacheTasks,
  pauseCacheTask,
  resumeCacheTask,
  retryCacheTask,
} from './cacheQueue';

describe('cache queue task repository', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
  });

  it('creates one task for every supported interval', async () => {
    const tasks = await ensureCacheTasksForSymbol('usdM', 'btcusdt', ['5m', '1h']);

    expect(tasks).toHaveLength(15);
    expect(tasks[0]).toMatchObject({ market: 'usdM', symbol: 'BTCUSDT', interval: '5m' });
    expect(tasks[1]).toMatchObject({ interval: '1h' });
  });

  it('pauses, resumes and retries tasks', async () => {
    const [task] = await ensureCacheTasksForSymbol('usdM', 'BTCUSDT');

    await pauseCacheTask(task.id);
    expect((await database.cacheTasks.get(task.id))?.status).toBe('paused');

    await resumeCacheTask(task.id);
    expect((await database.cacheTasks.get(task.id))?.status).toBe('not-started');

    await database.cacheTasks.update(task.id, { status: 'failed', error: 'bad' });
    await retryCacheTask(task.id);
    const retriedTask = await database.cacheTasks.get(task.id);

    expect(retriedTask?.status).toBe('not-started');
    expect(retriedTask?.error).toBeFalsy();
  });

  it('manual cache clearing preserves settings', async () => {
    await putSettingRecord('session', createDefaultSession(1));
    await ensureCacheTasksForSymbol('usdM', 'BTCUSDT');

    await clearAllCacheTasksAndKlines();

    expect(await getCacheTasks()).toEqual([]);
    expect(await database.settings.get('session')).toBeDefined();
  });

  it('deletes one interval task without deleting unrelated task rows', async () => {
    const tasks = await ensureCacheTasksForSymbol('usdM', 'BTCUSDT');

    await deleteCacheTaskAndInterval(tasks[0].id);

    expect(await database.cacheTasks.get(tasks[0].id)).toBeUndefined();
    expect(await getCacheTasks('usdM', 'BTCUSDT')).toHaveLength(14);
  });
});
