import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { renderWebsiteNavigationContent } from '../src/ui/website-management/website_navigation';

const port = 5191;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c6c1';
const viewports = [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const;
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function waitForVite() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Vite unavailable');
}

async function assertShell(page: any, label: string, requireSwitcher = false) {
  const state = await page.evaluate(() => ({
    shell: document.querySelectorAll('.wo-shell').length,
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    sidebar: document.querySelectorAll('.sidebar').length,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth,
    switcher: !!document.querySelector('.wo-website-management-switcher'),
    bodyText: document.body.innerText.slice(0, 500),
    url: window.location.href
  }));
  assert(state.shell === 1 && state.main === 1 && state.h1 === 1 && state.sidebar === 0 && state.overflow && (!requireSwitcher || state.switcher), `${label}: ${JSON.stringify(state)}`);
}

async function renderFixture(page: any, authority: string) {
  assert(await page.locator('.wo-website-navigation').count() === 1, `${authority}: navigation section disappeared before fixture: ${await page.locator('body').innerText()}`);
  const item = {
      id: 'fixture-home', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0,
      visible: true, is_cta: false, resolved_href: '/', resolution_status: 'resolved', resolution_details: 'Homepage'
    };
  const actions = {
      add: '<button type="button" class="wo-button wo-button--primary">Add menu item</button>',
      edit: () => '<button type="button" class="wo-button wo-button--secondary">Edit</button>',
      remove: () => '<button type="button" class="wo-button wo-button--danger">Delete</button>',
      move: (_id: string, direction: string) => '<button type="button" class="wo-button wo-button--ghost wo-button--sm" aria-label="Move ' + direction + '">' + (direction === 'up' ? '↑' : '↓') + '</button>',
      toggle: () => '<button type="button" class="wo-button wo-button--ghost wo-button--sm">Toggle visibility</button>',
      adopt: 'window.adoptWebsiteNavigation()',
      discard: '<button type="button" class="wo-button wo-button--secondary">Discard unpublished changes</button>',
      reload: '<button type="button" class="wo-button wo-button--secondary">Reload latest navigation</button>'
    };
  const model = authority === 'conflict'
      ? { websiteName: 'PressurePro', authority: 'conflict', items: [], legacyItems: [], error: 'Reload required' }
      : authority === 'empty'
        ? { websiteName: 'PressurePro', authority: 'live', items: [], legacyItems: [] }
        : authority === 'legacy'
          ? { websiteName: 'PressurePro', authority: 'legacy', items: [], legacyItems: [{ label: 'Home', path: '/', visible: true }] }
        : { websiteName: 'PressurePro', authority, items: [item], legacyItems: [] };
  const html = renderWebsiteNavigationContent(model as any, actions as any);
  await page.evaluate((content: string) => {
    const section = document.querySelector('.wo-website-navigation');
    if (!section) throw new Error('navigation section unavailable');
    section.outerHTML = content;
  }, html);
}

async function smokeNavigation(page: any, name: string) {
  await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
  await page.waitForSelector('.wo-website-dashboard');
  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    const actingUserId = String((window as any).currentUser || db.mockWebsites[0].user_id);
    db.mockWebsites.forEach(site => { site.user_id = actingUserId; });
    if (!db.mockWebsites.some(site => site.id === 'ws-2')) db.mockWebsites.push({ ...db.mockWebsites[0], id: 'ws-2', user_id: actingUserId, name: 'Second owned website', domain: 'second.example', subdomain: 'second' });
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as any).navigateTo('website-navigation', undefined, { websiteManagementRoute: { status: 'valid', websiteId: 'ws-1' } }));
  await page.waitForSelector('.wo-website-navigation', { state: 'attached', timeout: 30000 }).catch(async error => {
    throw new Error(`${name}: navigation did not render: ${await page.locator('body').innerText().catch(() => '')}\n${error}`);
  });
  await page.waitForSelector('.wo-website-management-switcher', { state: 'attached', timeout: 30000 }).catch(async error => { throw new Error(`${name}: switcher missing body=${await page.locator('body').innerText()} url=${page.url()}\n${error}`); });
  await assertShell(page, `Website Navigation legacy ${name}`, true);
  assert(!(await page.locator('.wo-website-navigation').locator('[style*="purple"], [style*="#8a2be2"]').count()), `${name}: old purple inline styling remains`);

  await page.waitForFunction(() => document.body.innerText.includes('Review conversion'), undefined, { timeout: 10000 });
  await page.getByRole('button', { name: 'Review conversion' }).click();
  await page.waitForSelector('.wo-website-navigation-adoption');
  assert((await page.locator('.wo-website-navigation-adoption').innerText()).includes('Review legacy conversion'), `${name}: legacy review did not open`);
  while (await page.getByRole('button', { name: 'Create editable draft' }).isDisabled()) {
    const remove = page.getByRole('button', { name: 'Remove' }).first();
    assert(await remove.count() === 1, `${name}: unresolved legacy candidate cannot be corrected or removed`);
    await remove.click();
  }
  await page.getByRole('button', { name: 'Create editable draft' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Unpublished changes'));
  await page.getByRole('button', { name: 'Add menu item' }).click();
  await page.waitForSelector('#website-navigation-editor-title');
  const kind = page.locator('#website-navigation-kind');
  for (const target of ['homepage', 'internal', 'external', 'phone', 'email']) { await kind.selectOption(target); assert(await kind.inputValue() === target, `${name}: ${target} unavailable`); }
  await kind.selectOption('phone'); await page.locator('#website-navigation-label').fill('Call us'); await page.locator('#website-navigation-target').fill('+1 555 234 5678'); await page.locator('input[type="checkbox"]').nth(1).check(); await page.getByRole('button', { name: 'Add item' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Call us'));
  await page.getByRole('button', { name: 'Edit' }).click(); await page.waitForSelector('#website-navigation-editor-title'); await page.locator('#website-navigation-label').fill('Call today'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => document.body.innerText.includes('Call today'));
  await page.getByRole('button', { name: 'Discard unpublished changes' }).click(); await page.waitForFunction(() => document.body.innerText.includes('Legacy navigation'));

  for (const authority of ['legacy', 'live', 'draft', 'empty', 'conflict'] as const) {
    await renderFixture(page, authority);
    const region = page.locator('.wo-website-navigation');
    assert(await region.count() === 1, `${name}: ${authority} region missing`);
    const text = await region.innerText();
    if (authority === 'live') assert(text.includes('Live') && text.includes('Home'), `${name}: live state missing`);
    if (authority === 'draft') assert(text.includes('Unpublished changes') && text.includes('Discard unpublished changes'), `${name}: draft state missing`);
    if (authority === 'empty') assert(text.includes('No menu items yet'), `${name}: empty state missing`);
    if (authority === 'legacy') assert(text.includes('Legacy navigation') && text.includes('Review conversion'), `${name}: legacy state missing`);
    if (authority === 'conflict') assert(text.includes('Navigation conflict') && text.includes('Reload latest navigation'), `${name}: conflict state missing`);
    assert(await page.locator('.wo-website-navigation .wo-button').count() > 0, `${name}: ${authority} controls missing`);
    await page.screenshot({ path: `${output}/navigation-${authority}-${name}.png` });
  }
}

async function smokeRegressions(page: any, name: string) {
  await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`); await page.waitForSelector('.wo-website-dashboard'); await assertShell(page, `Website Dashboard ${name}`);
  await page.evaluate(() => (window as any).openWebsiteManagementView('funnels')); await page.waitForSelector('.wo-site-pages'); await assertShell(page, `Site Pages ${name}`);
  await page.goto(`${base}/#/reports`); await page.waitForSelector('.wo-reports'); await assertShell(page, `Reports ${name}`);
  await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`); await page.waitForSelector('.pb-canvas-area');
  const builder = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
  assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `Builder ${name}: ${JSON.stringify(builder)}`);
}

async function run() {
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' }, stdio: 'ignore' });
  try {
    await waitForVite(); const browser = await chromium.launch({ channel: 'chrome' });
    try {
      for (const [name, width, height] of viewports) {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        await smokeNavigation(page, name); await smokeRegressions(page, name); await page.close();
      }
    } finally { await browser.close(); }
    console.log('Task 7C.6C.1 visual smoke PASS');
  } finally { vite.kill(); }
}

run().catch(error => { console.error(error); process.exit(1); });
