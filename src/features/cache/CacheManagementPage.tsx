import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CacheTaskRecord } from '../../persistence/database';
import type { Interval, MarketType } from '../../types/domain';
import {
  cacheQueueRunner,
  clearAllCacheTasksAndKlines,
  deleteCacheTaskAndInterval,
  ensureCacheTasksForSymbol,
  getCacheTasks,
  pauseCacheTask,
  resumeCacheTask,
  retryCacheTask,
} from './cacheQueue';

interface CacheManagementPageProps {
  market: MarketType;
  symbol: string;
  leftInterval: Interval;
  rightInterval: Interval;
}

function formatDate(value: number | undefined): string {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString();
}

function formatSize(value: number | undefined): string {
  if (!value) {
    return '--';
  }

  if (value > 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function formatRange(startTime: number | undefined, endTime: number | undefined): string {
  return `${formatDate(startTime)} - ${formatDate(endTime)}`;
}

export function CacheManagementPage({ leftInterval, market, rightInterval, symbol }: CacheManagementPageProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<CacheTaskRecord[]>([]);

  const refresh = async () => {
    setTasks(await getCacheTasks(market, symbol));
  };

  const updateTaskStatus = (id: string, status: CacheTaskRecord['status']) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status,
              updatedAt: Date.now(),
            }
          : task,
      ),
    );
  };

  const handlePause = (id: string) => {
    updateTaskStatus(id, 'paused');
    void pauseCacheTask(id).then(refresh);
  };

  const handleResume = (id: string) => {
    updateTaskStatus(id, 'not-started');
    void resumeCacheTask(id).then(refresh);
  };

  const handleRetry = (id: string) => {
    updateTaskStatus(id, 'not-started');
    void retryCacheTask(id).then(refresh);
  };

  const handleDelete = (id: string) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    void deleteCacheTaskAndInterval(id).then(refresh);
  };

  const handleClearAll = () => {
    setTasks([]);
    void clearAllCacheTasksAndKlines().then(refresh);
  };

  useEffect(() => {
    let active = true;

    ensureCacheTasksForSymbol(market, symbol, [leftInterval, rightInterval])
      .then(() => cacheQueueRunner.start())
      .then(() => getCacheTasks(market, symbol))
      .then((nextTasks) => {
        if (active) {
          setTasks(nextTasks);
        }
      });

    const intervalId = globalThis.setInterval(() => {
      void getCacheTasks(market, symbol).then((nextTasks) => {
        if (active) {
          setTasks(nextTasks);
        }
      });
    }, 1_000);

    return () => {
      active = false;
      globalThis.clearInterval(intervalId);
    };
  }, [leftInterval, market, rightInterval, symbol]);

  return (
    <section className="cache-page">
      <header className="cache-page__header">
        <div>
          <h2>{t('cacheManagement')}</h2>
          <span>
            {market === 'usdM' ? 'USD-M Futures' : 'Spot'} · {symbol}
          </span>
        </div>
        <div className="cache-page__actions">
          <button type="button" onClick={() => void cacheQueueRunner.start()}>
            {t('resumeCache')}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
          >
            {t('clearAllCache')}
          </button>
        </div>
      </header>
      <div className="cache-page__summary" aria-label={t('cacheProgress')}>
        {tasks.filter((task) => task.status === 'complete').length} / {tasks.length} {t('complete')} ·{' '}
        {tasks.filter((task) => task.status === 'partial').length} {t('cacheStatuses.partial')}
      </div>
      <div className="cache-table" role="table" aria-label={t('cacheManagement')}>
        <div className="cache-table__row cache-table__row--head" role="row">
          <span>{t('market')}</span>
          <span>{t('symbol')}</span>
          <span>{t('interval')}</span>
          <span>{t('status')}</span>
          <span>{t('progress')}</span>
          <span>{t('targetRange')}</span>
          <span>{t('cachedRange')}</span>
          <span>{t('missingRanges')}</span>
          <span>{t('estimatedSize')}</span>
          <span>{t('actions')}</span>
        </div>
        {tasks.map((task) => (
          <div key={task.id} className="cache-table__row" role="row" data-cache-task-id={task.id} data-cache-status={task.status}>
            <span>{task.market}</span>
            <span>{task.symbol}</span>
            <span>{task.interval}</span>
            <span>{t(`cacheStatuses.${task.status}`)}</span>
            <span>
              <progress value={task.progress} max={1} />
              {(task.progress * 100).toFixed(0)}%
            </span>
            <span>{formatRange(task.targetStartTime, task.targetEndTime)}</span>
            <span>{formatRange(task.cachedStartTime, task.cachedEndTime)}</span>
            <span title={task.missingRanges?.map((range) => formatRange(range.startTime, range.endTime)).join('\n')}>
              {task.missingRangeCount ?? 0}
            </span>
            <span>{formatSize(task.estimatedSizeBytes)}</span>
            <span className="cache-table__actions">
              {task.status === 'paused' ? (
                <button type="button" onClick={() => handleResume(task.id)}>
                  {t('resume')}
                </button>
              ) : (
                <button type="button" onClick={() => handlePause(task.id)}>
                  {t('pause')}
                </button>
              )}
              <button type="button" onClick={() => handleRetry(task.id)}>
                {t('retry')}
              </button>
              <button type="button" onClick={() => handleDelete(task.id)}>
                {t('delete')}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
