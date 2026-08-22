import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5186;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c6b2';
const viewports = [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const;
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function waitForVite() { for (let attempt = 0; attempt < 30; attempt += 1) { try { if ((await fetch(base)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); } throw new Error('Vite unavailable'); }
async function shell(page: any, label: string) {
  const state = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
  assert(state.shell === 1 && state.main === 1 && state.h1 === 1 && state.sidebar === 0 && state.overflow, `${label}: ${JSON.stringify(state)}`);
}
async function openDetail(page: any) {
  await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`);
  await page.waitForSelector('.wo-website-dashboard');
  await page.evaluate(() => (window as any).openWebsiteManagementView('funnels'));
  await page.waitForSelector('.wo-site-pages');
  await installDetailApiFixture(page);
  await page.getByRole('button', { name: 'Manage' }).first().click();
  await page.waitForSelector('.wo-site-page-detail');
}
async function installDetailApiFixture(page: any) {
  const now = new Date();
  await page.route('**/api/funnels/fnl-1', (route: any) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'fnl-1', user_id: 'system', name: 'Home Page', status: 'published', steps: [{ id: 'step-hero', step_type: 'service', name: 'Service Overview', slug: 'services' }] } }) }));
  await page.route('**/api/opportunities', (route: any) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 'owned', user_id: 'system', funnel_id: 'fnl-1', contact_id: 'c1', created_at: now.toISOString() }, { id: 'foreign', user_id: 'other', funnel_id: 'fnl-1', contact_id: 'c1', created_at: now.toISOString() }] }) }));
  await page.route('**/api/events/logs', (route: any) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 'lead', user_id: 'system', event_name: 'lead_captured', funnel_id: 'fnl-1', contact_id: 'c1', payload: { name: 'Owned lead', funnel_id: 'fnl-1', contact_id: 'c1' }, created_at: new Date(now.getTime() - 30000).toISOString() }, { id: 'sms', user_id: 'system', event_name: 'auto_sms_sent', contact_id: 'c1', payload: { contact_id: 'c1' }, created_at: now.toISOString() }, { id: 'foreign', user_id: 'other', event_name: 'foreign_event', funnel_id: 'fnl-1', contact_id: 'c1', payload: { name: 'FOREIGN EVENT MUST NOT RENDER' }, created_at: new Date(now.getTime() + 1000).toISOString() }] }) }));
}
async function run() {
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' }, stdio: 'ignore' });
  try {
    await waitForVite(); const browser = await chromium.launch({ channel: 'chrome' });
    try {
      for (const [name, width, height] of viewports) {
        const page = await browser.newPage({ viewport: { width, height } }); await page.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
        await openDetail(page); await shell(page, `Site Page Detail ${name}`);
        const detail = page.locator('.wo-site-page-detail'); const text = await detail.innerText();
        for (const value of ['connected to website', 'total leads', 'leads today', 'leads this week', 'avg. response time', 'page sections', 'recent activity', 'edit section']) assert(text.toLowerCase().includes(value), `${name}: missing ${value}; ${text}`);
        assert(await page.getByRole('button', { name: 'Back to Site Pages' }).isVisible(), `${name}: Back action missing`);
        assert((await page.locator('.wo-site-page-detail-step').count()) > 0, `${name}: missing section`);
        assert(await page.getByRole('button', { name: 'Manage Connection' }).isVisible(), `${name}: connection action missing`);
        await page.screenshot({ path: `${output}/site-page-detail-${name}.png` });
        await page.goto(`${base}/#/website-dashboard?websiteId=ws-1`); await page.waitForSelector('.wo-website-dashboard'); await shell(page, `Website Dashboard ${name}`);
        await page.evaluate(() => (window as any).openWebsiteManagementView('funnels')); await page.waitForSelector('.wo-site-pages'); await shell(page, `Site Pages ${name}`);
        await page.goto(`${base}/#/reports`); await page.waitForSelector('.wo-reports'); await shell(page, `Reports ${name}`);
        await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`); await page.waitForSelector('.pb-canvas-area');
        const builder = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
        assert(builder.shell === 0 && builder.main === 1 && builder.sidebar === 0 && builder.overflow, `Builder ${name}: ${JSON.stringify(builder)}`); await page.close();
      }
      const marketing = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await marketing.addInitScript(() => localStorage.setItem('onboarding_seen', 'true'));
      await marketing.goto(`${base}/#/marketing-funnels`); await marketing.waitForSelector('.wo-shell'); await marketing.evaluate(() => (window as any).navigateTo('funnel-detail', 'fnl-2'));
      await marketing.waitForSelector('#funnel-detail-container'); assert((await marketing.locator('.wo-site-page-detail').count()) === 0, 'Marketing Detail used Site Page renderer'); await marketing.close();
    } finally { await browser.close(); }
    console.log('Task 7C.6B.2 visual smoke PASS');
  } finally { vite.kill(); }
}
run().catch(error => { console.error(error); process.exit(1); });
