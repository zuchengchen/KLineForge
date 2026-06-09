import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isExpectedNetworkConsoleError } from './consoleFilters.mjs';

/* global window */

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-12');

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

async function waitForCharts(page) {
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 90_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 90_000 });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  await page.waitForTimeout(750);
}

async function assertChartsNonBlank(page) {
  const stats = await page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll('.kline-chart-host'));

    return hosts.map((host) => {
      const canvases = Array.from(host.querySelectorAll('canvas'));
      const result = {
        chartId: host.getAttribute('data-chart-id'),
        coloredPixels: 0,
        visiblePixels: 0,
      };

      for (const canvas of canvases) {
        const context = canvas.getContext('2d');

        if (!context || canvas.width === 0 || canvas.height === 0) {
          continue;
        }

        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const alpha = data[index + 3];

          if (alpha === 0) {
            continue;
          }

          if (red + green + blue > 80) {
            result.visiblePixels += 1;
          }

          if ((green > 120 && red < 140) || (red > 150 && green < 150) || blue > 150) {
            result.coloredPixels += 1;
          }
        }
      }

      return result;
    });
  });

  if (stats.length < 2 || stats.some((item) => item.visiblePixels < 2_000 || item.coloredPixels < 300)) {
    throw new Error(`Expected non-blank charts, got ${JSON.stringify(stats)}.`);
  }
}

async function assertNoDesktopOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  if (overflow.bodyScrollWidth > overflow.viewportWidth + 2 || overflow.documentScrollWidth > overflow.viewportWidth + 2) {
    throw new Error(`Visible horizontal overflow detected: ${JSON.stringify(overflow)}.`);
  }
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
  await waitForCharts(page);

  await page.getByText('BTCUSDT 5m').waitFor({ timeout: 10_000 });
  await page.getByText('BTCUSDT 1h').waitFor({ timeout: 10_000 });
  await page.locator('.market-bar__meta').getByText('USD-M Futures').waitFor({ timeout: 10_000 });
  await assertChartsNonBlank(page);
  await assertNoDesktopOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'default-launch-dark.png'), fullPage: true });
  await page.screenshot({ path: path.join(outputDir, 'dual-chart.png'), fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('region', { name: 'Settings' }).waitFor({ timeout: 10_000 });
  await page.getByLabel('Chart style').selectOption('line');
  await page.getByLabel('Grid lines').uncheck();
  await page.getByLabel('Latest price line').uncheck();
  await page.getByLabel('Crosshair').uncheck();
  await page.screenshot({ path: path.join(outputDir, 'settings.png'), fullPage: true });
  await page.getByLabel('Theme').selectOption('light');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', undefined, { timeout: 10_000 });
  await waitForCharts(page);
  await assertChartsNonBlank(page);
  await assertNoDesktopOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'light-theme.png'), fullPage: true });

  await page.locator('[data-chart-id="left"]').click({ position: { x: 240, y: 180 } });
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.querySelectorAll('.chart-pane').length === 1, undefined, { timeout: 10_000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.chart-pane').length === 2, undefined, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Cache management' }).click();
  await page.getByRole('table', { name: 'Cache management' }).waitFor({ timeout: 15_000 });
  await page.waitForSelector('[data-cache-task-id]', { timeout: 15_000 });
  await assertNoDesktopOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'cache-management.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
