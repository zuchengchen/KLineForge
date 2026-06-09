import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-6');

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
  await page.waitForSelector('.kline-chart-host__connection', { timeout: 10_000 });

  const initialStates = await page.locator('.kline-chart-host').evaluateAll((hosts) =>
    hosts.map((host) => ({
      chartId: host.getAttribute('data-chart-id'),
      connectionState: host.getAttribute('data-connection-state'),
      text: host.querySelector('.kline-chart-host__connection')?.textContent,
    })),
  );

  if (
    initialStates.length < 2 ||
    initialStates.some((state) => !state.connectionState || state.connectionState === 'idle')
  ) {
    throw new Error(`Expected visible live connection states, got ${JSON.stringify(initialStates)}.`);
  }

  const beforeReconnect = await page.evaluate(() => ({
    left: globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getDataSummary(),
    right: globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getDataSummary(),
  }));

  if (!beforeReconnect.left || !beforeReconnect.right) {
    throw new Error(`Expected chart debug summaries, got ${JSON.stringify(beforeReconnect)}.`);
  }

  await page.evaluate(() => {
    globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.reconnect();
    globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.reconnect();
  });
  await page.waitForTimeout(3_000);

  const afterReconnect = await page.evaluate(() => ({
    left: globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getDataSummary(),
    right: globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getDataSummary(),
  }));

  if (!afterReconnect.left || !afterReconnect.right) {
    throw new Error(`Expected chart debug summaries after reconnect, got ${JSON.stringify(afterReconnect)}.`);
  }

  for (const chartId of ['left', 'right']) {
    const before = beforeReconnect[chartId];
    const after = afterReconnect[chartId];

    if (after.count < before.count) {
      throw new Error(`${chartId} chart lost data after forced reconnect.`);
    }

    if (after.count - before.count > 2) {
      throw new Error(
        `${chartId} chart likely appended duplicate candles after reconnect: before=${before.count}, after=${after.count}.`,
      );
    }

    if (after.firstTimestamp !== before.firstTimestamp) {
      throw new Error(`${chartId} chart first timestamp changed after reconnect.`);
    }
  }

  await page.screenshot({ path: path.join(outputDir, 'live-connection.png'), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
