import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

test.skip(process.env.WASHOPS_ONBOARDING_LOCAL_QA !== 'true', 'Disposable local Auth stack only.');
const status = process.env.WASHOPS_LOCAL_QA_STATUS ? JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS) : {};
const password = `Synthetic-${randomUUID()}-9a!`;
const emails = [0, 1].map(i => `onboarding-later-${i}-${randomUUID()}@example.test`);
const users: string[] = [];
let db: Client;
test.beforeAll(async () => {
  if (process.env.WASHOPS_ONBOARDING_LOCAL_QA !== 'true') return;
  const url = new URL(status.DB_URL);
  if (status.API_URL !== 'http://127.0.0.1:56421' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || url.hostname !== '127.0.0.1' || url.port !== '56422' || url.username !== 'postgres'
      || url.pathname !== '/postgres' || url.search || url.hash) throw new Error('Non-local QA denied');
  db = new Client({ connectionString: status.DB_URL }); await db.connect();
  for (const email of emails) {
    const r = await fetch(`${status.API_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({email,password,email_confirm:true}) });
    if (!r.ok) throw new Error('Local Auth fixture creation failed'); users.push((await r.json()).id);
  }
});
test.afterAll(async () => {
  if (!db) return;
  try {
    await db.query('delete from public.users where id=any($1::text[])', [users]);
    for (const id of users) {
      const r = await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` } });
      if (!r.ok) throw new Error('Local Auth fixture cleanup failed');
    }
  } finally { await db.end(); }
});
async function login(page: Page, i: number) {
  await page.goto('/#/dashboard'); await page.getByLabel('Email', {exact:true}).fill(emails[i]);
  await page.getByLabel('Password', {exact:true}).fill(password); await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button', {name:'Set up website later',exact:true})).toBeVisible();
}
test('fresh owner can defer website setup and use CRM without generation or consent', async ({page}) => {
  let generationRequests = 0; const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (!['http://127.0.0.1:4218','https://127.0.0.1:56429'].includes(u.origin)) return route.abort();
    if (/\/api\/websites\/generate|\/rpc\/create_initial_website/.test(u.pathname)) { generationRequests++; return route.abort(); }
    return route.continue();
  });
  await login(page, 0);
  await page.setViewportSize({width:390,height:844});
  const later = page.getByRole('button', {name:'Set up website later',exact:true});
  await later.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', {name:"Let's build your site"})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('onboarding_seen'))).toBeNull();
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('link', {name:'Clients & Leads',exact:true}).click(); await expect(page).toHaveURL(/#\/clients/);
  await page.getByRole('link', {name:'Quotes',exact:true}).click(); await expect(page.getByRole('heading', {name:'Quotes',exact:true})).toBeVisible();
  await page.goto('/#/dashboard'); await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', {name:'Sign out',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog', {name:"Let's build your site"})).toHaveCount(0);
  await page.goto('/#/website-dashboard'); await page.getByRole('button', {name:'Create your website',exact:true}).click();
  await expect(later).toBeVisible(); await later.click();
  await page.getByRole('button', {name:'Sign out',exact:true}).click(); await login(page,1);
  await later.click(); expect(generationRequests).toBe(0); expect(errors).toEqual([]);
  expect((await db.query('select count(*)::int as n from public.websites where user_id=any($1::text[])',[users])).rows[0].n).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('onboarding_seen'))).toBeNull();
});
