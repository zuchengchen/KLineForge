import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-8');

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
  await page.getByRole('button', { name: 'Cache management' }).click();
  await page.getByRole('table', { name: 'Cache management' }).waitFor({ timeout: 15_000 });
  await page.waitForSelector('[data-cache-task-id]', { timeout: 15_000 });

  const initialTaskCount = await page.locator('[data-cache-task-id]').count();

  if (initialTaskCount < 10) {
    throw new Error(`Expected cache tasks for supported intervals, found ${initialTaskCount}.`);
  }

  const pauseTarget = page.locator('[data-cache-task-id="usdM:BTCUSDT:1M"]');

  await pauseTarget.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-cache-status="paused"]').length > 0);
  await page.locator('[data-cache-status="paused"]').first().getByRole('button', { name: 'Resume' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-cache-status="paused"]'));

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Theme').selectOption('light');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cache management' }).click();
  await page.getByRole('button', { name: 'Clear all cache' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-cache-task-id]').length === 0);

  const settingsTheme = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open('klineforge');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return await new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const request = tx.objectStore('settings').get('chartSettings');

      request.onsuccess = () => resolve(request.result?.value?.theme ?? null);
      request.onerror = () => reject(request.error);
    });
  });

  if (settingsTheme !== 'light') {
    throw new Error(`Expected manual cache clearing to preserve settings, theme=${settingsTheme ?? 'missing'}.`);
  }

  await page.screenshot({ path: path.join(outputDir, 'cache-management.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
