import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-5');

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate(async () => {
    globalThis.localStorage.clear();
    await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.deleteDatabase('klineforge');

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve(undefined);
    });
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 45_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 45_000 });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  await page.waitForTimeout(750);
  await page.screenshot({ path: path.join(outputDir, 'dual-chart.png'), fullPage: true });

  const canvasCount = await page.locator('canvas').count();
  const leftIntervalVisible = await page.getByText('BTCUSDT 5m').isVisible();
  const rightIntervalVisible = await page.getByText('BTCUSDT 1h').isVisible();
  const loadingStatusCount = await page.locator('[data-status="loading"]').count();
  const errorStatusCount = await page.locator('[data-status="error"]').count();
  const dataSources = await page.locator('.kline-chart-host__source').allTextContents();
  const renderedChartStats = await page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll('.kline-chart-host'));

    return hosts.map((host) => {
      const canvases = Array.from(host.querySelectorAll('canvas'));
      const stats = {
        chartId: host.getAttribute('data-chart-id'),
        greenPixels: 0,
        redPixels: 0,
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
            stats.visiblePixels += 1;
          }

          if (green > 120 && red < 120 && blue < 180) {
            stats.greenPixels += 1;
          }

          if (red > 160 && green < 130 && blue < 160) {
            stats.redPixels += 1;
          }
        }
      }

      return stats;
    });
  });

  if (canvasCount < 2) {
    throw new Error(`Expected at least 2 chart canvases, found ${canvasCount}.`);
  }

  if (!leftIntervalVisible || !rightIntervalVisible) {
    throw new Error('Default left/right chart interval labels were not visible.');
  }

  if (loadingStatusCount > 0) {
    throw new Error('K-line charts were still loading after network idle.');
  }

  if (errorStatusCount > 0) {
    throw new Error('One or more K-line charts reported an error state.');
  }

  if (
    renderedChartStats.length < 2 ||
    renderedChartStats.some((stats) => stats.greenPixels + stats.redPixels < 500)
  ) {
    throw new Error(`Expected both charts to render candle pixels, got ${JSON.stringify(renderedChartStats)}.`);
  }

  if (dataSources.length < 2 || !dataSources.every((source) => source.includes('Binance') || source.includes('Cache'))) {
    throw new Error(`Expected both charts to expose a Binance/cache data source, got ${JSON.stringify(dataSources)}.`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
