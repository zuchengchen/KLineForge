import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const providedUrl = process.argv[2];
const baseUrl = providedUrl ?? 'http://127.0.0.1:1421/';
const executablePath = process.env.CHROMIUM_PATH ?? (await resolveSystemChromium());
const outputDir = 'artifacts/performance';
const server = providedUrl ? null : startDevServer(baseUrl);

await mkdir(outputDir, { recursive: true });

try {
  if (server) {
    await waitForHttp(baseUrl, 30_000);
  }

  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const pageErrors = [];
    const url = new URL(baseUrl);
    url.searchParams.set('perfRows', '1200');

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.chart-pane__surface canvas', { timeout: 30_000 });
    await page.waitForFunction(
      () =>
        globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getVisibleLogicalRange?.() &&
        globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getVisibleLogicalRange?.(),
      { timeout: 30_000 },
    );
    await page.waitForFunction(
      () => {
        const state = globalThis.__KLINEFORGE_PERF__;

        return state?.leftRows >= 1000 && state?.rightRows >= 1000;
      },
      { timeout: 30_000 },
    );
    await page.waitForTimeout(300);

    const before = await readDebugState(page);
    const leftBox = await page.locator('.chart-pane__surface').nth(0).boundingBox();

    if (!leftBox) {
      throw new Error('left chart surface was not measurable');
    }

    await page.mouse.move(leftBox.x + leftBox.width * 0.5, leftBox.y + leftBox.height * 0.5);
    await page.waitForFunction(
      () => Boolean(globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getLastAppliedCrosshair?.()),
      { timeout: 5_000 },
    );
    const afterCrosshair = await readDebugState(page);

    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(leftBox.x + leftBox.width * 0.24, leftBox.y + leftBox.height * 0.5, { steps: 16 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const afterInteraction = await readDebugState(page);

    if (rangesApproximatelyEqual(before.leftRange, afterInteraction.leftRange)) {
      throw new Error(
        `left chart viewport did not change after zoom/pan: before=${JSON.stringify(
          before.leftRange,
        )}, after=${JSON.stringify(afterInteraction.leftRange)}`,
      );
    }

    if (!rangesApproximatelyEqual(before.rightRange, afterInteraction.rightRange)) {
      throw new Error(
        `right chart viewport changed after left chart zoom/pan: before=${JSON.stringify(
          before.rightRange,
        )}, after=${JSON.stringify(afterInteraction.rightRange)}`,
      );
    }

    const passed = pageErrors.length === 0 && afterCrosshair.rightCrosshair !== null;
    const result = {
      url: url.toString(),
      rightRangeBefore: before.rightRange,
      rightRangeAfterLeftInteraction: afterInteraction.rightRange,
      leftRangeBefore: before.leftRange,
      leftRangeAfterLeftInteraction: afterInteraction.leftRange,
      rightCrosshairAfterLeftMove: afterCrosshair.rightCrosshair,
      consoleErrorCount: consoleErrors.length,
      pageErrors,
      consoleErrors: consoleErrors.slice(0, 10),
      passed,
    };

    await page.screenshot({ path: `${outputDir}/independent-chart-viewports.png`, fullPage: true });
    await writeFile(`${outputDir}/independent-chart-viewports.json`, `${JSON.stringify(result, null, 2)}\n`);

    if (!passed) {
      throw new Error(`independent chart viewport verification failed: ${JSON.stringify(result, null, 2)}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  if (server) {
    server.kill('SIGTERM');
  }
}

async function readDebugState(page) {
  return page.evaluate(() => ({
    leftRange: globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getVisibleLogicalRange?.() ?? null,
    rightRange: globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getVisibleLogicalRange?.() ?? null,
    rightCrosshair: globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getLastAppliedCrosshair?.() ?? null,
  }));
}

function rangesApproximatelyEqual(first, second, tolerance = 0.01) {
  if (!first || !second) {
    return first === second;
  }

  return Math.abs(first.from - second.from) <= tolerance && Math.abs(first.to - second.to) <= tolerance;
}

function startDevServer(url) {
  const port = new URL(url).port || '1421';
  const child = spawn('npm', ['run', 'dev', '--', '--port', port], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // The dev server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
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
