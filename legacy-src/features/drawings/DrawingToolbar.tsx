import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrawingObject, DrawingStyle, DrawingType } from '../../types/domain';

export interface DrawingToolbarProps {
  activeDrawing: DrawingObject | null;
  canRedo: boolean;
  canUndo: boolean;
  drawings: DrawingObject[];
  pendingTool: DrawingType | null;
  onCreate: (type: DrawingType) => void;
  onDelete: () => void;
  onRedo: () => void;
  onSelect: (id: string | null) => void;
  onStyleChange: (style: Partial<DrawingStyle>) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onUndo: () => void;
}

const drawingTools: Array<{ type: DrawingType; labelKey: string; symbol: string }> = [
  { type: 'trend-line', labelKey: 'drawingTools.trendLine', symbol: '/' },
  { type: 'horizontal-line', labelKey: 'drawingTools.horizontalLine', symbol: '-' },
  { type: 'vertical-line', labelKey: 'drawingTools.verticalLine', symbol: '|' },
  { type: 'rectangle', labelKey: 'drawingTools.rectangle', symbol: '□' },
  { type: 'text', labelKey: 'drawingTools.text', symbol: 'T' },
  { type: 'measurement', labelKey: 'drawingTools.measurement', symbol: '↕' },
];

export function DrawingToolbar({
  activeDrawing,
  canRedo,
  canUndo,
  drawings,
  pendingTool,
  onCreate,
  onDelete,
  onRedo,
  onSelect,
  onStyleChange,
  onToggleHidden,
  onToggleLocked,
  onUndo,
}: DrawingToolbarProps) {
  const { t } = useTranslation();
  const visibleCount = useMemo(() => drawings.filter((drawing) => drawing.visible).length, [drawings]);

  return (
    <div className="drawing-tools" aria-label={t('drawingTools.title')}>
      <div className="drawing-tools__buttons">
        <button
          type="button"
          aria-label={t('drawingTools.select')}
          title={t('drawingTools.select')}
          data-drawing-tool="select"
          onClick={() => onSelect(null)}
        >
          ↖
        </button>
        {drawingTools.map((tool) => (
          <button
            key={tool.type}
            type="button"
            aria-label={t(tool.labelKey)}
            title={t(tool.labelKey)}
            className={pendingTool === tool.type ? 'drawing-tools__button--active' : undefined}
            data-drawing-tool={tool.type}
            onClick={() => onCreate(tool.type)}
          >
            {tool.symbol}
          </button>
        ))}
        <button type="button" aria-label={t('undo')} title={t('undo')} disabled={!canUndo} onClick={onUndo}>
          ↶
        </button>
        <button type="button" aria-label={t('redo')} title={t('redo')} disabled={!canRedo} onClick={onRedo}>
          ↷
        </button>
      </div>
      <section className="drawing-tools__panel" aria-label={t('drawingTools.selected')}>
        <header>
          <strong>{activeDrawing?.type ? t(`drawingTypes.${activeDrawing.type}`) : t('drawingTools.selected')}</strong>
          <span>
            {visibleCount}/{drawings.length}
          </span>
        </header>
        <label>
          {t('color')}
          <input
            type="color"
            value={activeDrawing?.style.lineColor ?? '#f5b84b'}
            disabled={!activeDrawing}
            onChange={(event) => onStyleChange({ lineColor: event.target.value })}
          />
        </label>
        <label>
          {t('lineWidth')}
          <input
            min={1}
            max={6}
            type="number"
            value={activeDrawing?.style.lineWidth ?? 2}
            disabled={!activeDrawing}
            onChange={(event) => onStyleChange({ lineWidth: Number(event.target.value) || 1 })}
          />
        </label>
        <label>
          {t('lineStyle')}
          <select
            value={activeDrawing?.style.lineStyle ?? 'solid'}
            disabled={!activeDrawing}
            onChange={(event) => onStyleChange({ lineStyle: event.target.value as DrawingStyle['lineStyle'] })}
          >
            <option value="solid">{t('solid')}</option>
            <option value="dashed">{t('dashed')}</option>
          </select>
        </label>
        <div className="drawing-tools__actions">
          <button type="button" disabled={!activeDrawing} onClick={onToggleLocked}>
            {activeDrawing?.locked ? t('unlock') : t('lock')}
          </button>
          <button type="button" disabled={!activeDrawing} onClick={onToggleHidden}>
            {activeDrawing?.visible === false ? t('show') : t('hide')}
          </button>
          <button type="button" disabled={!activeDrawing} onClick={onDelete}>
            {t('delete')}
          </button>
        </div>
      </section>
    </div>
  );
}
