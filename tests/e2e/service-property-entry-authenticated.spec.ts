import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { assertLocalPropertyQaStatus } from '../fixtures/service_property_local_guard';

test.skip(process.env.WASHOPS_PROPERTY_ENTRY_QA !== 'true', 'Explicit disposable local Auth/property entry QA required.');
const status = process.env.WASHOPS_LOCAL_QA_STATUS ? JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS) : {};
const run = randomUUID(), password = `Synthetic-${randomUUID()}-9a!`;
const emails = [`property-entry-a-${run}@example.test`, `property-entry-b-${run}@example.test`];
const users: string[] = [], contacts = [`entry-a1-${run}`, `entry-a2-${run}`, `entry-b-${run}`];
let db: Client;
async function auth(path: string, body: unknown, key = status.SERVICE_ROLE_KEY) {
  if (status.API_URL !== 'http://127.0.0.1:56421') throw new Error('Non-local API denied');
  const r = await fetch(`${status.API_URL}${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Local fixture Auth failed (${r.status})`); return r.json();
}
test.beforeAll(async () => {
  if (process.env.WASHOPS_PROPERTY_ENTRY_QA !== 'true') return;
  assertLocalPropertyQaStatus(status);
  db = new Client({ connectionString: status.DB_URL }); await db.connect();
  for (const email of emails) users.push((await auth('/auth/v1/admin/users', { email, password, email_confirm: true })).id);
  // Fresh Auth accounts with only customer prerequisites. No property, quote or acceptance is seeded.
  await db.query('insert into public.contacts(id,user_id,name,status) values($1,$2,$3,$4),($5,$2,$6,$4),($7,$8,$9,$4)', [contacts[0],users[0],'Entry Customer A','customer',contacts[1],'Entry Customer A2',contacts[2],users[1],'Other Business Customer']);
  expect((await db.query('select count(*)::int as n from public.properties where user_id=any($1::text[])',[users])).rows[0].n).toBe(0);
});
test.afterAll(async () => {
  if (!db) return;
  try {
    await db.query('delete from public.quotes where user_id=any($1::text[])',[users]);
    await db.query('delete from public.properties where user_id=any($1::text[])',[users]);
    await db.query('delete from public.contacts where user_id=any($1::text[])',[users]);
    await db.query('delete from public.users where id=any($1::text[])',[users]);
    for (const id of users) { const r=await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}}); if(!r.ok)throw new Error('Local Auth cleanup failed'); }
  } finally { await db.end(); }
});
async function login(page: Page, index: number) {
  await page.goto('/#/quotes'); await page.getByLabel('Email',{exact:true}).fill(emails[index]); await page.getByLabel('Password',{exact:true}).fill(password); await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  // Exercise the released non-publishing onboarding dismissal and ordinary CRM navigation.
  await page.goto('/#/dashboard'); await page.waitForLoadState('networkidle');
  const later = page.getByRole('button',{name:'Set up website later',exact:true});
  if (await later.isVisible()) await later.click();
  await page.getByRole('link',{name:'Quotes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();
}
async function newQuote(page: Page, contact: string, note: string) {
  await page.goto('/#/quotes'); await page.getByRole('button',{name:'New quote',exact:true}).click(); await page.getByLabel('Select contact').selectOption(contact);
  await page.locator('.wo-quote-tier-composer').first().getByRole('button',{name:'Add item'}).click(); await page.getByLabel('basic service name').fill('Synthetic washing work'); await page.getByRole('spinbutton').nth(1).fill('25');
  await page.getByLabel('Internal notes or terms').fill(note); await page.getByRole('button',{name:'Create quote',exact:true}).click(); await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();
  return (await db.query('select id from public.quotes where user_id=$1 and notes=$2',[users[0],note])).rows[0].id as string;
}
async function open(page: Page, id: string) { await page.goto('/#/quotes'); await page.locator(`tr[data-quote-id="${id}"]`).getByRole('button',{name:'Preview',exact:true}).click(); await expect(page.locator('#quote-service-location-root [aria-busy="false"]')).toBeVisible(); }
async function fill(page: Page, address: string) { await page.getByLabel(/^Service street address/).fill(address); await page.getByLabel(/^Service city/).fill('Fixture Town'); await page.getByLabel(/^Country code/).fill('ca'); }

test('fresh accounts create and associate service locations without sending or privileged property seeding', async ({page}) => {
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.route('**/*',route=>['http://127.0.0.1:4218','https://127.0.0.1:56429'].includes(new URL(route.request().url()).origin) && !/\/api\/(sms|calls|payments|emails)/.test(route.request().url())?route.continue():route.abort());
  await login(page,0); await expect(page.getByText('No quotes yet',{exact:true})).toBeVisible();
  const first=await newQuote(page,contacts[0],`entry-first-${run}`);await open(page,first);const root=page.locator('#quote-service-location-root');
  await expect(root).toContainText('No service locations');await page.getByRole('button',{name:'Add service location',exact:true}).click();await expect(page.getByLabel(/^Service street address/)).toBeFocused();
  await page.getByRole('button',{name:'Create service location',exact:true}).click();await expect(root.getByRole('alert')).toContainText('Enter a street address');
  await fill(page,'10 Synthetic Service Lane');await page.getByLabel(/^Service city/).press('Escape');await expect(page.getByRole('button',{name:'Add service location',exact:true})).toBeFocused();
  expect((await db.query('select count(*)::int as n from public.properties where user_id=$1',[users[0]])).rows[0].n).toBe(0);
  let lost=true,hold=false,release!:()=>void,started!:()=>void,completed!:()=>void;
  const wait=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r),done=new Promise<void>(r=>completed=r);const keys:string[]=[];
  await page.route('**/rest/v1/rpc/create_crm_property',async route=>{
    if(new URL(route.request().url()).origin!=='https://127.0.0.1:56429')return route.abort();if(route.request().method()!=='POST')return route.continue();
    const body=route.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(['p_request_key','p_contact_id','p_service_address_line1','p_locality','p_country_code','p_service_address_line2','p_administrative_area','p_postal_code','p_label'].sort());
    if(body.p_contact_id===contacts[0]&&body.p_service_address_line1==='10 Synthetic Service Lane'){
      keys.push(body.p_request_key);const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);const json=await response.json();for(const name of ['user_id','request_key','request_fingerprint'])expect(json.property).not.toHaveProperty(name);
      if(lost){lost=false;return route.abort('failed')}expect(json.replayed).toBe(true);return route.fulfill({response});
    }
    if(hold&&body.p_contact_id===contacts[1]){const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);started();await wait;await route.fulfill({response});completed();return;}
    return route.continue();
  });
  await page.getByRole('button',{name:'Add service location',exact:true}).click();await fill(page,'10 Synthetic Service Lane');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('[data-property-form]').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
  await expect(root.getByRole('alert')).toContainText('Creation could not be confirmed');await expect(page.getByRole('button',{name:'Cancel location creation',exact:true})).toBeDisabled();await expect(page.getByLabel(/^Service city/)).toBeDisabled();expect(keys).toHaveLength(1);
  await page.getByRole('button',{name:'Retry location creation',exact:true}).click();await expect(page.getByLabel('Customer service location',{exact:true})).toBeVisible();expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
  const created=(await db.query('select id,user_id,contact_id,country_code from public.properties where user_id=$1',[users[0]])).rows;expect(created).toHaveLength(1);expect(created[0]).toMatchObject({user_id:users[0],contact_id:contacts[0],country_code:'CA'});
  const selector=page.getByLabel('Customer service location',{exact:true});await expect(selector).toHaveValue(created[0].id);expect((await db.query('select property_id,revision,status from public.quotes where id=$1',[first])).rows[0]).toEqual({property_id:null,revision:1,status:'draft'});
  await page.getByRole('button',{name:'Cancel selection',exact:true}).click();await expect(selector).toHaveValue('');await selector.selectOption(created[0].id);await page.getByRole('button',{name:'Save service location',exact:true}).click();await expect(page.getByRole('button',{name:'Save service location',exact:true})).toBeDisabled();
  expect((await db.query('select property_id,revision,status from public.quotes where id=$1',[first])).rows[0]).toEqual({property_id:created[0].id,revision:2,status:'draft'});await root.screenshot({path:test.info().outputPath('fresh-account-location-associated.png')});
  console.log('PASS fresh account: visible validation/cancel, mobile creation, double-click suppression, lost-response replay, private RPC response and explicit association.');
  await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Add service location',exact:true}).click();await fill(page,'Denied Synthetic Lane');
  try{await db.query('revoke execute on function public.create_crm_property(uuid,text,text,text,text,text,text,text,text) from authenticated');await page.getByRole('button',{name:'Create service location',exact:true}).click();await expect(root.getByRole('alert')).toContainText('access changed');}
  finally{await db.query('grant execute on function public.create_crm_property(uuid,text,text,text,text,text,text,text,text) to authenticated');}
  await page.getByRole('button',{name:'Cancel location creation',exact:true}).click();
  const second=await newQuote(page,contacts[1],`entry-second-${run}`);await open(page,second);await expect(root).toContainText('No service locations');await expect(root).not.toContainText('10 Synthetic Service Lane');
  await page.getByRole('button',{name:'Add service location',exact:true}).click();await fill(page,'20 Delayed Service Lane');hold=true;await page.getByRole('button',{name:'Create service location',exact:true}).click();await begun;
  try { await page.getByRole('button',{name:'Back',exact:true}).click(); release(); await done; } finally { release(); }
  await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,1);await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();await expect(page.getByText('No quotes yet',{exact:true})).toBeVisible();
  await page.goto(`/#/quote-preview/${first}`);await expect(page.getByText('Quote unavailable',{exact:true})).toBeVisible();await expect(page.getByText('10 Synthetic Service Lane',{exact:false})).toHaveCount(0);
  const token=(await auth('/auth/v1/token?grant_type=password',{email:emails[1],password},status.ANON_KEY)).access_token;
  const denied=await fetch(`${status.API_URL}/rest/v1/rpc/create_crm_property`,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({p_request_key:randomUUID(),p_contact_id:contacts[0],p_service_address_line1:'Foreign attempt',p_locality:'Town',p_country_code:'CA'})});expect(denied.status).toBe(403);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,0);await open(page,second);await expect(page.getByLabel('Customer service location',{exact:true})).toContainText('20 Delayed Service Lane');await expect(page.getByLabel('Customer service location',{exact:true})).toHaveValue('');
  expect((await db.query('select count(*)::int as n from public.properties where user_id=$1',[users[0]])).rows[0].n).toBe(2);expect((await db.query('select count(*)::int as n from public.quote_acceptances where user_id=$1',[users[0]])).rows[0].n).toBe(0);expect(errors).toEqual([]);
  console.log('PASS customer/business denial, actual SQL permission error, committed navigation race, account isolation and draft-only/no-acceptance behavior.');
});
