import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChartId, Interval, MarketType } from '../../types/domain';
import { getChartExportHandle } from '../chart/chartExportRegistry';
import {
  createConfigExport,
  importConfigExport,
  serializeConfigExport,
  validateConfigExport,
} from './configExport';
import { exportKlinesCsv } from './csvExport';
import { downloadDataUrl, downloadTextFile } from './downloads';

interface ExportPanelProps {
  leftInterval: Interval;
  market: MarketType;
  rightInterval: Interval;
  symbol: string;
}

function fileStamp(): string {
  return new Date().toISOString().replaceAll(':', '-');
}

export function ExportPanel({ leftInterval, market, rightInterval, symbol }: ExportPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const exportPng = (chartId: ChartId) => {
    setError('');
    const handle = getChartExportHandle(chartId);

    if (!handle) {
      setError(t('exportErrors.chartNotReady'));
      return;
    }

    downloadDataUrl(`klineforge-${chartId}-${symbol}-${fileStamp()}.png`, handle.exportPng());
    setMessage(t('exportMessages.pngReady'));
  };

  const exportCsv = async () => {
    setError('');
    const endTime = Date.now();
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000;
    const result = await exportKlinesCsv({
      market,
      symbol,
      interval: leftInterval,
      startTime,
      endTime,
    });

    downloadTextFile(
      `klineforge-${market}-${symbol}-${leftInterval}-${fileStamp()}.csv`,
      result.csv,
      'text/csv;charset=utf-8',
    );
    setMessage(
      result.complete
        ? t('exportMessages.csvReady', { count: result.rowCount })
        : t('exportMessages.csvIncomplete', { count: result.rowCount }),
    );
  };

  const exportConfig = async () => {
    setError('');
    const payload = await createConfigExport();

    downloadTextFile(
      `klineforge-config-${fileStamp()}.json`,
      serializeConfigExport(payload),
      'application/json;charset=utf-8',
    );
    setMessage(t('exportMessages.configReady'));
  };

  const importConfig = async (file: File | null) => {
    if (!file) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      await importConfigExport(validateConfigExport(parsed));
      setMessage(t('exportMessages.configImported'));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('exportErrors.invalidConfig'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="export-panel" aria-label={t('exportTools')}>
      <h2>{t('exportTools')}</h2>
      <div className="export-panel__grid">
        <button type="button" onClick={() => exportPng('left')}>
          {t('exportLeftPng')}
        </button>
        <button type="button" onClick={() => exportPng('right')}>
          {t('exportRightPng')}
        </button>
        <button type="button" onClick={() => void exportCsv()}>
          {t('exportCsv')}
        </button>
        <button type="button" onClick={() => void exportConfig()}>
          {t('exportConfig')}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {t('importConfig')}
        </button>
      </div>
      <input
        ref={fileInputRef}
        hidden
        accept="application/json,.json"
        type="file"
        onChange={(event) => void importConfig(event.target.files?.[0] ?? null)}
      />
      <p className="export-panel__meta">
        {symbol} · {leftInterval} / {rightInterval}
      </p>
      {message && <p className="export-panel__message">{message}</p>}
      {error && <p className="export-panel__error">{error}</p>}
    </section>
  );
}
