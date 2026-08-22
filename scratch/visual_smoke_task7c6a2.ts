import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 5184;
const base = `http://127.0.0.1:${port}`;
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
    await (window as any).switchUser('system');
  });
}

async function run() {
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
        await assertShell(page, `Website Dashboard ready ${name}`);

        await addSecondOwnedWebsite(page);
        await page.goto(`${base}/#/website-dashboard`);
        await page.waitForSelector('.wo-website-dashboard-state--selection');
        await assertShell(page, `Website Dashboard selection ${name}`);
        assert(await page.locator('#dashboard-website-select').isVisible(), `${name}: selection control missing`);
        assert((await page.locator('.wo-website-dashboard-state--selection').innerText()).includes('Choose a website'), `${name}: selection copy missing`);

        await page.evaluate(() => (window as any).selectDashboardWebsite('ws-1'));
        await page.waitForSelector('.wo-website-dashboard');
        await page.evaluate(() => (window as any).openWebsiteManagementView('funnels'));
        await page.waitForSelector('.wo-website-management-switcher');
        await assertShell(page, `Site Pages switcher ${name}`);
        assert(await page.locator('#management-website-select').isVisible(), `${name}: management switcher missing`);
        assert(await page.locator('#management-website-select').inputValue() === 'ws-1', `${name}: active website not selected`);

        await page.goto(`${base}/#/reports`);
        await page.waitForSelector('.wo-reports');
        await assertShell(page, `Reports ${name}`);

        await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`);
        await page.waitForSelector('.pb-canvas-area');
        const builder = await page.evaluate(() => ({
          shell: document.querySelectorAll('.wo-shell').length,
          main: document.querySelectorAll('main').length,
          sidebar: document.querySelectorAll('.sidebar').length,
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth
        }));
        assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `Builder ${name}: ${JSON.stringify(builder)}`);
        await page.close();
      }

      const emptyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await emptyPage.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
      await emptyPage.goto(`${base}/#/website-dashboard`);
      await emptyPage.evaluate(async () => {
        const db = await import('/src/db.ts');
        db.mockWebsites.splice(0);
        await (window as any).switchUser('system');
      });
      await emptyPage.waitForSelector('.wo-website-dashboard-state--empty');
      await assertShell(emptyPage, 'Website Dashboard empty');
      const emptyText = await emptyPage.locator('.wo-website-dashboard-state--empty').innerText();
      assert(emptyText.includes('Create your first website.') && emptyText.includes('Create your website') && emptyText.includes('Retry'), 'Empty state actions missing');
      await emptyPage.close();
    } finally {
      await browser.close();
    }
    console.log('Task 7C.6A.2 visual smoke PASS');
  } finally {
    vite.kill();
  }
}

run().catch(error => { console.error(error); process.exit(1); });
