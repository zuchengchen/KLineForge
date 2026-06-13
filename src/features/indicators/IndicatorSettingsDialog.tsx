import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IndicatorConfig, IndicatorSeriesStyle, IndicatorTemplate } from '../../types/domain';
import { updateIndicatorConfig } from './indicatorConfigRepository';
import {
  applyTemplateToIndicatorConfig,
  deleteIndicatorTemplate,
  getIndicatorTemplates,
  saveIndicatorTemplate,
  setDefaultIndicatorTemplate,
} from './indicatorTemplatesRepository';
import {
  getIndicatorInputDefinitions,
  getIndicatorSeriesDefinitions,
  indicatorSources,
  normalizeIndicatorConfig,
  normalizeIndicatorParams,
  supportsIndicatorSource,
} from './indicatorSeriesStyles';

type IndicatorSettingsTab = 'inputs' | 'style' | 'templates';

interface IndicatorSettingsDialogProps {
  config: IndicatorConfig;
  onClose: () => void;
  onSaved: (config?: IndicatorConfig) => void;
}

function clampInput(value: number, min: number, max: number, integer: boolean): number {
  const nextValue = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

  return integer ? Math.round(nextValue) : nextValue;
}

function updateSeriesStyle(
  seriesStyles: Record<string, IndicatorSeriesStyle>,
  key: string,
  updates: Partial<IndicatorSeriesStyle>,
): Record<string, IndicatorSeriesStyle> {
  const current = seriesStyles[key];

  if (!current) {
    return seriesStyles;
  }

  return {
    ...seriesStyles,
    [key]: {
      ...current,
      ...updates,
    },
  };
}

export function IndicatorSettingsDialog({ config, onClose, onSaved }: IndicatorSettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<IndicatorSettingsTab>('inputs');
  const [draft, setDraft] = useState(() => normalizeIndicatorConfig(config));
  const [templates, setTemplates] = useState<IndicatorTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputDefinitions = useMemo(
    () => getIndicatorInputDefinitions(draft.name, draft.calcParams),
    [draft.calcParams, draft.name],
  );
  const seriesDefinitions = useMemo(
    () => getIndicatorSeriesDefinitions(draft.name, draft.calcParams),
    [draft.calcParams, draft.name],
  );

  useEffect(() => {
    let active = true;

    void getIndicatorTemplates(draft.name).then((rows) => {
      if (active) {
        setTemplates(rows);
      }
    });

    return () => {
      active = false;
    };
  }, [draft.name]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    globalThis.addEventListener('keydown', onKeyDown, { capture: true });

    return () => globalThis.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  const saveDraft = async () => {
    try {
      setSaving(true);
      setError(null);
      const normalizedDraft = normalizeIndicatorConfig(draft);
      await updateIndicatorConfig(normalizedDraft.id, {
        calcParams: normalizedDraft.calcParams,
        color: normalizedDraft.color,
        lineWidth: normalizedDraft.lineWidth,
        seriesStyles: normalizedDraft.seriesStyles,
        source: normalizedDraft.source,
        visible: normalizedDraft.visible,
      });
      onSaved(normalizedDraft);
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('indicatorLoadError');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const refreshTemplates = async () => {
    setTemplates(await getIndicatorTemplates(draft.name));
  };

  const saveTemplate = async () => {
    try {
      setError(null);
      await saveIndicatorTemplate({ config: normalizeIndicatorConfig(draft), name: templateName });
      setTemplateName('');
      await refreshTemplates();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('indicatorLoadError'));
    }
  };

  const applyTemplate = async (template: IndicatorTemplate) => {
    try {
      setError(null);
      const applied = await applyTemplateToIndicatorConfig(config, template.id);
      setDraft(applied);
      onSaved(applied);
      await refreshTemplates();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('indicatorLoadError'));
    }
  };

  const toggleTemplateDefault = async (template: IndicatorTemplate) => {
    try {
      setError(null);
      await setDefaultIndicatorTemplate(template.id, !template.isDefault);
      await refreshTemplates();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('indicatorLoadError'));
    }
  };

  const removeTemplate = async (template: IndicatorTemplate) => {
    try {
      setError(null);
      await deleteIndicatorTemplate(template.id);
      await refreshTemplates();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('indicatorLoadError'));
    }
  };

  return (
    <div className="indicator-settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={t('indicatorSettings')}
        className="indicator-settings-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="indicator-settings-dialog__header">
          <div>
            <h2>{draft.name}</h2>
            <span>{t('indicatorSettings')}</span>
          </div>
          <button type="button" onClick={onClose}>
            Esc
          </button>
        </header>

        <div className="indicator-settings-dialog__tabs" role="tablist" aria-label={t('indicatorSettingsTabsLabel')}>
          {(['inputs', 'style', 'templates'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'indicator-settings-dialog__tab--active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {t(`indicatorSettingsTabs.${tab}`)}
            </button>
          ))}
        </div>

        {activeTab === 'inputs' && (
          <div className="indicator-settings-dialog__body">
            {inputDefinitions.map((definition, index) => (
              <label key={definition.key}>
                {t(`indicatorInputs.${draft.name}.${definition.key}`, { defaultValue: definition.label })}
                <input
                  min={definition.min}
                  max={definition.max}
                  step={definition.step}
                  type="number"
                  value={draft.calcParams[index] ?? ''}
                  onChange={(event) => {
                    const nextParams = [...draft.calcParams];
                    nextParams[index] = clampInput(Number(event.target.value), definition.min, definition.max, definition.integer);
                    setDraft((current) =>
                      normalizeIndicatorConfig({
                        ...current,
                        calcParams: normalizeIndicatorParams(current.name, nextParams),
                      }),
                    );
                  }}
                />
              </label>
            ))}
            {supportsIndicatorSource(draft.name) && (
              <label>
                {t('calculationSource')}
                <select
                  value={draft.source ?? 'close'}
                  onChange={(event) =>
                    setDraft((current) =>
                      normalizeIndicatorConfig({
                        ...current,
                        source: event.target.value as IndicatorConfig['source'],
                      }),
                    )
                  }
                >
                  {indicatorSources.map((source) => (
                    <option key={source} value={source}>
                      {t(`indicatorSources.${source}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {activeTab === 'style' && (
          <div className="indicator-settings-dialog__body indicator-settings-dialog__series">
            <label className="indicator-settings-dialog__toggle">
              <input
                checked={draft.visible}
                type="checkbox"
                onChange={(event) => setDraft((current) => ({ ...current, visible: event.target.checked }))}
              />
              {t('visible')}
            </label>
            {seriesDefinitions.map((series) => {
              const style = draft.seriesStyles?.[series.key];

              if (!style) {
                return null;
              }

              return (
                <div key={series.key} className="indicator-settings-dialog__series-row">
                  <label className="indicator-settings-dialog__toggle">
                    <input
                      checked={style.visible}
                      type="checkbox"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          seriesStyles: updateSeriesStyle(current.seriesStyles ?? {}, series.key, {
                            visible: event.target.checked,
                          }),
                        }))
                      }
                    />
                    {series.label}
                  </label>
                  <input
                    aria-label={`${series.label} ${t('color')}`}
                    type="color"
                    value={style.color}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        color: series.styleIndex === 0 ? event.target.value : current.color,
                        seriesStyles: updateSeriesStyle(current.seriesStyles ?? {}, series.key, {
                          color: event.target.value,
                        }),
                      }))
                    }
                  />
                  <input
                    aria-label={`${series.label} ${t('lineWidth')}`}
                    min={1}
                    max={5}
                    type="number"
                    value={style.lineWidth}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        lineWidth: series.styleIndex === 0 ? Number(event.target.value) || 1 : current.lineWidth,
                        seriesStyles: updateSeriesStyle(current.seriesStyles ?? {}, series.key, {
                          lineWidth: Number(event.target.value) || 1,
                        }),
                      }))
                    }
                  />
                  <select
                    aria-label={`${series.label} ${t('lineStyle')}`}
                    value={style.lineStyle}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        seriesStyles: updateSeriesStyle(current.seriesStyles ?? {}, series.key, {
                          lineStyle: event.target.value as IndicatorSeriesStyle['lineStyle'],
                        }),
                      }))
                    }
                  >
                    <option value="solid">{t('solid')}</option>
                    <option value="dashed">{t('dashed')}</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="indicator-settings-dialog__body">
            <div className="indicator-settings-dialog__template-create">
              <input
                aria-label={t('templateName')}
                placeholder={t('templateName')}
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <button type="button" onClick={() => void saveTemplate()}>
                {t('saveTemplate')}
              </button>
            </div>
            <div className="indicator-settings-dialog__templates">
              {templates.length === 0 && <div className="indicator-settings-dialog__empty">{t('noTemplates')}</div>}
              {templates.map((template) => (
                <article key={template.id} className="indicator-settings-dialog__template-row">
                  <div>
                    <strong>{template.name}</strong>
                    {template.isDefault && <span>{t('defaultTemplate')}</span>}
                  </div>
                  <button type="button" onClick={() => void applyTemplate(template)}>
                    {t('apply')}
                  </button>
                  <button type="button" onClick={() => void toggleTemplateDefault(template)}>
                    {template.isDefault ? t('unsetDefault') : t('setDefault')}
                  </button>
                  <button type="button" onClick={() => void removeTemplate(template)}>
                    {t('delete')}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {error && <div className="indicator-settings-dialog__error">{error}</div>}

        <footer className="indicator-settings-dialog__footer">
          <button type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" disabled={saving} onClick={() => void saveDraft()}>
            {t('save')}
          </button>
        </footer>
      </section>
    </div>
  );
}
