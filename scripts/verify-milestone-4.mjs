import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve('artifacts/milestone-4');

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outputDir, 'dark.png'), fullPage: true });

  const titleVisible = await page.getByText('KLineForge').isVisible();
  const leftChartVisible = await page.getByText('Left chart').isVisible();
  const rightChartVisible = await page.getByText('Right chart').isVisible();

  if (!titleVisible || !leftChartVisible || !rightChartVisible) {
    throw new Error('Default desktop shell did not render expected chart layout text.');
  }

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Theme').selectOption('light');
  await page.screenshot({ path: path.join(outputDir, 'light.png'), fullPage: true });

  const theme = await page.evaluate(() => document.documentElement.dataset.theme);

  if (theme !== 'light') {
    throw new Error(`Expected light theme after settings change, received ${theme ?? 'undefined'}.`);
  }
} finally {
  await browser.close();
}
