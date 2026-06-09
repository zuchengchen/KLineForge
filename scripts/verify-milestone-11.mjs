import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isExpectedNetworkConsoleError } from './consoleFilters.mjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-11');

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

async function saveDownload(download, filename) {
  const targetPath = path.join(outputDir, filename);
  await download.saveAs(targetPath);
  return targetPath;
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
});

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
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
  await page.waitForSelector('[data-chart-id="left"][data-status="ready"]', { timeout: 90_000 });
  await page.waitForSelector('[data-chart-id="right"][data-status="ready"]', { timeout: 90_000 });

  const leftPng = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Left PNG' }).click();
  const leftPngPath = await saveDownload(await leftPng, 'left-chart.png');

  const rightPng = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Right PNG' }).click();
  const rightPngPath = await saveDownload(await rightPng, 'right-chart.png');

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csvPath = await saveDownload(await csvDownload, 'klines.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  if (!csv.startsWith('openTime,open,high,low,close,volume,closeTime,quoteVolume,tradeCount')) {
    throw new Error(`CSV header did not match expected fields: ${csv.slice(0, 160)}`);
  }

  const configDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export config' }).click();
  const configPath = await saveDownload(await configDownload, 'config.json');
  const configRaw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);

  if (config.app !== 'KLineForge' || config.schemaVersion !== 1) {
    throw new Error(`Config export has invalid envelope: ${configRaw.slice(0, 160)}`);
  }

  if (configRaw.includes('klines') || configRaw.includes('klineRanges') || configRaw.includes('cacheTasks')) {
    throw new Error('Config export must exclude K-line cache, ranges and cache tasks.');
  }

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(configPath);
  await page.getByText(/Config imported|配置已导入/).waitFor({ timeout: 10_000 });

  const badConfigPath = path.join(outputDir, 'bad-config.json');
  await fs.writeFile(badConfigPath, '{"app":"NotKLineForge"}', 'utf8');
  await input.setInputFiles(badConfigPath);
  await page.getByText(/valid KLineForge|无效|invalid/i).waitFor({ timeout: 10_000 });

  for (const pngPath of [leftPngPath, rightPngPath]) {
    const stat = await fs.stat(pngPath);

    if (stat.size < 1_000) {
      throw new Error(`PNG export ${pngPath} looks too small: ${stat.size} bytes.`);
    }
  }

  await page.screenshot({ path: path.join(outputDir, 'export-import.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
