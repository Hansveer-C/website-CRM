import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5193;
const base = `http://127.0.0.1:${port}`;
const output = 'scratch/screenshots/phase1c_task7c6d';
const viewports = [['1440x900', 1440, 900], ['768x1024', 768, 1024], ['390x844', 390, 844]] as const;
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

async function ready() { for (let attempt = 0; attempt < 30; attempt += 1) { try { if ((await fetch(base)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 400)); } throw new Error('Vite unavailable'); }

async function assertShell(page: any, label: string) {
  const state = await page.evaluate(() => ({ shell: document.querySelectorAll('.wo-shell').length, main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, sidebar: document.querySelectorAll('.sidebar').length, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth }));
  assert(state.shell === 1 && state.main === 1 && state.h1 === 1 && state.sidebar === 0 && state.overflow, `${label}: ${JSON.stringify(state)}`);
}

async function installSettingsFixtures(page: any) {
  await page.goto(`${base}/#/dashboard`);
  await page.waitForSelector('.wo-shell');
  await page.evaluate(`(async function () {
    const db = await import('/src/db.ts');
    const user = String(window.currentUser || db.mockWebsites[0].user_id);
    const baseSite = db.mockWebsites[0];
    for (const fixture of [
      ['settings-a', user, 'Website A', 'a.example'],
      ['settings-b', user, 'Website B', 'b.example'],
      ['settings-c', 'foreign-user', 'FOREIGN WEBSITE C', 'foreign.example']
    ]) {
      const existing = db.mockWebsites.find(function (site) { return site.id === fixture[0]; });
      const next = Object.assign({}, baseSite, { id: fixture[0], user_id: fixture[1], name: fixture[2], domain: fixture[3], subdomain: fixture[0], homepage_funnel_id: null });
      if (existing) Object.assign(existing, next); else db.mockWebsites.push(next);
    }
    const settings = {
      'settings-a': { id: 'settings-row-a', user_id: user, website_id: 'settings-a', business_name: 'Business A', phone: '111-111-1111', sms_number: '111-222-3333', email: 'a@example.com', logo_url: '', primary_color: '#111111', facebook_pixel_id: 'pixel-a', gtm_id: 'GTM-A' },
      'settings-b': { id: 'settings-row-b', user_id: user, website_id: 'settings-b', business_name: 'Business B', phone: '222-222-2222', sms_number: '222-333-4444', email: 'b@example.com', logo_url: '', primary_color: '#222222', facebook_pixel_id: 'pixel-b', gtm_id: 'GTM-B' }
    };
    const originalFetch = window.fetch.bind(window);
    let delayedPost = null;
    window.__settingsAudit = {
      calls: [],
      requestedWebsiteId: null,
      delayNextPost: false,
      releasePost: function (success) {
        if (!delayedPost) throw new Error('No delayed Settings POST');
        const data = settings[delayedPost.websiteId];
        delayedPost.resolve(new Response(JSON.stringify(success ? { success: true, data: data } : { success: false, error: 'Audit failure' }), { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }));
        delayedPost = null;
      }
    };
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      window.__settingsAudit.calls.push({ url: url, method: (init && init.method) || 'GET', hash: location.hash });
      if (url === '/api/settings') {
        const websiteId = window.__settingsAudit.requestedWebsiteId || new URLSearchParams(location.hash.split('?')[1] || '').get('websiteId') || '';
        if (((init && init.method) || 'GET').toUpperCase() === 'GET') {
          const row = settings[websiteId];
          if (!row) return new Response(JSON.stringify({ success: false, error: 'Website not found' }), { status: 404 });
          Object.assign(db.mockWebsiteSettings, row, { auto_lead_sms_enabled: false, auto_lead_sms_template: '', missed_call_sms_enabled: false, missed_call_sms_template: '', created_at: '' });
          return new Response(JSON.stringify({ success: true, data: row }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (window.__settingsAudit.delayNextPost) {
          window.__settingsAudit.delayNextPost = false;
          return await new Promise(function (resolve) { delayedPost = { websiteId: websiteId, resolve: resolve }; });
        }
      }
      return originalFetch(input, init);
    };
  })()`);
}

async function openSettings(page: any, websiteId: string) { await page.evaluate((id: string) => { (window as any).__settingsAudit.requestedWebsiteId = id; return (window as any).navigateTo('website-settings', undefined, { websiteSettingsRoute: { status: 'valid', websiteId: id } }); }, websiteId); }

async function assertSettingsValue(page: any, expected: string, rejected: string, label: string) {
  await page.waitForTimeout(750);
  assert(await page.locator('.wo-website-settings').count() === 1, `${label}: Settings failed to resolve at ${page.url()} calls=${JSON.stringify(await page.evaluate(() => (window as any).__settingsAudit?.calls))} — ${await page.locator('body').innerText()}`);
  assert(await page.locator('[data-settings-field="business_name"]').inputValue() === expected, `${label}: expected ${expected}`);
  assert(!(await page.locator('.wo-website-settings').innerText()).includes(rejected), `${label}: stale ${rejected} remained`);
}

async function smokeSettings(page: any, name: string) {
  await installSettingsFixtures(page);
  await openSettings(page, 'settings-a');
  await assertSettingsValue(page, 'Business A', 'Business B', `${name} A`);
  await assertShell(page, `${name} A`);
  assert(await page.locator('#settings-website-select').count() === 1, `${name}: required switcher missing`);
  assert(await page.locator('#settings-website-select').inputValue() === 'settings-a', `${name}: Website A not selected`);
  const structure = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(element => element.id); const inputs = [...document.querySelectorAll('.wo-website-settings input')]; return { roots: document.querySelectorAll('.wo-website-settings').length, saves: document.querySelectorAll('#website-settings-save').length, switchers: document.querySelectorAll('#settings-website-select').length, duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index), fieldsInside: inputs.every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= window.innerWidth; }), labels: inputs.every(input => !!document.querySelector(`label[for="${CSS.escape(input.id)}"]`)), smsHelper: document.getElementById('settings-sms-number-input-helper')?.textContent || '' }; });
  assert(structure.roots === 1 && structure.saves === 1 && structure.switchers === 1, `${name}: duplicate Settings surface`);
  assert(structure.duplicateIds.length === 0 && structure.fieldsInside && structure.labels, `${name}: accessibility/layout ${JSON.stringify(structure)}`);
  assert(structure.smsHelper.includes('public phone number'), `${name}: SMS helper missing`);
  await page.evaluate(() => { (window as any).__settingsAudit.requestedWebsiteId = 'settings-b'; });
  await page.locator('#settings-website-select').selectOption('settings-b');
  await assertSettingsValue(page, 'Business B', 'Business A', `${name} B`);
  assert(await page.locator('#settings-phone-input').inputValue() === '222-222-2222', `${name}: B phone missing`);
  assert((await page.locator('#settings-primary-color-display').innerText()) === '#222222', `${name}: B color missing`);
  await page.evaluate(() => { (window as any).__settingsAudit.requestedWebsiteId = 'settings-a'; });
  await page.locator('#settings-website-select').selectOption('settings-a');
  await assertSettingsValue(page, 'Business A', 'Business B', `${name} A again`);
  assert(await page.locator('.wo-website-settings').count() === 1 && await page.getByRole('button', { name: 'Save Settings' }).count() === 1, `${name}: A/B/A duplicated UI`);
  await page.evaluate(() => { (window as any).__settingsAudit.delayNextPost = true; });
  const staleUpdate = page.evaluate(() => (window as any).updateSettingsField('business_name', 'A pending edit'));
  await page.waitForTimeout(50);
  await openSettings(page, 'settings-b');
  await assertSettingsValue(page, 'Business B', 'A pending edit', `${name} stale update`);
  await page.evaluate(() => (window as any).__settingsAudit.releasePost(true));
  await staleUpdate;
  assert(await page.locator('[data-settings-field="business_name"]').inputValue() === 'Business B', `${name}: stale A response changed B UI`);
  assert(await page.evaluate(async () => (await import('/src/db.ts')).mockWebsiteSettings.business_name) === 'Business B', `${name}: stale A response changed B state`);
  await openSettings(page, 'settings-a');
  await assertSettingsValue(page, 'Business A', 'Business B', `${name} stale save A`);
  await page.evaluate(() => { (window as any).__settingsAudit.delayNextPost = true; });
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await page.waitForTimeout(100);
  assert((await page.locator('#website-settings-save').textContent()) === 'Saving...', `${name}: stale Save did not start`);
  await openSettings(page, 'settings-b');
  await assertSettingsValue(page, 'Business B', 'Business A', `${name} stale save B`);
  await page.evaluate(() => (window as any).__settingsAudit.releasePost(true));
  await page.waitForTimeout(100);
  assert(await page.locator('[data-settings-field="business_name"]').inputValue() === 'Business B', `${name}: stale A Save rerendered B`);
  assert(await page.evaluate(async () => (await import('/src/db.ts')).mockWebsiteSettings.business_name) === 'Business B', `${name}: stale A Save changed B state`);
  await page.screenshot({ path: `${output}/settings-${name}.png`, fullPage: true });
  await page.evaluate(() => { (window as any).__settingsAudit.delayNextPost = true; });
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await page.waitForTimeout(100);
  const saveState = await page.locator('#website-settings-save').evaluate((button: HTMLButtonElement) => ({ text: button.textContent, disabled: button.disabled }));
  assert(saveState.text === 'Saving...' && saveState.disabled, `${name}: Save button did not enter saving state ${JSON.stringify(saveState)}`);
  await page.evaluate(() => (window as any).__settingsAudit.releasePost(false));
  await page.waitForFunction(() => (document.getElementById('website-settings-save') as HTMLButtonElement)?.disabled === false);
  assert(await page.getByRole('button', { name: 'Save Settings' }).count() === 1, `${name}: Save button did not recover`);
  await openSettings(page, 'settings-c');
  await page.waitForSelector('.website-settings-selection');
  assert(await page.locator('.wo-website-settings').count() === 0, `${name}: foreign Website rendered Settings`);
  assert(!(await page.locator('body').innerText()).includes('FOREIGN WEBSITE C'), `${name}: foreign Website leaked`);
}

async function smokeRegressions(page: any) {
  for (const [route, selector] of [['website-dashboard?websiteId=ws-1', '.wo-website-dashboard'], ['funnels?websiteId=ws-1', '.wo-site-pages'], ['website-navigation?websiteId=ws-1', '.wo-website-navigation'], ['website-structure?websiteId=ws-1', '.wo-website-structure'], ['reports', '.wo-reports']] as const) { await page.goto(`${base}/#/${route}`); await page.waitForSelector(selector); await assertShell(page, route); }
  await page.goto(`${base}/#/marketing-funnels`);
  await page.waitForSelector('.wo-shell');
  await page.evaluate(() => (window as any).navigateTo('funnel-detail', 'fnl-2'));
  await page.waitForSelector('#funnel-detail-container');
  assert(await page.locator('.wo-site-page-detail').count() === 0, 'Marketing Detail used the Site Page renderer');
  await page.goto(`${base}/#/builder?websiteId=ws-1&pageId=p3&action=edit`);
  await page.waitForSelector('.pb-canvas-area');
  assert(await page.locator('.wo-shell').count() === 0, 'Builder must remain shell-free');
}

async function run() {
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { env: { ...process.env, VITE_ENABLE_BROWSER_FIXTURES: 'true', VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local', VITE_BUILDER_MEDIA_PERSISTENCE: 'local' }, stdio: 'ignore' });
  try { await ready(); const browser = await chromium.launch({ channel: 'chrome' }); try { for (const [name, width, height] of viewports) { const page = await browser.newPage({ viewport: { width, height } }); await page.addInitScript(() => localStorage.setItem('onboarding_seen', 'true')); await smokeSettings(page, name); await page.close(); const regression = await browser.newPage({ viewport: { width, height } }); await regression.addInitScript(() => localStorage.setItem('onboarding_seen', 'true')); await smokeRegressions(regression); await regression.close(); } } finally { await browser.close(); } console.log('Task 7C.6D independent visual smoke PASS'); } finally { vite.kill(); }
}

run().catch(error => { console.error(error); process.exit(1); });
