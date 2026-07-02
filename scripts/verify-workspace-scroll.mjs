import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';

const providedUrl = process.argv[2];
const baseUrl = providedUrl ?? 'http://127.0.0.1:1422/';
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
    const page = await browser.newPage({ viewport: { width: 1024, height: 520 } });
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
        const workspace = document.querySelector('.workspace');

        return workspace && workspace.scrollHeight > workspace.clientHeight;
      },
      { timeout: 30_000 },
    );
    await page.waitForTimeout(500);

    const initialLayout = await readLayoutState(page);

    if (!initialLayout.workspaceScrollable) {
      throw new Error(`workspace is not scrollable: ${JSON.stringify(initialLayout)}`);
    }
    if (!initialLayout.sidebarScrollable) {
      throw new Error(`sidebar is not scrollable: ${JSON.stringify(initialLayout)}`);
    }
    if (initialLayout.chartSurfaceCount < 2) {
      throw new Error(`expected two chart surfaces: ${JSON.stringify(initialLayout)}`);
    }
    if (initialLayout.chartGridHeight < initialLayout.workspaceClientHeight * 0.75) {
      throw new Error(`chart grid does not occupy most of the viewport: ${JSON.stringify(initialLayout)}`);
    }
    if (initialLayout.bottomDockTop !== null && initialLayout.bottomDockTop < initialLayout.workspaceClientHeight - 4) {
      throw new Error(`bottom dock is visible too early: ${JSON.stringify(initialLayout)}`);
    }

    const sidebarBox = await page.locator('.sidebar').boundingBox();

    if (!sidebarBox) {
      throw new Error('sidebar was not measurable');
    }

    await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const workspace = document.querySelector('.workspace');

      if (sidebar) {
        sidebar.scrollTop = 0;
      }
      if (workspace) {
        workspace.scrollTop = 0;
      }
    });
    await page.mouse.move(sidebarBox.x + sidebarBox.width * 0.5, sidebarBox.y + sidebarBox.height * 0.5);
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(() => (document.querySelector('.sidebar')?.scrollTop ?? 0) > 0, { timeout: 5_000 });
    const afterSidebarWheel = await readLayoutState(page);

    if (afterSidebarWheel.workspaceScrollTop !== 0) {
      throw new Error(`sidebar wheel scrolled workspace: ${JSON.stringify(afterSidebarWheel)}`);
    }

    const chartBox = await page.locator('.chart-pane__surface').first().boundingBox();

    if (!chartBox) {
      throw new Error('left chart surface was not measurable');
    }

    await page.evaluate(() => {
      const workspace = document.querySelector('.workspace');

      if (workspace) {
        workspace.scrollTop = 0;
      }
    });
    await page.mouse.move(chartBox.x + chartBox.width * 0.5, chartBox.y + chartBox.height * 0.5);
    const beforeChartWheel = await readChartState(page);
    await page.mouse.wheel(0, -700);
    await page.waitForFunction(
      (beforeRange) => {
        const nextRange = globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getVisibleLogicalRange?.();

        if (!beforeRange || !nextRange) {
          return beforeRange !== nextRange;
        }

        return Math.abs(beforeRange.from - nextRange.from) > 0.01 || Math.abs(beforeRange.to - nextRange.to) > 0.01;
      },
      beforeChartWheel.leftRange,
      { timeout: 5_000 },
    );

    const afterChartWheel = await readLayoutState(page);
    const afterChartWheelState = await readChartState(page);

    if (afterChartWheel.workspaceScrollTop !== 0) {
      throw new Error(`chart wheel scrolled workspace instead of zooming chart: ${JSON.stringify(afterChartWheel)}`);
    }
    if (rangesApproximatelyEqual(beforeChartWheel.leftRange, afterChartWheelState.leftRange)) {
      throw new Error(
        `chart wheel did not zoom the left chart: before=${JSON.stringify(
          beforeChartWheel.leftRange,
        )}, after=${JSON.stringify(afterChartWheelState.leftRange)}`,
      );
    }
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(
      (zoomedRange) => {
        const nextRange = globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getVisibleLogicalRange?.();

        if (!zoomedRange || !nextRange) {
          return zoomedRange !== nextRange;
        }

        return Math.abs(zoomedRange.from - nextRange.from) > 0.01 || Math.abs(zoomedRange.to - nextRange.to) > 0.01;
      },
      afterChartWheelState.leftRange,
      { timeout: 5_000 },
    );
    const afterChartZoomOut = await readLayoutState(page);
    const afterChartZoomOutState = await readChartState(page);

    if (afterChartZoomOut.workspaceScrollTop !== 0) {
      throw new Error(`chart zoom-out wheel scrolled workspace: ${JSON.stringify(afterChartZoomOut)}`);
    }

    await page.evaluate(() => {
      const workspace = document.querySelector('.workspace');

      if (workspace) {
        workspace.scrollTop = workspace.scrollHeight;
      }
    });
    await page.waitForTimeout(200);

    const finalLayout = await readLayoutState(page);
    const canvasStats = await readCanvasStats(page);

    if (!finalLayout.bottomDockReachable) {
      throw new Error(`bottom dock is not reachable after workspace scroll: ${JSON.stringify(finalLayout)}`);
    }
    if (canvasStats.canvasCount < 2 || canvasStats.nonBlankCanvasCount < 2) {
      throw new Error(`chart canvases are not rendered: ${JSON.stringify(canvasStats)}`);
    }

    const passed = pageErrors.length === 0 && consoleErrors.length === 0;
    const result = {
      url: url.toString(),
      viewport: { width: 1024, height: 520 },
      initialLayout,
      afterSidebarWheel,
      beforeChartWheel,
      afterChartWheel,
      afterChartWheelState,
      afterChartZoomOut,
      afterChartZoomOutState,
      finalLayout,
      ...canvasStats,
      consoleErrorCount: consoleErrors.length,
      pageErrors,
      consoleErrors: consoleErrors.slice(0, 10),
      passed,
    };

    await page.screenshot({ path: `${outputDir}/workspace-scroll.png`, fullPage: true });
    await writeFile(`${outputDir}/workspace-scroll.json`, `${JSON.stringify(result, null, 2)}\n`);

    if (!passed) {
      throw new Error(`workspace scroll verification failed: ${JSON.stringify(result, null, 2)}`);
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

async function readLayoutState(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.workspace');
    const bottomDock = document.querySelector('.bottom-dock');
    const chartGrid = document.querySelector('.chart-grid');
    const bottomDockRect = bottomDock?.getBoundingClientRect();
    const chartGridRect = chartGrid?.getBoundingClientRect();

    return {
      sidebarClientHeight: sidebar?.clientHeight ?? 0,
      sidebarScrollHeight: sidebar?.scrollHeight ?? 0,
      sidebarScrollTop: sidebar?.scrollTop ?? 0,
      sidebarScrollable: Boolean(sidebar && sidebar.scrollHeight > sidebar.clientHeight),
      workspaceClientHeight: workspace?.clientHeight ?? 0,
      workspaceScrollHeight: workspace?.scrollHeight ?? 0,
      workspaceScrollTop: workspace?.scrollTop ?? 0,
      workspaceScrollable: Boolean(workspace && workspace.scrollHeight > workspace.clientHeight),
      chartSurfaceCount: document.querySelectorAll('.chart-pane__surface').length,
      chartGridHeight: chartGridRect?.height ?? 0,
      chartGridTop: chartGridRect?.top ?? null,
      chartGridBottom: chartGridRect?.bottom ?? null,
      bottomDockTop: bottomDockRect?.top ?? null,
      bottomDockBottom: bottomDockRect?.bottom ?? null,
      bottomDockReachable: Boolean(bottomDockRect && bottomDockRect.top < window.innerHeight && bottomDockRect.bottom > 0),
    };
  });
}

async function readCanvasStats(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.chart-pane__surface canvas')];
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
      canvasCount: canvases.length,
      nonBlankCanvasCount: canvasStats.filter((stat) => stat.nonBlank).length,
      canvasStats,
    };
  });
}

async function readChartState(page) {
  return page.evaluate(() => ({
    leftRange: globalThis.__KLINEFORGE_CHART_DEBUG__?.left?.getVisibleLogicalRange?.() ?? null,
    rightRange: globalThis.__KLINEFORGE_CHART_DEBUG__?.right?.getVisibleLogicalRange?.() ?? null,
  }));
}

function rangesApproximatelyEqual(first, second, tolerance = 0.01) {
  if (!first || !second) {
    return first === second;
  }

  return Math.abs(first.from - second.from) <= tolerance && Math.abs(first.to - second.to) <= tolerance;
}

function startDevServer(url) {
  const port = new URL(url).port || '1422';
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
