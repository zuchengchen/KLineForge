import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const executablePath = process.env.CHROMIUM_PATH ?? (await resolveSystemChromium());
const outputDir = 'artifacts/performance';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const startedAt = performance.now();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-pane canvas', { timeout: 15_000 });
  await page.waitForTimeout(1_000);

  const metrics = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.chart-pane canvas')];
    const nonBlankCanvases = canvases.filter((canvas) => {
      const context = canvas.getContext('2d');

      if (!context || canvas.width === 0 || canvas.height === 0) {
        return false;
      }

      const { data } = context.getImageData(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1,
        1,
      );

      return data.some((channel) => channel !== 0);
    });

    return {
      chartPaneCount: document.querySelectorAll('.chart-pane').length,
      canvasCount: canvases.length,
      nonBlankCanvasCount: nonBlankCanvases.length,
      bodyTextLength: document.body.innerText.length,
    };
  });
  const renderReadyMs = Math.round(performance.now() - startedAt);

  await page.screenshot({ path: `${outputDir}/tauri-render-smoke.png`, fullPage: true });
  const result = {
    url,
    renderReadyMs,
    ...metrics,
    passed: metrics.chartPaneCount >= 2 && metrics.canvasCount >= 2 && metrics.nonBlankCanvasCount >= 2,
  };

  await writeFile(`${outputDir}/tauri-render-smoke.json`, `${JSON.stringify(result, null, 2)}\n`);

  if (!result.passed) {
    throw new Error(`render smoke failed: ${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify(result, null, 2));
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
