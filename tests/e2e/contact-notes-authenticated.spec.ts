import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { assertLocalPropertyQaStatus } from '../fixtures/service_property_local_guard';
import { isLocalCrmQaUrl, isLocalCrmQaBackendUrl } from '../fixtures/local_crm_browser_guard';

test.skip(process.env.WASHOPS_NOTE_AUTH_QA!=='true','Explicit disposable local Auth only.');
const status=process.env.WASHOPS_LOCAL_QA_STATUS?JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS):{};
const run=randomUUID(),password=`Synthetic-${randomUUID()}-9a!`,users:string[]=[];
const emails=[`note-crm-a-${run}@example.test`,`note-crm-b-${run}@example.test`];let db:Client;
async function auth(path:string,body:unknown) {
  if(status.API_URL!=='http://127.0.0.1:56421')throw Error('Local Auth only');
  const r=await fetch(`${status.API_URL}${path}`,{method:'POST',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error(`Local Auth fixture failed (${r.status})`);return r.json();
}
test.beforeAll(async()=>{
  if(process.env.WASHOPS_NOTE_AUTH_QA!=='true')return;
  assertLocalPropertyQaStatus(status);db=new Client({connectionString:status.DB_URL});await db.connect();
  for(const email of emails)users.push((await auth('/auth/v1/admin/users',{email,password,email_confirm:true})).id);
  // Only Auth identities/profiles are seeded. Every CRM record must be created through ordinary production UI.
  for(const table of ['contacts','activities','opportunities','messages','calls','quotes','invoices','properties','websites'])
    expect((await db.query(`select count(*)::int as n from public.${table} where user_id=any($1::text[])`,[users])).rows[0].n).toBe(0);
});
test.afterAll(async()=>{
  if(!db)return;
  try {
    await db.query('delete from public.users where id=any($1::text[])',[users]);
    for(const id of users){const r=await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Local Auth cleanup failed');}
  }finally{await db.end();}
});
async function login(page:Page,index:number){
  await page.goto('/#/dashboard');await page.getByLabel('Email',{exact:true}).fill(emails[index]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await page.goto('/#/dashboard');const later=page.getByRole('button',{name:'Set up website later',exact:true});await expect(later).toBeVisible();await later.click();
}
async function createLead(page:Page,second=false){
  await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();
  await page.getByLabel('Full name',{exact:false}).fill(second?'Synthetic Other Note Contact':'Synthetic Note Contact');
  await page.getByLabel('Phone number',{exact:false}).fill(second?'6135550102':'6135550101');await page.getByLabel('Email address',{exact:false}).fill(`${second?'second':'first'}-${run}@example.test`);
  await page.getByLabel('Service address',{exact:false}).fill('10 Synthetic Note Lane');await page.getByLabel('Service type',{exact:false}).selectOption('Residential Pressure Washing');await page.getByLabel('Message / details',{exact:false}).fill('Synthetic local QA only; no contact.');
  await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await expect(page.getByRole('link',{name:second?'Open Synthetic Other Note Contact':'Open Synthetic Note Contact',exact:true})).toBeVisible();
}
const noteText='Synthetic conversation summary\n<img src=x onerror="window.__noteXss=true"> & '+ 'x'.repeat(600);
test('empty production-build owner creates durable internal notes, retries across reload and stays isolated across navigation/accounts',async({page})=>{
  page.setDefaultTimeout(15000);const errors:string[]=[];let forbidden=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    if(!isLocalCrmQaUrl(route.request().url()) || new URL(route.request().url()).pathname.startsWith('/api/contacts/')){forbidden++;return route.abort();}
    return route.continue();
  });
  await login(page,0);await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();await createLead(page);
  const open=async()=>{await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'View Synthetic Note Contact',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic Note Contact',exact:true})).toBeVisible();};
  await open();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Add note',exact:true}).focus();await page.getByRole('button',{name:'Add note',exact:true}).press('Enter');
  await expect(page.getByLabel('Note text',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#contact-note-status')).toContainText('1 to 5000');
  await page.getByLabel('Note text',{exact:true}).fill('Cancel this draft');await page.getByLabel('Note text',{exact:true}).press('Escape');await expect(page.locator('#contact-note-form')).toHaveCount(0);await expect(page.getByRole('button',{name:'Add note',exact:true})).toBeFocused();
  expect((await db.query('select count(*)::int as n from public.activities where user_id=$1',[users[0]])).rows[0].n).toBe(0);
  await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByLabel('Note text',{exact:true}).fill(noteText);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  try {await db.query('revoke execute on function public.create_crm_contact_note(uuid,text,text) from authenticated');await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#contact-note-status')).toContainText('Note access changed');}
  finally{await db.query('grant execute on function public.create_crm_contact_note(uuid,text,text) to authenticated');}
  await expect(page.getByLabel('Note text',{exact:true})).toBeEnabled();
  let mode:'lost'|'replay'|'navigation'|'account'='lost',release!:()=>void,started!:()=>void;
  let gate=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r);const keys:string[]=[];
  await page.route('**/rest/v1/rpc/create_crm_contact_note',async route=>{
    if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/create_crm_contact_note'))return route.abort();
    if(route.request().method()!=='POST')return route.continue();
    const body=route.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(['p_request_key','p_contact_id','p_note'].sort());keys.push(body.p_request_key);
    const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);
    if(mode==='replay'){expect((await response.json()).replayed).toBe(true);return route.fulfill({response});}
    started();await gate;if(mode==='lost')return route.abort('failed');return route.fulfill({response});
  });
  await page.getByRole('button',{name:'Save note',exact:true}).dblclick();await begun;
  await expect(page.getByRole('button',{name:'Saving note.',exact:true})).toBeDisabled();expect(keys).toHaveLength(1);release();await expect(page.locator('#contact-note-status')).toContainText('could not be confirmed');await expect(page.getByRole('button',{name:'Cancel note',exact:true})).toBeDisabled();
  await page.reload();await expect(page.locator('#api-timeline-list .wo-contact-note-text')).toHaveCount(1);await page.getByRole('button',{name:'Add note',exact:true}).click();await expect(page.getByLabel('Note text',{exact:true})).toHaveValue(noteText);await expect(page.getByLabel('Note text',{exact:true})).toBeDisabled();mode='replay';await page.getByRole('button',{name:'Retry note save',exact:true}).click();await expect(page.locator('#contact-note-status')).toContainText('Note saved');expect(keys[0]).toBe(keys[1]);
  await expect(page.locator('#api-timeline-list .wo-contact-note-text')).toHaveText([noteText]);await expect(page.locator('#api-timeline-list')).toContainText('Created:');await expect(page.locator('#api-timeline-list img')).toHaveCount(0);expect(await page.evaluate(()=>Boolean((window as any).__noteXss))).toBe(false);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Close note',exact:true}).click();await expect(page.locator('#contact-note-form')).toHaveCount(0);await page.setViewportSize({width:1280,height:900});await createLead(page,true);await open();
  mode='navigation';gate=new Promise<void>(r=>release=r);begun=new Promise<void>(r=>started=r);await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByLabel('Note text',{exact:true}).fill('Second note — navigation race');await page.getByRole('button',{name:'Save note',exact:true}).click();await begun;
  await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await page.getByRole('button',{name:'View Synthetic Other Note Contact',exact:true}).click();release();await page.waitForTimeout(100);await expect(page.getByRole('heading',{name:'Synthetic Other Note Contact',exact:true})).toBeVisible();await expect(page.locator('#api-timeline-list')).not.toContainText('Second note');
  await open();await page.getByRole('button',{name:'Add note',exact:true}).click();await expect(page.locator('#contact-note-status')).toContainText('Note saved');await expect(page.locator('#api-timeline-list')).toContainText('Second note');await page.getByRole('button',{name:'Close note',exact:true}).click();
  mode='account';gate=new Promise<void>(r=>release=r);begun=new Promise<void>(r=>started=r);await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByLabel('Note text',{exact:true}).fill('Third note — account race');await page.getByRole('button',{name:'Save note',exact:true}).click();await begun;
  const signedOut=page.waitForResponse(r=>isLocalCrmQaBackendUrl(r.url(),'/auth/v1/logout')&&r.status()<300);await page.getByRole('button',{name:'Sign out',exact:true}).click();await signedOut;await login(page,1);release();await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('washops:contact-note:1:')).length)).toBe(0);await expect(page.getByText('Third note — account race',{exact:true})).toHaveCount(0);
  expect((await db.query('select count(*)::int as n from public.activities where user_id=$1',[users[0]])).rows[0].n).toBe(3);
  expect((await db.query('select count(*)::int as n from public.activities where user_id=$1',[users[1]])).rows[0].n).toBe(0);
  for(const table of ['messages','calls','quote_acceptances','invoices','websites'])expect((await db.query(`select count(*)::int as n from public.${table} where user_id=any($1::text[])`,[users])).rows[0].n).toBe(0);
  expect(errors).toEqual([]);expect(forbidden).toBe(0);
  console.log('PASS normal empty-account production note persistence, cancellation, denied permission, double click, lost response/reload replay, XSS/mobile/keyboard, contact/account race and zero outbound actions.');
});
