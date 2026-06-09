import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isExpectedNetworkConsoleError } from './consoleFilters.mjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-10');

await fs.mkdir(outputDir, { recursive: true });

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

async function readDrawings(page) {
  return await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open('klineforge');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('drawings', 'readonly');
        const request = tx.objectStore('drawings').getAll();

        request.onsuccess = () =>
          resolve(
            request.result.map((row) => ({
              chartId: row.chartId,
              interval: row.interval,
              type: row.type,
              points: row.points,
              visible: row.visible,
              locked: row.locked,
              style: row.style,
            })),
          );
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

async function waitForDrawingCount(page, count) {
  const startedAt = Date.now();
  let latestDrawings = [];

  while (Date.now() - startedAt < 10_000) {
    latestDrawings = await readDrawings(page);

    if (latestDrawings.length === count) {
      return latestDrawings;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Expected ${count} drawings, got ${JSON.stringify(latestDrawings)}.`);
}

async function waitForDrawingState(page, predicate, message) {
  const startedAt = Date.now();
  let latestDrawings = [];

  while (Date.now() - startedAt < 10_000) {
    latestDrawings = await readDrawings(page);

    if (predicate(latestDrawings)) {
      return latestDrawings;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`${message}, got ${JSON.stringify(latestDrawings)}.`);
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

      if (!isExpectedNetworkConsoleError(text)) {
        consoleErrors.push(text);
      }
    }
  });

  await resetLocalState(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 45_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 45_000 });

  const leftTools = page.locator('[data-chart-id="left"] .drawing-tools');
  const toolTypes = ['trend-line', 'horizontal-line', 'vertical-line', 'rectangle', 'text', 'measurement'];

  for (const toolType of toolTypes) {
    await leftTools.locator(`[data-drawing-tool="${toolType}"]`).click();
  }

  await waitForDrawingCount(page, toolTypes.length);

  await leftTools.getByLabel('Undo').click();
  await waitForDrawingCount(page, toolTypes.length - 1);
  await leftTools.getByLabel('Redo').click();
  await waitForDrawingCount(page, toolTypes.length);

  await leftTools.getByLabel('Line style').selectOption('dashed');
  await leftTools.getByLabel('Line width').fill('4');
  await page.waitForTimeout(500);
  await leftTools.getByRole('button', { name: 'Lock' }).click();
  await leftTools.getByRole('button', { name: 'Hide' }).click();
  const drawingsAfterStyle = await waitForDrawingState(
    page,
    (drawings) => {
      const measurement = drawings.find((drawing) => drawing.type === 'measurement');

      return (
        measurement?.locked === true &&
        measurement.visible === false &&
        measurement.style.lineStyle === 'dashed' &&
        measurement.style.lineWidth === 4
      );
    },
    'Expected selected measurement style, lock and hide state to persist',
  );
  const styledMeasurement = drawingsAfterStyle.find((drawing) => drawing.type === 'measurement');

  if (!styledMeasurement?.locked || styledMeasurement.visible !== false) {
    throw new Error(`Expected selected measurement to be locked and hidden, got ${JSON.stringify(styledMeasurement)}.`);
  }

  if (styledMeasurement.style.lineStyle !== 'dashed' || styledMeasurement.style.lineWidth !== 4) {
    throw new Error(`Expected selected measurement style to persist, got ${JSON.stringify(styledMeasurement.style)}.`);
  }

  if (
    drawingsAfterStyle.some((drawing) =>
      drawing.points.some(
        (point) =>
          typeof point.timestamp !== 'number' ||
          typeof point.price !== 'string' ||
          Object.hasOwn(point, 'x') ||
          Object.hasOwn(point, 'y'),
      ),
    )
  ) {
    throw new Error(`Drawings must use timestamp/price anchors only, got ${JSON.stringify(drawingsAfterStyle)}.`);
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 45_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 45_000 });

  const persistedDrawings = await readDrawings(page);
  const leftDrawings = persistedDrawings.filter((drawing) => drawing.chartId === 'left');
  const rightDrawings = persistedDrawings.filter((drawing) => drawing.chartId === 'right');

  if (leftDrawings.length !== toolTypes.length) {
    throw new Error(`Expected ${toolTypes.length} left chart drawings after reload, got ${JSON.stringify(persistedDrawings)}.`);
  }

  if (rightDrawings.length > 0) {
    throw new Error(`Expected right chart drawings to remain independent, got ${JSON.stringify(persistedDrawings)}.`);
  }

  await page.screenshot({ path: path.join(outputDir, 'drawing-tools.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
