import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5185;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c6b1';
const viewports = [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const;
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function waitForVite() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Vite unavailable');
}

async function assertShell(page: any, label: string) {
  const state = await page.evaluate(() => ({
    shell: document.querySelectorAll('.wo-shell').length,
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    sidebar: document.querySelectorAll('.sidebar').length,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth
  }));
  assert(state.shell === 1 && state.main === 1 && state.h1 === 1 && state.sidebar === 0 && state.overflow, `${label}: ${JSON.stringify(state)}`);
}

async function addSecondOwnedWebsite(page: any) {
  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    if (!db.mockWebsites.some(site => site.id === 'ws-2')) {
      db.mockWebsites.push({ ...db.mockWebsites[0], id: 'ws-2', name: 'Second owned website', domain: 'second.example', subdomain: 'second' });
    }
    if (!db.mockFunnels.some(funnel => funnel.id === 'fnl-site-pages-fixture')) {
      db.mockFunnels.push({ ...db.mockFunnels[0], id: 'fnl-site-pages-fixture', user_id: 'system', name: 'Services Page', status: 'draft' });
      db.mockWebsiteRoutes.push({ id: 'route-site-pages-fixture', website_id: 'ws-1', funnel_id: 'fnl-site-pages-fixture', path: '/services', created_at: '' });
    }
  });
}

async function run() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' },
    stdio: 'ignore'
  });
  try {
    await waitForVite();
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      for (const [name, width, height] of viewports) {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
        await page.waitForSelector('.wo-website-dashboard');
        await addSecondOwnedWebsite(page);
        await page.evaluate(() => (window as any).openWebsiteManagementView('funnels'));
        await page.waitForSelector('.wo-site-pages');
        await assertShell(page, `Site Pages ${name}`);
        assert(await page.locator('.wo-website-management-switcher').isVisible(), `${name}: switcher missing`);
        assert(await page.locator('#management-website-select').inputValue() === 'ws-1', `${name}: active website not selected`);
        const pages = page.locator('.wo-site-pages');
        const text = await pages.innerText();
        const normalizedText = text.toLowerCase();
        const expectedVisibleContent = width < 640
          ? normalizedText.includes('home page') && normalizedText.includes('/services') && normalizedText.includes('published') && normalizedText.includes('manage')
          : normalizedText.includes('page name') && normalizedText.includes('web address') && normalizedText.includes('status') && normalizedText.includes('manage');
        assert(expectedVisibleContent, `${name}: Site Pages columns/actions missing; ${text}`);
        assert(await page.locator('.wo-site-pages-row').count() > 1, `${name}: expected homepage and non-homepage rows`);
        const homepage = page.locator('.wo-site-pages-row').filter({ hasText: '/' }).first();
        assert(!(await homepage.getByRole('button', { name: 'Delete' }).count()), `${name}: homepage has Delete`);
        assert((await page.getByRole('button', { name: 'Delete' }).count()) > 0, `${name}: non-homepage Delete missing`);
        await page.screenshot({ path: `${output}/site-pages-${name}.png` });

        await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
        await page.waitForSelector('.wo-website-dashboard');
        await assertShell(page, `Website Dashboard ${name}`);
        await page.goto(`${base}/#/reports`);
        await page.waitForSelector('.wo-reports');
        await assertShell(page, `Reports ${name}`);
        await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`);
        await page.waitForSelector('.pb-canvas-area');
        const builder = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
        assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `Builder ${name}: ${JSON.stringify(builder)}`);
        await page.close();
      }

      const emptyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await emptyPage.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
      await emptyPage.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
      await emptyPage.waitForSelector('.wo-website-dashboard');
      await emptyPage.evaluate(async () => { const db = await import('/src/db.ts'); db.mockWebsiteRoutes.splice(0); (window as any).openWebsiteManagementView('funnels'); });
      await emptyPage.waitForSelector('.wo-site-pages');
      await assertShell(emptyPage, 'Site Pages empty');
      const emptyText = await emptyPage.locator('.wo-site-pages').innerText();
      assert(emptyText.includes('No Site Pages yet') && emptyText.includes('No Site Pages exist for this website yet.'), 'Empty Site Pages state missing');
      assert((await emptyPage.getByRole('button', { name: '+ New Website Page' }).count()) === 1, 'New Website Page header action missing');
      await emptyPage.close();
    } finally {
      await browser.close();
    }
    console.log('Task 7C.6B.1 visual smoke PASS');
  } finally {
    vite.kill();
  }
}

run().catch(error => { console.error(error); process.exit(1); });
