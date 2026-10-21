import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { assertLocalPropertyQaStatus } from '../fixtures/service_property_local_guard';
import { isLocalCrmQaUrl, isLocalCrmQaBackendUrl } from '../fixtures/local_crm_browser_guard';

test.skip(process.env.WASHOPS_EMPTY_ACCOUNT_QA !== 'true','Explicit disposable local Auth only.');
const status=process.env.WASHOPS_LOCAL_QA_STATUS ? JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS) : {};
const run=randomUUID(), password=`Synthetic-${randomUUID()}-9a!`;
const emails=[`empty-crm-a-${run}@example.test`,`empty-crm-b-${run}@example.test`];
const users:string[]=[];let db:Client;
async function auth(path:string,body:unknown,key=status.SERVICE_ROLE_KEY){
  if(status.API_URL!=='http://127.0.0.1:56421')throw Error('Local Auth only');
  const r=await fetch(`${status.API_URL}${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error(`Local Auth fixture failed (${r.status})`);return r.json();
}
test.beforeAll(async()=>{
  if(process.env.WASHOPS_EMPTY_ACCOUNT_QA!=='true')return;
  assertLocalPropertyQaStatus(status);db=new Client({connectionString:status.DB_URL});await db.connect();
  // Auth identity/profile only. No contact, opportunity, lead request, property, quote or acceptance is seeded.
  for(const email of emails)users.push((await auth('/auth/v1/admin/users',{email,password,email_confirm:true})).id);
  for(const table of ['contacts','opportunities','internal_crm_lead_requests','properties','quotes','quote_acceptances','invoices','messages','calls','websites'])expect((await db.query(`select count(*)::int as n from public.${table} where user_id=any($1::text[])`,[users])).rows[0].n).toBe(0);
});
test.afterAll(async()=>{
  if(!db)return;
  try{
    for(const table of ['quotes','properties','internal_crm_lead_requests','opportunities','contacts','users'])await db.query(`delete from public.${table} where ${table==='users'?'id':'user_id'}=any($1::text[])`,[users]);
    for(const id of users){const r=await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Local Auth cleanup failed');}
  }finally{await db.end();}
});
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>isLocalCrmQaUrl(route.request().url())?route.continue():route.abort());
});
async function login(page:Page,index:number){
  await page.goto('/#/dashboard');await page.getByLabel('Email',{exact:true}).fill(emails[index]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await page.goto('/#/dashboard');await page.waitForLoadState('networkidle');const later=page.getByRole('button',{name:'Set up website later',exact:true});if(await later.isVisible())await later.click();
}
async function fillLead(page:Page,second=false){
  await page.getByLabel('Full name',{exact:false}).fill(second?'Synthetic Second Lead':'Synthetic Empty Account Lead');
  await page.getByLabel('Phone number',{exact:false}).fill(second?'6135550102':'6135550101');await page.getByLabel('Email address',{exact:false}).fill(`${second?'second':'first'}-${run}@example.test`);
  await page.getByLabel('Service address',{exact:false}).fill('10 Synthetic Billing Lane');await page.getByLabel('Service type',{exact:false}).selectOption('Residential Pressure Washing');await page.getByLabel('Message / details',{exact:false}).fill('Synthetic private QA only; do not contact.');
}
test('cold authenticated navigation awaits the existing contact hydration request',async({page})=>{
  let release!:()=>void,started!:()=>void;const held=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r);
  await page.route('**/rest/v1/contacts?*',async route=>{if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/contacts'))return route.abort();started();await held;return route.continue();});
  await page.goto('/#/dashboard');await page.getByLabel('Email',{exact:true}).fill(emails[0]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await begun;
  try { await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('Contacts could not be loaded',{exact:true})).toHaveCount(0);release();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible(); } finally { release(); }
});
test('actually empty authenticated owner creates first lead, draft estimate and service location using normal production UI',async({page})=>{
  page.setDefaultTimeout(15000);const errors:string[]=[];let forbidden=0;page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)console.log(`QA HTTP ${r.status()} ${new URL(r.url()).pathname}`);});
  page.on('requestfailed',r=>console.log(`QA failed request ${new URL(r.url()).pathname}`));
  await page.route('**/*',route=>{
    if(!isLocalCrmQaUrl(route.request().url()) || new URL(route.request().url()).pathname.startsWith('/api/contacts/')){forbidden++;return route.abort();}
    return route.continue();
  });
  await login(page,0);await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await expect(page.locator('#lead-submit-status')).toContainText('full name');
  await fillLead(page);await page.getByLabel('Full name',{exact:false}).press('Escape');await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();expect((await db.query('select count(*)::int as n from public.contacts where user_id=$1',[users[0]])).rows[0].n).toBe(0);
  await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await fillLead(page);
  try{await db.query('revoke execute on function public.create_internal_crm_lead(uuid,text,text,text,text,text,text,text,text) from authenticated');await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await expect(page.locator('#lead-submit-status')).toContainText('Lead access changed');}
  finally{await db.query('grant execute on function public.create_internal_crm_lead(uuid,text,text,text,text,text,text,text,text) to authenticated');}
  await expect(page.getByLabel('Full name',{exact:false})).toBeEnabled();await page.getByLabel('Email address',{exact:false}).fill('invalid');await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await expect(page.locator('#lead-submit-status')).toContainText('valid email');await fillLead(page);
  let lost=true,hold=false,release!:()=>void,started!:()=>void,completed!:()=>void;const held=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r),done=new Promise<void>(r=>completed=r);const keys:string[]=[];
  await page.route('**/rest/v1/rpc/create_internal_crm_lead',async route=>{
    if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/create_internal_crm_lead'))return route.abort();
    if(route.request().method()!=='POST')return route.continue();const body=route.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(['p_request_key','p_name','p_phone','p_email','p_address','p_service_type','p_message','p_source','p_funnel_id'].sort());
    const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);
    if(hold){started();await held;await route.fulfill({response});completed();return;}
    keys.push(body.p_request_key);if(lost){lost=false;return route.abort('failed');}expect((await response.json()).replayed).toBe(true);return route.fulfill({response});
  });
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#lead-form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await expect(page.locator('#lead-submit-status')).toContainText('could not be confirmed');expect(keys).toHaveLength(1);await expect(page.getByLabel('Full name',{exact:false})).toBeDisabled();await expect(page.getByRole('button',{name:'Cancel lead creation',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1280,height:900});await page.getByRole('link',{name:'Quotes',exact:true}).click();await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry lead creation',exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry lead creation',exact:true}).click();await expect(page.getByRole('link',{name:'Open Synthetic Empty Account Lead',exact:true})).toBeVisible();expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
  const contact=(await db.query('select id from public.contacts where user_id=$1',[users[0]])).rows;expect(contact).toHaveLength(1);expect((await db.query('select count(*)::int as n from public.opportunities where user_id=$1',[users[0]])).rows[0].n).toBe(1);expect((await db.query('select count(*)::int as n from public.internal_crm_lead_requests where user_id=$1',[users[0]])).rows[0].n).toBe(1);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'View Synthetic Empty Account Lead',exact:true}).focus();await page.getByRole('button',{name:'View Synthetic Empty Account Lead',exact:true}).press('Enter');await expect(page.getByRole('heading',{name:'Synthetic Empty Account Lead',exact:true})).toBeVisible();await expect(page.locator('#api-timeline-list')).toContainText('No activities recorded.');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:900});await page.reload();await expect(page.getByRole('heading',{name:'Synthetic Empty Account Lead',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to clients',exact:true}).click();await expect(page.getByRole('link',{name:'Open Synthetic Empty Account Lead',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Quotes',exact:true}).click();await page.getByRole('button',{name:'New quote',exact:true}).click();await page.getByLabel('Select contact').selectOption(contact[0].id);await page.getByLabel('Select opportunity').selectOption({index:1});await page.locator('.wo-quote-tier-composer').first().getByRole('button',{name:'Add item'}).click();await page.getByLabel('basic service name').pressSequentially('Synthetic washing work');expect(await page.evaluate(()=>(window as any).newQuoteLineItems[0].service)).toBe('Synthetic washing work');await page.getByRole('spinbutton').nth(0).fill('1');await page.getByRole('spinbutton').nth(1).fill('1');await page.getByLabel('Internal notes or terms').fill(`Empty account QA ${run}`);await page.getByRole('button',{name:'Create quote',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();const quote=(await db.query('select id from public.quotes where user_id=$1',[users[0]])).rows;expect(quote).toHaveLength(1);expect((await db.query('select total_amount,opportunity_id is not null as linked from public.quotes where id=$1',[quote[0].id])).rows[0]).toMatchObject({total_amount:'1.00',linked:true});expect((await db.query('select service_name,quantity from public.quote_items where quote_id=$1',[quote[0].id])).rows).toHaveLength(1);await page.locator(`tr[data-quote-id="${quote[0].id}"]`).getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('#quote-service-location-root')).toContainText('No service locations');await page.getByRole('button',{name:'Add service location',exact:true}).click();await page.getByLabel(/^Service street address/).fill('20 Synthetic Washing Lane');await page.getByLabel(/^Service city/).fill('Fixture Town');await page.getByLabel(/^Country code/).fill('CA');await page.getByRole('button',{name:'Create service location',exact:true}).click();await expect(page.getByLabel('Customer service location',{exact:true})).toContainText('20 Synthetic Washing Lane');
  expect((await db.query('select property_id from public.quotes where id=$1',[quote[0].id])).rows[0].property_id).toBeNull();await page.getByRole('button',{name:'Save service location',exact:true}).click();await expect(page.getByRole('button',{name:'Save service location',exact:true})).toBeDisabled();await page.reload();await expect(page.getByLabel('Customer service location',{exact:true})).toContainText('20 Synthetic Washing Lane');expect((await db.query('select status,revision,property_id is not null as assigned from public.quotes where id=$1',[quote[0].id])).rows[0]).toEqual({status:'draft',revision:2,assigned:true});await page.screenshot({path:test.info().outputPath('empty-account-draft-location.png')});
  console.log('PASS truly empty Auth account → ordinary lead RPC/replay → draft estimate → explicit service location association, no seeded CRM records.');
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await fillLead(page,true);hold=true;await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await begun;
  try{await page.getByRole('link',{name:'Quotes',exact:true}).click();release();await done;}finally{release();}
  await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await page.getByRole('button',{name:'View saved lead',exact:true}).click();await expect(page.getByRole('link',{name:'Open Synthetic Second Lead',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await fillLead(page,true);await page.getByRole('link',{name:'Quotes',exact:true}).click();
  const signedOut=page.waitForResponse(r=>isLocalCrmQaBackendUrl(r.url(),'/auth/v1/logout') && r.status()<300);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await signedOut;await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await login(page,1);await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();await expect(page.getByLabel('Full name',{exact:false})).toHaveValue('');await expect(page.getByRole('button',{name:'Submit lead info',exact:true})).toBeVisible();
  await page.goto(`/#/contact-detail/${contact[0].id}`);await expect(page.getByRole('heading',{name:'Contact unavailable',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Synthetic Empty Account Lead',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Back to clients',exact:true}).click();
  for(const table of ['quote_acceptances','invoices','messages','calls','websites'])expect((await db.query(`select count(*)::int as n from public.${table} where user_id=any($1::text[])`,[users])).rows[0].n).toBe(0);
  expect((await db.query('select count(*)::int as n from public.contacts where user_id=$1',[users[0]])).rows[0].n).toBe(2);expect(forbidden).toBe(0);expect(errors).toEqual([]);
  console.log('PASS permission/validation, frozen retries, mobile/keyboard cancellation, navigation commit recovery and account isolation; zero API-leads/send/accept/invoice/website requests.');
});

test('contact detail distinguishes failed authenticated hydration and supports ordinary retry',async({page})=>{
  const contact=(await db.query('select id from public.contacts where user_id=$1 order by created_at limit 1',[users[0]])).rows[0];
  expect(contact).toBeTruthy();
  const pattern='**/rest/v1/contacts?*';
  await page.route(pattern,route=>{
    if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/contacts'))return route.abort();
    return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic local denied read'})});
  });
  await login(page,0);await page.goto(`/#/contact-detail/${contact.id}`);
  await expect(page.getByRole('heading',{name:'Contact could not be loaded',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Synthetic .* Lead/})).toHaveCount(0);
  await page.unroute(pattern);
  await page.getByRole('button',{name:'Retry',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:/Synthetic .* Lead/})).toBeVisible();
  await expect(page.locator('#api-timeline-list')).toContainText('No activities recorded.');
});
