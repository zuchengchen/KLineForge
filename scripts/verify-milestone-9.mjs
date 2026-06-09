import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-9');

await fs.mkdir(outputDir, { recursive: true });

async function waitForCharts(page) {
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 45_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 45_000 });
}

async function resetLocalState(page) {
  await page.goto(new URL('/reset.html', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate(async () => {
    globalThis.localStorage.clear();
    await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.deleteDatabase('klineforge');

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error ?? new Error('Unable to delete IndexedDB database.'));
      request.onblocked = () => reject(new Error('IndexedDB delete was blocked by another connection.'));
    });
  });
}

async function readIndicatorConfigs(page) {
  return await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open('klineforge');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('indicatorConfigs', 'readonly');
        const request = tx.objectStore('indicatorConfigs').getAll();

        request.onsuccess = () =>
          resolve(
            request.result.map((row) => ({
              chartId: row.chartId,
              name: row.name,
              visible: row.visible,
            })),
          );
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

async function waitForIndicatorConfig(page, predicate, message) {
  const startedAt = Date.now();
  let latestConfigs = [];

  while (Date.now() - startedAt < 10_000) {
    latestConfigs = await readIndicatorConfigs(page);

    if (predicate(latestConfigs)) {
      return latestConfigs;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`${message}. Current indicator configs: ${JSON.stringify(latestConfigs)}.`);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();

      if (!text.includes('Failed to load resource: the server responded with a status of 404')) {
        consoleErrors.push(text);
      }
    }
  });

  await resetLocalState(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForCharts(page);

  await page.locator('.chart-pane').first().getByRole('button', { name: 'Indicators' }).click();
  await page.getByRole('dialog', { name: 'Indicators' }).waitFor({ timeout: 10_000 });
  await page.locator('[data-indicator-name="MA"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-indicator-name="VOL"]').waitFor({ timeout: 10_000 });
  const macdButton = page.locator('[data-indicator-catalog-name="MACD"]');
  await macdButton.waitFor({ timeout: 10_000 });
  await macdButton.evaluate((button) => {
    if (button.disabled) {
      throw new Error('MACD button is unexpectedly disabled.');
    }
  });
  await macdButton.click();
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[data-indicator-name]')].some(
          (row) => row.getAttribute('data-indicator-name') === 'MACD',
        ),
      undefined,
      { timeout: 10_000 },
    )
    .catch(async (error) => {
      const panelState = await page.evaluate(() => ({
        activeRows: [...document.querySelectorAll('[data-indicator-name]')].map((row) =>
          row.getAttribute('data-indicator-name'),
        ),
        macdButtonDisabled: document.querySelector('[data-indicator-catalog-name="MACD"]')?.disabled ?? null,
        panelText: document.querySelector('.indicator-panel')?.textContent ?? '',
      }));

      throw new Error(`${error.message} Panel state: ${JSON.stringify(panelState)}.`);
    });
  await waitForIndicatorConfig(
    page,
    (configs) => configs.some((config) => config.chartId === 'left' && config.name === 'MACD'),
    'Expected left chart MACD config to persist after adding the indicator',
  );
  await page.locator('[data-indicator-name="MA"]').getByRole('button', { name: 'Hide' }).click();
  await waitForIndicatorConfig(
    page,
    (configs) => configs.some((config) => config.chartId === 'left' && config.name === 'MA' && config.visible === false),
    'Expected left chart MA config to persist as hidden after toggling visibility',
  );
  await page.getByRole('button', { name: 'Esc' }).click();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForCharts(page);

  const configs = await readIndicatorConfigs(page);

  const leftConfigs = configs.filter((config) => config.chartId === 'left');
  const rightConfigs = configs.filter((config) => config.chartId === 'right');

  if (!leftConfigs.some((config) => config.name === 'MACD')) {
    throw new Error(`Expected left chart MACD config to persist, got ${JSON.stringify(configs)}.`);
  }

  if (!leftConfigs.some((config) => config.name === 'MA' && config.visible === false)) {
    throw new Error(`Expected hidden left MA config to persist, got ${JSON.stringify(configs)}.`);
  }

  if (rightConfigs.some((config) => config.name === 'MACD')) {
    throw new Error(`Expected right chart configs to remain independent, got ${JSON.stringify(configs)}.`);
  }

  await page.screenshot({ path: path.join(outputDir, 'indicators.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
