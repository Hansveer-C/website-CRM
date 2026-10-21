import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

test.skip(process.env.WASHOPS_LOCAL_AUTH_QA !== 'true', 'Requires an explicitly guarded disposable local Supabase stack and local TLS proxy.');
const status = process.env.WASHOPS_LOCAL_QA_STATUS ? JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS) : {};
const run = randomUUID(), password = `Synthetic-${randomUUID()}-9a!`;
const emails = [`location-ui-a-${run}@example.test`, `location-ui-b-${run}@example.test`];
const users: string[] = [], contacts = [`qa-a1-${run}`, `qa-a2-${run}`, `qa-b1-${run}`];
const properties = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const sent = randomUUID(), legacy = randomUUID(), unassigned = randomUUID(), refreshQuote = randomUUID();
let db: Client, token: string;
async function localRequest(path: string, body: unknown, key = status.SERVICE_ROLE_KEY, bearer = key) {
  if (status.API_URL !== 'http://127.0.0.1:56421') throw new Error('Refusing non-fixture API');
  const response = await fetch(`${status.API_URL}${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Local fixture request failed: ${path.split('?')[0]} (${response.status})`);
  return response.json();
}
async function rpc(name: string, body: unknown) { return localRequest(`/rest/v1/rpc/${name}`, body, status.ANON_KEY, token); }
async function openQuote(page: Page, id: string) {
  await page.goto('/#/quotes');
  await page.locator(`tr[data-quote-id="${id}"]`).getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('#quote-service-location-root [aria-busy="false"]')).toBeVisible();
}
test.beforeAll(async () => {
  if (process.env.WASHOPS_LOCAL_AUTH_QA !== 'true') return;
  const dbUrl = new URL(status.DB_URL);
  if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '56422') throw new Error('Refusing non-fixture database');
  db = new Client({ connectionString: status.DB_URL }); await db.connect();
  for (const email of emails) { const user = await localRequest('/auth/v1/admin/users', { email, password, email_confirm: true }); users.push(user.id); }
  token = (await localRequest('/auth/v1/token?grant_type=password', { email: emails[0], password }, status.ANON_KEY)).access_token;
  await db.query('insert into public.contacts(id,user_id,name,status,address) values($1,$2,$3,$4,$5),($6,$2,$7,$4,$5),($8,$9,$10,$4,$5)', [contacts[0], users[0], 'QA Customer A', 'customer', 'Billing only address', contacts[1], 'QA Customer A2', contacts[2], users[1], 'FOREIGN BUSINESS CUSTOMER']);
  for (let i = 0; i < properties.length; i++) {
    const contact = i < 2 ? contacts[0] : i === 2 ? contacts[1] : contacts[2];
    await db.query('insert into public.properties(id,user_id,contact_id,label,service_address_line1,locality,country_code,request_key,request_fingerprint) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [properties[i], i === 3 ? users[1] : users[0], contact, ['Original driveway', 'Second service location', 'Other customer location', 'FOREIGN BUSINESS LOCATION'][i], `${10 + i} Synthetic Service Lane`, 'Fixture Town', 'CA', randomUUID(), {}]);
  }
  for (const id of [sent, legacy, unassigned, refreshQuote]) {
    await db.query('insert into public.quotes(id,user_id,contact_id,status,total_amount,selected_tier,request_key,request_fingerprint,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, users[0], contacts[0], 'sent', 25, 'basic', randomUUID(), {}, `Authenticated local fixture ${run}`]);
    await db.query('insert into public.quote_items(user_id,quote_id,service_name,quantity,unit_price,tier,order_index) values($1,$2,$3,1,25,$4,0)', [users[0], id, 'Synthetic driveway clean', 'basic']);
  }
  for (const id of [legacy, unassigned]) await rpc('accept_crm_quote', { p_quote_id: id, p_quote_revision: 1, p_request_key: randomUUID(), p_signer_name: 'Synthetic Local Signer', p_signature_data_url: null, p_accessible_declaration: true });
  // Explicit legacy fixture shape; genuine pre-migration acceptance preservation has its own SQL replay test.
  await db.query("update public.quote_acceptances set quote_snapshot=quote_snapshot - 'service_location' - 'service_location_status' where quote_id=$1 and user_id=$2", [legacy, users[0]]);
});
test.afterAll(async () => {
  if (!db) return;
  try {
    if (users.length) {
      await db.query('delete from public.invoice_items where user_id=any($1::text[])', [users]);
      await db.query('delete from public.invoices where user_id=any($1::text[])', [users]);
      await db.query('delete from public.quotes where user_id=any($1::text[])', [users]);
      await db.query('delete from public.contacts where user_id=any($1::text[])', [users]);
      await db.query('delete from public.users where id=any($1::text[])', [users]);
      for (const id of users) {
        const response = await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` } });
        if (!response.ok) throw new Error('Local Auth fixture cleanup failed');
      }
    }
  } finally { await db.end(); }
});
test('real local login → customer/estimate → service location → acceptance → frozen evidence', async ({ page }) => {
  page.setDefaultTimeout(10000);
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['4218', '56429'].includes(url.port) || /\/api\/(sms|calls|payments|emails)/.test(url.pathname)) return route.abort();
    return route.continue();
  });
  await page.goto('/#/quotes');
  await expect(page.getByRole('heading', { name: 'Sign in to your CRM' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(emails[0]); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-editor-runtime', 'supabase');
  await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  console.log('PASS: real local login and authenticated quote hydration.');
  await page.getByRole('navigation', { name: 'Primary Navigation' }).locator('[data-nav-view="clients"]').click();
  await expect(page.getByRole('link', { name: 'Open QA Customer A', exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: 'Open FOREIGN BUSINESS CUSTOMER', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Quotes', exact: true }).click(); await page.getByRole('button', { name: 'New quote', exact: true }).click();
  const customer = page.getByLabel('Select contact'); await customer.selectOption(contacts[1]);
  await expect(customer.locator('option')).not.toContainText(['FOREIGN BUSINESS CUSTOMER']);
  await customer.selectOption(contacts[0]);
  await page.locator('.wo-quote-tier-composer').first().getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('basic service name').fill('UI-created local service'); await page.getByRole('spinbutton').nth(1).fill('25');
  await page.getByLabel('Internal notes or terms').fill(`UI-created-${run}`); await page.getByRole('button', { name: 'Create quote', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  const created = (await db.query('select id,revision from public.quotes where user_id=$1 and notes=$2', [users[0], `UI-created-${run}`])).rows[0]; expect(created?.revision).toBe(1);
  await openQuote(page, created.id); const selector = page.getByLabel('Customer service location');
  await expect(selector.locator('option')).toHaveCount(3); await expect(selector).not.toContainText('Other customer location'); await expect(selector).not.toContainText('FOREIGN BUSINESS LOCATION');
  await selector.selectOption(properties[0]); await page.getByRole('button', { name: 'Cancel selection' }).click(); await expect(selector).toHaveValue('');
  await selector.selectOption(properties[0]); await page.getByRole('button', { name: 'Save service location', exact: true }).click(); await expect(selector).toHaveValue(properties[0]); await expect(page.getByRole('button', { name: 'Save service location', exact: true })).toBeDisabled();
  expect((await db.query('select property_id,revision from public.quotes where id=$1', [created.id])).rows[0]).toEqual({ property_id: properties[0], revision: 2 });
  console.log('PASS: customer isolation, UI estimate creation and draft location save/cancel.');
  await page.screenshot({ path: test.info().outputPath('authenticated-draft-location.png'), fullPage: true });

  await openQuote(page, refreshQuote);
  await db.query('begin'); await db.query('update public.quote_items set unit_price=100,service_name=$1 where quote_id=$2', ['Newly priced local service', refreshQuote]); await db.query('update public.quotes set total_amount=100,revision=revision+1 where id=$1', [refreshQuote]); await db.query('commit');
  await page.getByRole('button', { name: 'Refresh service location' }).click(); await expect(page.getByText('Newly priced local service', { exact: true })).toBeVisible(); await expect(page.locator('.wo-quote-preview-tiers')).toContainText('$100');

  await openQuote(page, sent); await db.query('update public.quotes set revision=revision+1 where id=$1', [sent]);
  await selector.selectOption(properties[0]); await page.getByRole('button', { name: 'Save service location', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('estimate changed');
  await page.getByRole('button', { name: 'Refresh service location' }).click(); await expect(selector).toBeVisible();
  let loseResponse = true, blockedMatchingRemote = 0; const requestKeys: string[] = [];
  await page.route('**/rest/v1/rpc/set_crm_quote_service_property', async route => {
    if (new URL(route.request().url()).origin !== 'https://127.0.0.1:56429') { blockedMatchingRemote++; return route.abort(); }
    if (route.request().method() !== 'POST') return route.continue();
    requestKeys.push(route.request().postDataJSON().p_request_key);
    if (loseResponse) { loseResponse = false; const response = await route.fetch(); expect(response.status()).toBe(200); return route.abort('failed'); }
    return route.continue();
  });
  expect(await page.evaluate(async () => {
    try { await fetch('https://local-qa-deny.invalid/rest/v1/rpc/set_crm_quote_service_property'); return false; }
    catch { return true; }
  })).toBe(true);
  expect(blockedMatchingRemote).toBe(1); expect(requestKeys).toHaveLength(0);
  await selector.selectOption(properties[0]); await page.getByRole('button', { name: 'Save service location', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('could not be confirmed');
  await page.getByRole('button', { name: 'Retry save' }).click(); await expect(page.getByRole('button', { name: 'Save service location', exact: true })).toBeDisabled(); expect(requestKeys).toHaveLength(2); expect(requestKeys[0]).toBe(requestKeys[1]);
  expect((await db.query('select revision from public.quotes where id=$1', [sent])).rows[0].revision).toBe(3);
  console.log('PASS: real backend stale conflict and committed-response-loss retry without duplicate revision.');
  await page.getByLabel('Signer full name').fill('Synthetic Local Signer'); await page.locator('.wo-quote-accessible-sign-checkbox').check(); await page.locator('.wo-quote-attestation-checkbox').check(); await page.getByRole('button', { name: 'Accept & Sign Quote', exact: true }).click();
  await expect(page.locator('#quote-service-location-root')).toContainText('Service location recorded at acceptance');
  const accepted = (await db.query('select quote_revision,quote_snapshot from public.quote_acceptances where quote_id=$1', [sent])).rows[0]; expect(accepted.quote_revision).toBe(3); expect(accepted.quote_snapshot.service_location.service_address_line1).toBe('10 Synthetic Service Lane');
  await db.query('update public.properties set service_address_line1=$1 where id=$2', ['999 Changed After Acceptance', properties[0]]);
  await openQuote(page, sent); await expect(page.locator('#quote-service-location-root')).toContainText('10 Synthetic Service Lane'); await expect(page.locator('#quote-service-location-root')).not.toContainText('999 Changed'); await expect(selector).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#quote-service-location-root').screenshot({ path: test.info().outputPath('authenticated-accepted-frozen-location.png') }); await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('button', { name: 'Convert to invoice', exact: true })).toHaveCount(0);
  const invoiceKey = randomUUID(); const invoice = await rpc('create_invoice_from_accepted_quote', { p_quote_id: sent, p_accepted_quote_revision: 3, p_request_key: invoiceKey }); expect(Number(invoice.invoice.total_amount)).toBe(25);
  const invoiceRetry = await rpc('create_invoice_from_accepted_quote', { p_quote_id: sent, p_accepted_quote_revision: 3, p_request_key: invoiceKey }); expect(invoiceRetry.replayed).toBe(true);
  await page.goto('/#/invoices'); await page.reload(); await expect(page.locator('body')).toContainText('QA Customer A');
  await openQuote(page, legacy); await expect(page.locator('#quote-service-location-root')).toContainText('older acceptance has no recorded');
  await openQuote(page, unassigned); await expect(page.locator('#quote-service-location-root')).toContainText('No service location was assigned');
  console.log('PASS: real acceptance, frozen address, legacy/unassigned display and invoice RPC/replay. Invoice conversion UI remains unavailable.');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Sign in to your CRM' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(emails[1]); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.goto('/#/quotes'); await expect(page.getByText('No quotes yet', { exact: true })).toBeVisible(); await expect(page.locator(`tr[data-quote-id="${sent}"]`)).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Primary Navigation' }).locator('[data-nav-view="clients"]').click(); await expect(page.getByRole('link', { name: 'Open FOREIGN BUSINESS CUSTOMER', exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: 'Open QA Customer A', exact: true })).toHaveCount(0);
  await page.goto(`/#/quote-preview/${sent}`); await expect(page.getByText('Quote unavailable', { exact: true })).toBeVisible(); await expect(page.getByText('10 Synthetic Service Lane', { exact: false })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  console.log('PASS: sign out/account switch isolation; no browser page errors.');
});
