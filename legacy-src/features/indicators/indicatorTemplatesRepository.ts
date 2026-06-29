import { database } from '../../persistence/database';
import type { IndicatorConfig, IndicatorName, IndicatorTemplate } from '../../types/domain';
import { applyIndicatorTemplate, normalizeIndicatorConfig, normalizeIndicatorTemplate } from './indicatorSeriesStyles';

export interface SaveIndicatorTemplateInput {
  config: IndicatorConfig;
  name?: string;
  isDefault?: boolean;
}

function createTemplateId(indicatorName: IndicatorName, now: number): string {
  return `indicator-template:${indicatorName}:${now}:${Math.random().toString(36).slice(2, 8)}`;
}

function createTemplateName(indicatorName: IndicatorName, now: number): string {
  return `${indicatorName} ${new Date(now).toLocaleString()}`;
}

export async function getIndicatorTemplates(indicatorName: IndicatorName): Promise<IndicatorTemplate[]> {
  const rows = await database.indicatorTemplates.where('indicatorName').equals(indicatorName).sortBy('createdAt');

  return rows.map(normalizeIndicatorTemplate);
}

export async function getDefaultIndicatorTemplate(
  indicatorName: IndicatorName,
): Promise<IndicatorTemplate | null> {
  const rows = await database.indicatorTemplates
    .where('indicatorName')
    .equals(indicatorName)
    .and((template) => template.isDefault)
    .toArray();

  return rows[0] ? normalizeIndicatorTemplate(rows[0]) : null;
}

export async function saveIndicatorTemplate({
  config,
  isDefault = false,
  name,
}: SaveIndicatorTemplateInput): Promise<IndicatorTemplate> {
  const now = Date.now();
  const normalizedConfig = normalizeIndicatorConfig(config);
  const template = normalizeIndicatorTemplate({
    id: createTemplateId(normalizedConfig.name, now),
    schemaVersion: 1,
    name: name?.trim() || createTemplateName(normalizedConfig.name, now),
    indicatorName: normalizedConfig.name,
    calcParams: normalizedConfig.calcParams,
    visible: normalizedConfig.visible,
    color: normalizedConfig.color,
    lineWidth: normalizedConfig.lineWidth,
    source: normalizedConfig.source,
    seriesStyles: normalizedConfig.seriesStyles ?? {},
    isDefault,
    createdAt: now,
    updatedAt: now,
  });

  await database.transaction('rw', database.indicatorTemplates, async () => {
    if (template.isDefault) {
      await database.indicatorTemplates
        .where('indicatorName')
        .equals(template.indicatorName)
        .modify({ isDefault: false, updatedAt: now });
    }

    await database.indicatorTemplates.put(template);
  });

  return template;
}

export async function applyTemplateToIndicatorConfig(
  config: IndicatorConfig,
  templateId: string,
): Promise<IndicatorConfig> {
  const template = await database.indicatorTemplates.get(templateId);

  if (!template) {
    throw new Error('Indicator template was not found.');
  }

  if (template.indicatorName !== config.name) {
    throw new Error('Indicator template type does not match the selected indicator.');
  }

  const nextConfig = applyIndicatorTemplate(config, template);
  await database.indicatorConfigs.put(nextConfig);

  return nextConfig;
}

export async function deleteIndicatorTemplate(id: string): Promise<void> {
  await database.indicatorTemplates.delete(id);
}

export async function setDefaultIndicatorTemplate(id: string, isDefault: boolean): Promise<void> {
  const template = await database.indicatorTemplates.get(id);

  if (!template) {
    throw new Error('Indicator template was not found.');
  }

  const now = Date.now();

  await database.transaction('rw', database.indicatorTemplates, async () => {
    if (isDefault) {
      await database.indicatorTemplates
        .where('indicatorName')
        .equals(template.indicatorName)
        .modify({ isDefault: false, updatedAt: now });
    }

    await database.indicatorTemplates.update(id, { isDefault, updatedAt: now });
  });
}
