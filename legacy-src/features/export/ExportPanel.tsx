import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chartNameI18nKeys, getChartNumber } from '../../types/chartLayout';
import type { ChartId, ChartIntervalMap, MarketType } from '../../types/domain';
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
  chartIntervals: ChartIntervalMap;
  market: MarketType;
  symbol: string;
  visibleChartIds: ChartId[];
}

function fileStamp(): string {
  return new Date().toISOString().replaceAll(':', '-');
}

export function ExportPanel({ chartIntervals, market, symbol, visibleChartIds }: ExportPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const csvInterval = chartIntervals[visibleChartIds[0] ?? 'left'];
  const intervalMeta = visibleChartIds
    .map((chartId) => `${getChartNumber(chartId)}:${chartIntervals[chartId]}`)
    .join(' / ');

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
      interval: csvInterval,
      startTime,
      endTime,
    });

    downloadTextFile(
      `klineforge-${market}-${symbol}-${csvInterval}-${fileStamp()}.csv`,
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
        {visibleChartIds.map((chartId) => (
          <button key={chartId} type="button" onClick={() => exportPng(chartId)}>
            {t('exportChartPng', { chart: t(chartNameI18nKeys[chartId]) })}
          </button>
        ))}
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
        {symbol} · {intervalMeta}
      </p>
      {message && <p className="export-panel__message">{message}</p>}
      {error && <p className="export-panel__error">{error}</p>}
    </section>
  );
}
