import { execFileSync, spawn } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';

const port = 5196;
const base = `http://127.0.0.1:${port}`;
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Vite unavailable');
}

async function openBuilder(browser: Browser, pageId = 'p3'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('onboarding_seen', 'true');
    localStorage.setItem('pb_onboarding_hints_seen', 'true');
  });
  await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=${pageId}&action=edit`);
  await page.waitForSelector('.pb-canvas-area');
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.waitForSelector('.pb-layers-panel');
  return page;
}

async function focusedLayerId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.classList.contains('pb-layer-row')
      ? active.dataset.builderSectionId ?? null
      : null;
  });
}

async function activeLayer(page: Page) {
  return page.locator('.pb-layer-row.active');
}

async function runLifecycleFlow(browser: Browser): Promise<void> {
  const page = await openBuilder(browser);
  assert(await page.locator('#pb-lifecycle-live').count() === 1, 'Expected one lifecycle live region');
  assert(await page.getByRole('button', { name: 'Paste section' }).isDisabled(), 'Paste must begin disabled');

  const firstRow = page.locator('.pb-layer-row').first();
  await firstRow.getByRole('button', { name: /Select Hero section/i }).click();
  await firstRow.getByRole('button', { name: /Reset Hero section/i }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('pb-layer-row'));
  assert((await page.locator('#pb-lifecycle-live').textContent())?.includes('reset'), 'Reset announcement missing');

  const initialCount = await page.locator('.pb-layer-row').count();
  await page.getByRole('button', { name: 'Add section', exact: true }).first().click();
  const addHero = page.getByRole('button', { name: 'Add Hero section' });
  await addHero.waitFor();
  assert(await addHero.evaluate(element => element === document.activeElement), 'First Add option was not focused');
  await addHero.press('Enter');
  await page.waitForFunction(count => document.querySelectorAll('.pb-layer-row').length === count + 1, initialCount);
  const addedId = await focusedLayerId(page);
  assert(addedId, 'Added section row was not focused');

  await (await activeLayer(page)).getByRole('button', { name: /Duplicate Hero section/i }).click();
  await page.waitForFunction(count => document.querySelectorAll('.pb-layer-row').length === count + 2, initialCount);
  const duplicateId = await focusedLayerId(page);
  assert(duplicateId && duplicateId !== addedId, 'Duplicate row was not focused');

  await (await activeLayer(page)).getByRole('button', { name: /Move Hero section up/i }).click();
  assert(await focusedLayerId(page) === duplicateId, 'Move did not restore focus');
  await (await activeLayer(page)).getByRole('button', { name: /Hide Hero section/i }).click();
  assert(await focusedLayerId(page) === duplicateId, 'Hide did not restore focus');
  assert(await (await activeLayer(page)).getByRole('button', { name: /Show Hero section/i }).isVisible(), 'Show action missing');
  await (await activeLayer(page)).getByRole('button', { name: /Show Hero section/i }).click();
  assert(await focusedLayerId(page) === duplicateId, 'Show did not restore focus');

  const resetButton = (await activeLayer(page)).getByRole('button', { name: /Reset Hero section/i });
  await resetButton.click();
  assert(await resetButton.evaluate(element => element === document.activeElement), 'No-op Reset moved focus');

  const copyButton = (await activeLayer(page)).getByRole('button', { name: /Copy Hero section/i });
  await copyButton.click();
  assert(await copyButton.evaluate(element => element === document.activeElement), 'Copy moved focus');
  assert(await page.getByRole('button', { name: 'Paste section' }).isEnabled(), 'Paste did not enable after Copy');
  assert((await page.locator('#pb-lifecycle-live').textContent())?.includes('copied'), 'Copy announcement missing');

  await page.getByRole('button', { name: 'Paste section' }).click();
  await page.waitForFunction(count => document.querySelectorAll('.pb-layer-row').length === count + 3, initialCount);
  assert(await focusedLayerId(page), 'Pasted row was not focused');

  const addedRow = page.locator(`.pb-layer-row[data-builder-section-id="${addedId}"]`);
  await addedRow.getByRole('button', { name: /Delete Hero section/i }).click();
  await page.waitForFunction(count => document.querySelectorAll('.pb-layer-row').length === count + 2, initialCount);
  assert(await focusedLayerId(page), 'Delete fallback row was not focused');

  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  assert(await undo.isEnabled(), 'Undo was not enabled');
  await undo.click();
  assert(await focusedLayerId(page), 'Undo did not restore focus');
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  assert(await redo.isEnabled(), 'Redo was not enabled');
  await redo.click();
  assert(await focusedLayerId(page), 'Redo did not restore focus');

  for (const [name, className, expectedWidth] of [
    ['Tablet viewport, 768 pixels', 'pb-canvas-tablet', 768],
    ['Mobile viewport, 375 pixels', 'pb-canvas-mobile', 375]
  ] as const) {
    await page.getByRole('button', { name }).click();
    const canvas = page.locator(`.${className}`);
    await canvas.waitFor();
    assert(Math.round((await canvas.boundingBox())?.width ?? 0) >= expectedWidth, `${name} canvas width failed`);
    assert(await page.getByRole('button', { name: 'Add section', exact: true }).first().isVisible(), `${name} hid Layers Add`);
  }

  await (await activeLayer(page)).getByRole('button', { name: /Select .* section/i }).click();
  const toolbar = page.locator('.pb-section-preview.active .pb-section-controls');
  assert(await toolbar.isVisible(), 'Selected canvas toolbar is not visible');
  assert(await toolbar.getByRole('button', { name: /Move .* section up/i }).count() === 1, 'Canvas toolbar lacks names');

  await (await activeLayer(page)).getByRole('button', { name: /Copy .* section/i }).click();
  await page.locator('aside.pb-left-panel select').selectOption('p4');
  await page.waitForFunction(() => (document.querySelector('aside.pb-left-panel select') as HTMLSelectElement | null)?.value === 'p4');
  await page.getByRole('tab', { name: 'Layers' }).click();
  assert(await page.getByRole('button', { name: 'Paste section' }).isDisabled(), 'Page switch did not clear Paste');
  assert(!(await focusedLayerId(page)) || await page.locator('.pb-layer-row:focus').count() <= 1, 'Stale focus ran after page switch');
  await page.context().close();
}

async function runBetweenAndEmptyFlows(browser: Browser): Promise<void> {
  const betweenPage = await openBuilder(browser);
  const afterHero = betweenPage.getByRole('button', { name: /Add section after Hero/i });
  assert(await afterHero.isVisible(), 'Between-section Add is not visible');
  assert((await afterHero.boundingBox())!.height >= 44, 'Between-section Add target is too small');
  await afterHero.press('Enter');
  const addProof = betweenPage.getByRole('button', { name: 'Add Proof section' });
  assert(await addProof.evaluate(element => element === document.activeElement), 'Between Add did not focus Add options');
  await addProof.press('Space');
  await betweenPage.waitForFunction(() => document.querySelectorAll('.pb-layer-row').length === 2);
  const types = await betweenPage.locator('.pb-layer-row .pb-layer-meta > span:first-child').allTextContents();
  assert(types.join(',') === 'hero,proof', `Between insertion order failed: ${types.join(',')}`);
  await betweenPage.context().close();

  const emptyPage = await openBuilder(browser);
  const onlyDelete = emptyPage.locator('.pb-layer-row').first().getByRole('button', { name: /Delete Hero section/i });
  await onlyDelete.click();
  await emptyPage.waitForFunction(() => document.querySelectorAll('.pb-layer-row').length === 0);
  const add = emptyPage.locator('#pb-layers-add-section');
  assert(await add.evaluate(element => element === document.activeElement), 'Only-section delete did not focus Add');
  assert(await emptyPage.getByRole('button', { name: 'Add section', exact: true }).first().isVisible(), 'Empty page Add missing');
  assert(await emptyPage.getByRole('button', { name: 'Start Guided Setup' }).isVisible(), 'Guided Setup was removed');
  await emptyPage.context().close();
}

async function run(): Promise<void> {
  let browser: Browser | undefined;
  const vite = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)
  ], {
    env: {
      ...process.env,
      VITE_ENABLE_BROWSER_FIXTURES: 'true',
      VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local',
      VITE_BUILDER_MEDIA_PERSISTENCE: 'local'
    },
    stdio: 'ignore'
  });
  try {
    await ready();
    browser = await chromium.launch({ channel: 'chrome' });
    await runLifecycleFlow(browser);
    await runBetweenAndEmptyFlows(browser);
    console.log('Task 8E visual smoke PASS');
  } finally {
    await browser?.close().catch(() => undefined);
    vite.kill();
    if (process.platform === 'win32' && vite.pid) {
      try {
        execFileSync('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' });
      } catch {}
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
