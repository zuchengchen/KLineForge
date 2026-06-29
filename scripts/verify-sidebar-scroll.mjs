import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const executablePath = process.env.CHROMIUM_PATH ?? (await resolveSystemChromium());
const outputDir = 'artifacts/performance';
const viewports = [
  { width: 1024, height: 700, label: '1024x700' },
  { width: 1440, height: 900, label: '1440x900' },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const results = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.sidebar', { timeout: 15_000 });
    await page.waitForSelector('.chart-pane', { timeout: 15_000 });
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const app = document.querySelector('.app');
      const chartGrid = document.querySelector('.chart-grid');

      if (!(sidebar instanceof HTMLElement) || !(app instanceof HTMLElement) || !(chartGrid instanceof HTMLElement)) {
        throw new Error('required layout elements were not found');
      }

      return {
        bodyClientHeight: document.documentElement.clientHeight,
        bodyScrollHeight: document.documentElement.scrollHeight,
        bodyScrollTop: document.documentElement.scrollTop || document.body.scrollTop,
        sidebarClientHeight: sidebar.clientHeight,
        sidebarScrollHeight: sidebar.scrollHeight,
        sidebarScrollTop: sidebar.scrollTop,
        appHeight: app.getBoundingClientRect().height,
        chartGridHeight: chartGrid.getBoundingClientRect().height,
      };
    });

    await page.locator('.sidebar').hover();
    await page.mouse.wheel(0, 1_200);
    await page.waitForTimeout(150);

    const afterWheel = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');

      if (!(sidebar instanceof HTMLElement)) {
        throw new Error('sidebar was not found after wheel');
      }

      return {
        bodyScrollTop: document.documentElement.scrollTop || document.body.scrollTop,
        sidebarScrollTop: sidebar.scrollTop,
      };
    });

    const afterScrollToBottom = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const statusList = document.querySelector('.sidebar .status-list');
      const chartGrid = document.querySelector('.chart-grid');

      if (
        !(sidebar instanceof HTMLElement) ||
        !(statusList instanceof HTMLElement) ||
        !(chartGrid instanceof HTMLElement)
      ) {
        throw new Error('required post-scroll elements were not found');
      }

      sidebar.scrollTop = sidebar.scrollHeight;

      const sidebarBox = sidebar.getBoundingClientRect();
      const statusBox = statusList.getBoundingClientRect();
      const chartGridBox = chartGrid.getBoundingClientRect();

      return {
        bodyScrollTop: document.documentElement.scrollTop || document.body.scrollTop,
        sidebarScrollTop: sidebar.scrollTop,
        statusVisible:
          statusBox.top >= sidebarBox.top &&
          statusBox.bottom <= sidebarBox.bottom &&
          statusBox.height > 0,
        chartGridVisible: chartGridBox.width > 0 && chartGridBox.height > 0,
      };
    });

    const screenshotPath = `${outputDir}/sidebar-scroll-${viewport.label}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();

    const isShortViewport = viewport.height === 700;
    const result = {
      viewport,
      screenshotPath,
      before,
      afterWheel,
      afterScrollToBottom,
      passed:
        before.bodyScrollHeight === before.bodyClientHeight &&
        afterWheel.bodyScrollTop === 0 &&
        afterScrollToBottom.bodyScrollTop === 0 &&
        before.appHeight === viewport.height &&
        before.chartGridHeight > 0 &&
        afterScrollToBottom.chartGridVisible &&
        afterScrollToBottom.statusVisible &&
        (!isShortViewport || before.sidebarScrollHeight > before.sidebarClientHeight) &&
        (!isShortViewport || afterWheel.sidebarScrollTop > before.sidebarScrollTop),
    };

    results.push(result);
  }

  const summary = {
    url,
    passed: results.every((result) => result.passed),
    results,
  };

  await writeFile(`${outputDir}/sidebar-scroll.json`, `${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.passed) {
    throw new Error(`sidebar scroll verification failed: ${JSON.stringify(summary, null, 2)}`);
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}

async function resolveSystemChromium() {
  if (await exists('/usr/bin/google-chrome')) {
    return '/usr/bin/google-chrome';
  }

  if (await exists('/usr/bin/google-chrome-stable')) {
    return '/usr/bin/google-chrome-stable';
  }

  if (await exists('/usr/bin/chromium')) {
    return '/usr/bin/chromium';
  }

  if (await exists('/usr/bin/chromium-browser')) {
    return '/usr/bin/chromium-browser';
  }

  return undefined;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
