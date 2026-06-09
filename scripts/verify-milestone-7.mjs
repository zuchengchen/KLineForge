import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-7');

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

  await page.keyboard.press('/');
  await page.getByRole('dialog', { name: 'Symbol search' }).waitFor({ timeout: 10_000 });
  await page.getByRole('textbox', { name: 'Search' }).fill('ETHUSDT');
  await page.getByRole('button', { name: /ETHUSDT/ }).first().click();

  await page.waitForSelector('text=ETHUSDT 5m', { timeout: 45_000 });
  await page.waitForSelector('text=ETHUSDT 1h', { timeout: 45_000 });

  const intervalsAfterSwitch = await page.locator('.market-bar__meta').textContent();

  if (!intervalsAfterSwitch?.includes('5m / 1h')) {
    throw new Error(`Expected intervals to remain 5m / 1h after symbol switch, got ${intervalsAfterSwitch ?? ''}.`);
  }

  await page.keyboard.press('/');
  await page.getByRole('dialog', { name: 'Symbol search' }).waitFor({ timeout: 10_000 });
  await page.getByRole('textbox', { name: 'Search' }).fill('BNBUSDT');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await page.getByRole('button', { name: 'Esc' }).click();

  await page.locator('.watchlist__symbol').filter({ hasText: 'BNBUSDT' }).waitFor({ timeout: 10_000 });
  await page.getByLabel('Move up BNBUSDT').click();
  await page.waitForFunction(() => {
    const symbols = Array.from(document.querySelectorAll('.watchlist__symbol strong')).map((node) => node.textContent);

    return symbols.indexOf('BNBUSDT') >= 0 && symbols.indexOf('BNBUSDT') < symbols.indexOf('ETHUSDT');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('text=ETHUSDT 5m', { timeout: 45_000 });
  await page.waitForSelector('text=ETHUSDT 1h', { timeout: 45_000 });
  const watchlistSymbols = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open('klineforge');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return await new Promise((resolve, reject) => {
      const tx = db.transaction('watchlists', 'readonly');
      const request = tx.objectStore('watchlists').getAll();

      request.onsuccess = () =>
        resolve(
          request.result
            .filter((row) => row.market === 'usdM')
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((row) => row.symbol),
        );
      request.onerror = () => reject(request.error);
    });
  });

  if (!watchlistSymbols.includes('ETHUSDT') || !watchlistSymbols.includes('BNBUSDT')) {
    throw new Error(`Expected ETHUSDT and BNBUSDT to persist in watchlist, got ${JSON.stringify(watchlistSymbols)}.`);
  }

  if (watchlistSymbols.indexOf('BNBUSDT') > watchlistSymbols.indexOf('ETHUSDT')) {
    throw new Error(`Expected BNBUSDT reorder to persist before ETHUSDT, got ${JSON.stringify(watchlistSymbols)}.`);
  }

  await page.locator('[data-status="loading"]').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

  await page.screenshot({ path: path.join(outputDir, 'watchlist-search.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
