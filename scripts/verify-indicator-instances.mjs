import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const executablePath = process.env.CHROMIUM_PATH ?? (await resolveSystemChromium());
const outputDir = 'artifacts/indicator-instances';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const steps = [];

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-indicator-list]', { timeout: 15_000 });
  await page.waitForSelector('.chart-pane canvas', { timeout: 15_000 });
  await expectScope(page, 'left:5m', ['Volume', 'MA(5,10,30)', 'EMA(12,26)', 'BOLL(20,2)', 'MACD(12,26,9)']);
  steps.push('default instances loaded for left 5m');

  await editFirstMa(page, '7,21', '#ff0000', '3', 'dashed');
  await expectScope(page, 'left:5m', ['MA(7,21)']);
  await expectInstance(page, 'left:5m', 'MA(7,21)', (instance) => {
    assert(instance.styles['7'].color.toLowerCase() === '#ff0000', 'edited MA color persisted');
    assert(instance.styles['7'].lineWidth === 3, 'edited MA width persisted');
    assert(instance.styles['7'].lineStyle === 'dashed', 'edited MA line style persisted');
  });
  steps.push('edited MA params and style');

  await page.locator('[data-indicator-toggle="MA(7,21)"]').click();
  await expectInstance(page, 'left:5m', 'MA(7,21)', (instance) => {
    assert(instance.enabled === false, 'hide toggled MA off');
  });
  await page.locator('[data-indicator-toggle="MA(7,21)"]').click();
  await expectInstance(page, 'left:5m', 'MA(7,21)', (instance) => {
    assert(instance.enabled === true, 'show toggled MA on');
  });
  steps.push('hide/show works');

  await addIndicator(page, 'rsi', { period: '9' });
  await expectScope(page, 'left:5m', ['RSI(9)']);
  steps.push('added RSI instance');

  await page.locator('[data-indicator-delete="RSI(9)"]').click();
  await page.waitForTimeout(100);
  await expectMissing(page, 'left:5m', 'RSI(9)');
  steps.push('deleted RSI instance');

  await page.locator('[data-indicator-scope="right"]').click();
  await expectScope(page, 'right:1h', ['MA(5,10,30)']);
  await addIndicator(page, 'boll', { period: '34', multiplier: '2.5' });
  await expectScope(page, 'right:1h', ['BOLL(34,2.5)']);
  await expectMissing(page, 'left:5m', 'BOLL(34,2.5)');
  steps.push('right chart isolated from left chart');

  await selectToolbarSelect(page, 1, '2h');
  await page.waitForTimeout(250);
  await expectScope(page, 'right:2h', ['MA(5,10,30)']);
  await expectMissing(page, 'right:2h', 'BOLL(34,2.5)');
  await addIndicator(page, 'supertrend', { period: '11', multiplier: '4' });
  await expectScope(page, 'right:2h', ['Supertrend(11,4)']);
  await selectToolbarSelect(page, 1, '1h');
  await page.waitForTimeout(250);
  await expectScope(page, 'right:1h', ['BOLL(34,2.5)']);
  await expectMissing(page, 'right:1h', 'Supertrend(11,4)');
  steps.push('interval-scoped instances restored after switching back');

  await fillScopeToLimit(page);
  await page.waitForSelector('[data-indicator-limit]', { timeout: 5_000 });
  const addDisabled = await page.locator('[data-indicator-add]').isDisabled();
  assert(addDisabled, 'add button disabled at 20 instances');
  steps.push('20-instance cap is visible and enforced');

  await selectToolbarSelect(page, 2, '1000000');
  await page.waitForSelector('[data-indicator-skip]', { timeout: 5_000 });
  const headerText = await page.locator('.chart-pane__header').first().innerText();
  assert(headerText.includes('skipped'), 'chart header shows large-data indicator skip');
  steps.push('large-data skip feedback visible');

  const screenshotPath = `${outputDir}/indicator-instances.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const summary = {
    url,
    passed: true,
    steps,
    screenshotPath,
    indicatorState: await readIndicatorState(page),
  };

  await writeFile(`${outputDir}/indicator-instances.json`, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}

async function editFirstMa(page, periods, color, width, lineStyle) {
  await page.locator('[data-indicator-edit="MA(5,10,30)"]').click();
  await page.locator('[data-indicator-param="periods"]').fill(periods);
  await page.locator('[data-indicator-style-color="7"]').fill(color);
  await page.locator('[data-indicator-style-width="7"]').fill(width);
  await page.locator('[data-indicator-style-line="7"]').selectOption(lineStyle);
  await page.locator('[data-indicator-save]').click();
  await page.waitForSelector('[data-indicator-modal]', { state: 'detached', timeout: 5_000 });
}

async function addIndicator(page, kind, params) {
  await page.locator('[data-indicator-add]').click();
  await page.locator('[data-indicator-kind]').selectOption(kind);

  for (const [name, value] of Object.entries(params)) {
    await page.locator(`[data-indicator-param="${name}"]`).fill(value);
  }

  await page.locator('[data-indicator-save]').click();
  await page.waitForSelector('[data-indicator-modal]', { state: 'detached', timeout: 5_000 });
}

async function fillScopeToLimit(page) {
  for (let period = 50; period < 80; period += 1) {
    const state = await readIndicatorState(page);
    const right1h = state['right:1h'] ?? [];

    if (right1h.length >= 20) {
      return;
    }

    await addIndicator(page, 'rsi', { period: String(period) });
  }
}

async function expectScope(page, scope, names) {
  await page.waitForFunction(
    ({ scope, names }) => {
      const state = window.__KLINEFORGE_INDICATORS__ ?? {};
      const rows = state[scope] ?? [];

      return names.every((name) => rows.some((row) => row.name === name));
    },
    { scope, names },
    { timeout: 5_000 },
  );
}

async function expectMissing(page, scope, name) {
  await page.waitForFunction(
    ({ scope, name }) => {
      const state = window.__KLINEFORGE_INDICATORS__ ?? {};
      const rows = state[scope] ?? [];

      return !rows.some((row) => row.name === name);
    },
    { scope, name },
    { timeout: 5_000 },
  );
}

async function expectInstance(page, scope, name, assertion) {
  const state = await readIndicatorState(page);
  const instance = (state[scope] ?? []).find((row) => row.name === name);

  assert(instance, `${name} not found in ${scope}`);
  assertion(instance);
}

async function readIndicatorState(page) {
  return page.evaluate(() => window.__KLINEFORGE_INDICATORS__ ?? {});
}

async function selectToolbarSelect(page, index, value) {
  await page.locator('.toolbar select').nth(index).selectOption(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
