import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5192;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c6c2';
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function ready() {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error('Vite unavailable');
}

async function shell(page: any, label: string) {
  const state = await page.evaluate(() => ({
    shell: document.querySelectorAll('.wo-shell').length,
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    legacy: document.querySelectorAll('.sidebar').length,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth
  }));
  assert(state.shell === 1 && state.main === 1 && state.h1 === 1 && state.legacy === 0 && state.overflow, `${label}: ${JSON.stringify(state)}`);
}

async function selectWebsite(page: any, websiteId: string) {
  await page.evaluate((id: string) => (window as any).navigateTo('website-structure', undefined, { websiteManagementRoute: { status: 'valid', websiteId: id } }), websiteId);
  await page.waitForSelector('.wo-website-structure');
}

async function destinationIds(page: any) {
  return page.locator('#route-funnel-id option').evaluateAll((options: HTMLOptionElement[]) => options.map(option => option.value));
}

async function structure(page: any, name: string) {
  await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
  await page.waitForSelector('.wo-website-dashboard');
  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    const user = String((window as any).currentUser || db.mockWebsites[0].user_id);
    const original = db.mockWebsites.find(website => website.id === 'ws-1')!;
    original.user_id = user;
    original.homepage_funnel_id = null;
    db.mockWebsiteRoutes.splice(0, db.mockWebsiteRoutes.length);
    db.mockFunnels.splice(0, db.mockFunnels.length,
      { id: 'funnel-a', user_id: user, website_id: 'ws-1', name: 'Unrouted Site A page', status: 'draft', created_at: '', updated_at: '' },
      { id: 'funnel-b', user_id: user, website_id: 'ws-2', name: 'Site B only page', status: 'draft', created_at: '', updated_at: '' },
      { id: 'standalone', user_id: user, website_id: null, name: 'Standalone Funnel', status: 'draft', created_at: '', updated_at: '' },
      { id: 'foreign', user_id: 'foreign-user', website_id: 'ws-1', name: 'FOREIGN FUNNEL MUST NOT RENDER', status: 'draft', created_at: '', updated_at: '' }
    );
    const existingB = db.mockWebsites.find(website => website.id === 'ws-2');
    if (existingB) Object.assign(existingB, { user_id: user, name: 'Site B', domain: 'b.example', homepage_funnel_id: null });
    else db.mockWebsites.push({ ...original, id: 'ws-2', user_id: user, name: 'Site B', domain: 'b.example', homepage_funnel_id: null });
  });

  await selectWebsite(page, 'ws-1');
  await shell(page, `${name} Site A`);
  assert(await page.locator('.wo-website-structure-list').count() === 0, `${name}: Site A must begin with zero routes`);
  await page.locator('#website-structure-add-route').click();
  assert((await destinationIds(page)).join(',') === 'funnel-a', `${name}: Site A destination isolation failed`);
  assert(await page.locator('#route-modal').count() === 1, `${name}: expected one route modal`);
  await page.locator('#route-path').fill('first-route');
  await page.locator('#route-funnel-id').selectOption('funnel-a');
  await page.getByRole('button', { name: 'Create route' }).click();
  await page.waitForSelector('.wo-website-structure-list');
  assert((await page.locator('.wo-website-structure').innerText()).includes('/first-route'), `${name}: first route creation failed`);

  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    db.mockWebsiteRoutes.push({ id: 'root-route', website_id: 'ws-1', path: '/', funnel_id: 'funnel-a', created_at: '' });
    (window as any).confirm = () => true;
    (window as any).deleteRoute('root-route');
  });
  assert(await page.evaluate(async () => (await import('/src/db.ts')).mockWebsiteRoutes.some(route => route.id === 'root-route')), `${name}: root direct deletion was not rejected`);
  await page.evaluate(async () => (window as any).deleteRoute((await import('/src/db.ts')).mockWebsiteRoutes.find(route => route.path === '/first-route')?.id));
  assert(!await page.evaluate(async () => (await import('/src/db.ts')).mockWebsiteRoutes.some(route => route.path === '/first-route')), `${name}: non-root local deletion failed`);

  await page.locator('#website-structure-add-route').click();
  await page.keyboard.press('Escape');
  assert(await page.locator('#route-modal').count() === 0, `${name}: Escape did not close route modal`);
  assert(await page.evaluate(() => document.activeElement?.id === 'website-structure-add-route'), `${name}: modal focus did not return to Add route`);

  await selectWebsite(page, 'ws-2');
  await page.locator('#website-structure-add-route').click();
  assert((await destinationIds(page)).join(',') === 'funnel-b', `${name}: Site B destinations retained stale Site A data`);
  await page.screenshot({ path: `${output}/structure-${name}-modal.png` });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${output}/structure-${name}.png` });
}

async function regressions(page: any) {
  for (const [route, selector] of [
    ['website-dashboard?websiteId=ws-1', '.wo-website-dashboard'],
    ['funnels?websiteId=ws-1', '.wo-site-pages'],
    ['website-navigation?websiteId=ws-1', '.wo-website-navigation'],
    ['reports', '.wo-reports']
  ] as const) {
    await page.goto(`${base}/#/${route}`);
    await page.waitForSelector(selector);
    await shell(page, route);
  }
  await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`);
  await page.waitForSelector('.pb-canvas-area');
  assert(await page.locator('.wo-shell').count() === 0, 'Builder must remain shell-free');
}

async function run() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' },
    stdio: 'ignore'
  });
  try {
    await ready();
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      for (const [name, width, height] of [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const) {
        const structurePage = await browser.newPage({ viewport: { width, height } });
        await structurePage.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        await structure(structurePage, name);
        await structurePage.close();

        const regressionPage = await browser.newPage({ viewport: { width, height } });
        await regressionPage.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        await regressions(regressionPage);
        await regressionPage.close();
      }
    } finally { await browser.close(); }
    console.log('Task 7C.6C.2 visual smoke PASS');
  } finally { vite.kill(); }
}

run().catch(error => { console.error(error); process.exit(1); });
