import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5178;
const baseUrl = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c2';
const sizes = [{ name: '1440x900', width: 1440, height: 900 }, { name: '768x1024', width: 768, height: 1024 }, { name: '390x844', width: 390, height: 844 }];

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function waitForServer() { for (let attempt = 0; attempt < 30; attempt++) { try { if ((await fetch(baseUrl)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); } throw new Error('Vite server did not start'); }

async function assertOrdinary(page: any, mobile: boolean) {
  const checks = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, shellMain: document.querySelectorAll('.wo-shell-main').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth, drawer: document.querySelector('[data-shell-drawer-toggle]') instanceof HTMLElement && !((document.querySelector('[data-shell-drawer-toggle]') as HTMLElement).offsetParent === null) }));
  assert(checks.shell === 1 && checks.shellMain === 1 && checks.main === 1 && checks.sidebar === 0, `shell assertion failed: ${JSON.stringify(checks)}`);
  assert(checks.overflow, `horizontal overflow: ${JSON.stringify(checks)}`);
  assert(checks.drawer === mobile, `drawer visibility mismatch: ${JSON.stringify(checks)}`);
}

async function main() {
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' }, stdio: 'ignore' });
  try {
    await waitForServer(); const browser = await chromium.launch({ channel: 'chrome' });
    try {
      for (const screen of sizes) {
        const page = await browser.newPage({ viewport: { width: screen.width, height: screen.height } });
        await page.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        for (const [name, route, selector] of [['clients', '/#/clients', '.wo-contacts'], ['contact-detail', '/#/contact-detail/c1', '.wo-contact-detail']] as const) {
          await page.goto(`${baseUrl}${route}`); await page.waitForSelector(selector); await assertOrdinary(page, screen.width < 1024); await page.screenshot({ path: `${output}/${name}-${screen.name}.png` });
        }
        for (const [name, route, selector] of [['dashboard', '/#/dashboard', '.wo-dashboard'], ['opportunities', '/#/opportunities', '.kanban-board']] as const) { await page.goto(`${baseUrl}${route}`); await page.waitForSelector(selector); await assertOrdinary(page, screen.width < 1024); }
        await page.goto(`${baseUrl}/#/builder?websiteId=ws-1&pageId=p3&action=edit`); await page.waitForSelector('.pb-canvas-area'); const builder = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth })); assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `builder assertion failed: ${JSON.stringify(builder)}`);
        await page.close();
      }
    } finally { await browser.close(); }
    console.log('Task 7C.2 visual smoke PASS: 6 screenshots; Clients/Contact Detail plus 9 regression route/viewport groups.');
  } finally { server.kill(); }
}
main().catch(error => { console.error(error); process.exit(1); });
