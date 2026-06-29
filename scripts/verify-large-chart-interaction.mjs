import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173/';
const rows = Number(process.argv[3] ?? process.env.KLINEFORGE_PERF_ROWS ?? 100_000);
const executablePath = process.env.CHROMIUM_PATH ?? (await resolveSystemChromium());
const outputDir = 'artifacts/performance';
const rowLabel = rows >= 1_000_000 ? '1m' : '100k';
const url = new URL(baseUrl);
url.searchParams.set('perfRows', String(rows));

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=4096'],
});

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const startedAt = performance.now();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.chart-pane canvas', { timeout: 30_000 });
  await page.waitForFunction(
    (expectedRows) => {
      const state = globalThis.__KLINEFORGE_PERF__;

      return (
        state &&
        state.leftRows >= expectedRows &&
        state.rightRows >= expectedRows &&
        state.metrics?.left?.inputRows >= expectedRows &&
        state.metrics?.right?.inputRows >= expectedRows
      );
    },
    rows,
    { timeout: rows >= 1_000_000 ? 120_000 : 60_000 },
  );
  await page.waitForTimeout(700);

  const chartBox = await page.locator('.chart-pane__surface').first().boundingBox();

  if (!chartBox) {
    throw new Error('left chart surface was not measurable');
  }

  const interactionStart = performance.now();
  await page.mouse.move(chartBox.x + chartBox.width * 0.5, chartBox.y + chartBox.height * 0.5);
  await page.mouse.wheel(-700, 0);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.mouse.move(chartBox.x + chartBox.width * 0.78, chartBox.y + chartBox.height * 0.5, { steps: 14 });
  await page.mouse.up();
  await page.mouse.move(chartBox.x + chartBox.width * 0.3, chartBox.y + chartBox.height * 0.42, { steps: 8 });
  await page.waitForTimeout(300);
  const interactionMs = Math.round(performance.now() - interactionStart);

  const workflowResults = {
    drawing: 'skipped-for-1m-basic-browsing',
    pngExport: 'skipped-for-1m-basic-browsing',
    csvExport: 'skipped-for-1m-basic-browsing',
  };

  if (rows <= 100_000) {
    await page.locator('[data-perf-action="draw-left"]').click();
    await page.waitForFunction(() => document.querySelector('.drawing-list')?.textContent?.includes('BTCUSDT'), {
      timeout: 10_000,
    });
    workflowResults.drawing = 'passed';

    const pngDownloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.locator('[data-perf-action="png-left"]').click();
    const pngDownload = await pngDownloadPromise;
    await pngDownload.saveAs(`${outputDir}/large-chart-${rowLabel}-left.png`);
    workflowResults.pngExport = 'passed';

    const csvDownloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('[data-perf-action="export-csv"]').click();
    const csvDownload = await csvDownloadPromise;
    await csvDownload.saveAs(`${outputDir}/large-chart-${rowLabel}.csv`);
    workflowResults.csvExport = 'passed';
  }

  const metrics = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.chart-pane canvas')];
    const canvasStats = canvases.map((canvas) => {
      const context = canvas.getContext('2d');

      if (!context || canvas.width === 0 || canvas.height === 0) {
        return {
          width: canvas.width,
          height: canvas.height,
          nonBlank: false,
        };
      }

      const samplePoints = [
        [0.25, 0.25],
        [0.5, 0.5],
        [0.75, 0.75],
      ];
      const nonBlank = samplePoints.some(([xFactor, yFactor]) => {
        const { data } = context.getImageData(
          Math.max(0, Math.floor(canvas.width * xFactor)),
          Math.max(0, Math.floor(canvas.height * yFactor)),
          1,
          1,
        );

        return data.some((channel) => channel !== 0);
      });

      return {
        width: canvas.width,
        height: canvas.height,
        nonBlank,
      };
    });

    return {
      perfState: globalThis.__KLINEFORGE_PERF__,
      chartPaneCount: document.querySelectorAll('.chart-pane').length,
      canvasCount: canvases.length,
      nonBlankCanvasCount: canvasStats.filter((stat) => stat.nonBlank).length,
      canvasStats,
      heapUsedMb:
        typeof performance.memory?.usedJSHeapSize === 'number'
          ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
          : null,
    };
  });
  const renderReadyMs = Math.round(performance.now() - startedAt);

  await page.screenshot({ path: `${outputDir}/large-chart-${rowLabel}.png`, fullPage: true });

  const expectedLod = rows >= 1_000_000;
  const passed =
    metrics.chartPaneCount >= 2 &&
    metrics.canvasCount >= 2 &&
    metrics.nonBlankCanvasCount >= 2 &&
    metrics.perfState?.leftRows >= rows &&
    metrics.perfState?.rightRows >= rows &&
    metrics.perfState?.leftSource?.includes('binance-public-data') &&
    metrics.perfState?.rightSource?.includes('binance-public-data') &&
    metrics.perfState?.metrics?.left?.lodApplied === expectedLod &&
    metrics.perfState?.metrics?.right?.lodApplied === expectedLod &&
    (rows > 100_000 || Object.values(workflowResults).every((value) => value === 'passed')) &&
    pageErrors.length === 0;

  const result = {
    url: url.toString(),
    requestedRows: rows,
    renderReadyMs,
    interactionMs,
    workflows: workflowResults,
    ...metrics,
    consoleErrorCount: consoleMessages.length,
    pageErrors,
    consoleMessages: consoleMessages.slice(0, 10),
    passed,
  };

  await writeFile(`${outputDir}/large-chart-${rowLabel}-interaction.json`, `${JSON.stringify(result, null, 2)}\n`);

  if (!passed) {
    throw new Error(`large chart interaction failed: ${JSON.stringify(result, null, 2)}`);
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

async function resolveSystemChromium() {
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
