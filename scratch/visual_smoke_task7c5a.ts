import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5181;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c5a';
const viewports = [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const;
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function waitForVite() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Vite unavailable');
}

async function assertOrdinaryShell(page: any, mobile: boolean, label: string) {
  const state = await page.evaluate(() => {
    const drawer = document.querySelector<HTMLElement>('[data-shell-drawer-toggle]');
    const width = document.documentElement.clientWidth;
    return {
      shell: document.querySelectorAll('.wo-shell').length,
      shellMain: document.querySelectorAll('.wo-shell-main').length,
      main: document.querySelectorAll('main').length,
      sidebar: document.querySelectorAll('.sidebar').length,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= width,
      drawerVisible: drawer ? getComputedStyle(drawer).display !== 'none' : false
    };
  });
  assert(state.shell === 1 && state.shellMain === 1 && state.main === 1 && state.sidebar === 0 && state.overflow && state.drawerVisible === mobile, `${label}: ${JSON.stringify(state)}`);
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
        await page.goto(`${base}/#/invoices`);
        await page.waitForSelector('.wo-invoices');
        await assertOrdinaryShell(page, width < 1024, `Invoices ${name}`);
        await page.screenshot({ path: `${output}/invoices-${name}.png` });
        for (const [route, selector] of [['/#/dashboard', '.wo-dashboard'], ['/#/clients', '.wo-contacts'], ['/#/opportunities', '.wo-opportunities'], ['/#/quotes', '.wo-quotes']] as const) {
          await page.goto(`${base}${route}`);
          await page.waitForSelector(selector);
          await assertOrdinaryShell(page, width < 1024, `${route} ${name}`);
        }
        await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`);
        await page.waitForSelector('.pb-canvas-area');
        const builder = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
        assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `Builder ${name}: ${JSON.stringify(builder)}`);
        await page.close();
      }
    } finally { await browser.close(); }
    console.log('Task 7C.5A visual smoke PASS');
  } finally { vite.kill(); }
}

run().catch(error => { console.error(error); process.exit(1); });
