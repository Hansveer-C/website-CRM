import {test,expect,type Page} from '@playwright/test';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {assertLocalPropertyQaStatus} from '../fixtures/service_property_local_guard';
import {isLocalCrmQaUrl,isLocalCrmQaBackendUrl} from '../fixtures/local_invoice_browser_guard';
test.skip(process.env.WASHOPS_REVIEW_AUTH_QA!=='true','Explicit disposable local review only.');
const status=process.env.WASHOPS_LOCAL_QA_STATUS?JSON.parse(process.env.WASHOPS_LOCAL_QA_STATUS):{};
const run=randomUUID(),password=`Synthetic-${randomUUID()}-9a!`,email=`review-${run}@example.test`;
let db:Client,user:string,foreignUser:string;
const foreignEmail=`review-foreign-${run}@example.test`;
test.beforeAll(async()=>{
  assertLocalPropertyQaStatus(status);db=new Client({connectionString:status.DB_URL});await db.connect();
  const r=await fetch(`${status.API_URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});
  if(!r.ok)throw Error('Local Auth fixture failed');user=(await r.json()).id;
  const foreign=await fetch(`${status.API_URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({email:foreignEmail,password,email_confirm:true})});
  if(!foreign.ok)throw Error('Local foreign Auth fixture failed');foreignUser=(await foreign.json()).id;
  for(const table of ['contacts','properties','quotes','quote_acceptances','activities'])expect((await db.query(`select count(*)::int n from public.${table} where user_id=$1`,[user])).rows[0].n).toBe(0);
  expect((await db.query('select enabled from private.crm_quote_review_runtime')).rows[0].enabled).toBe(true);
});
test('malformed public review URLs fail closed without capability RPC requests',async({page})=>{
  let requests=0;
  await page.route('**/*',route=>isLocalCrmQaUrl(route.request().url())?route.continue():route.abort());
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/rest/v1/rpc/'))requests++;});
  for(const token of ['a'.repeat(63),'not-a-token','<img-onerror=alert(1)>']){
    await page.goto('/#/estimate-review/'+token);
    await expect(page.getByText('Estimate review is unavailable.',{exact:true})).toBeVisible();
    expect(await page.locator('img,script[src*=onerror]').count()).toBe(0);
  }
  expect(requests).toBe(0);
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
});
test.afterAll(async()=>{if(!db)return;try{
  await db.query('delete from public.users where id=any($1::text[])',[[user,foreignUser]]);
  for(const fixtureUser of [user,foreignUser]){const r=await fetch(`${status.API_URL}/auth/v1/admin/users/${fixtureUser}`,{method:'DELETE',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Local Auth cleanup failed');}
}finally{await db.end();}});
async function login(page:Page,loginEmail=email){await page.goto('/#/dashboard');await page.getByLabel('Email',{exact:true}).fill(loginEmail);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Set up website later',exact:true})).toBeVisible();await page.getByRole('button',{name:'Set up website later',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await page.goto('/#/dashboard');await expect(page.getByRole('button',{name:'Set up website later',exact:true})).toHaveCount(0);}
test('normal production-build empty owner review acceptance and invoice journey',async({page,browser})=>{
  let forbidden=0;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(!isLocalCrmQaUrl(route.request().url())){forbidden++;return route.abort();}return route.continue();});
  await login(page);await page.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(page.getByText('No contacts found',{exact:true})).toBeVisible();await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();
  await page.getByLabel('Full name',{exact:false}).fill('Synthetic Review Owner Contact');await page.getByLabel('Phone number',{exact:false}).fill('6135550101');await page.getByLabel('Email address',{exact:false}).fill(`contact-${run}@example.test`);await page.getByLabel('Service address',{exact:false}).fill('PRIVATE BILLING ADDRESS');await page.getByLabel('Service type',{exact:false}).selectOption('Residential Pressure Washing');await page.getByLabel('Message / details',{exact:false}).fill('PRIVATE LEAD MESSAGE');await page.getByRole('button',{name:'Submit lead info',exact:true}).click();await expect(page.getByRole('link',{name:'Open Synthetic Review Owner Contact',exact:true})).toBeVisible();
  const contact=(await db.query('select id from public.contacts where user_id=$1',[user])).rows[0];
  await page.getByRole('link',{name:'Quotes',exact:true}).click();await page.getByRole('button',{name:'New quote',exact:true}).click();await page.getByLabel('Select contact').selectOption(contact.id);await page.getByLabel('Select opportunity').selectOption({index:1});await page.locator('.wo-quote-tier-composer').first().getByRole('button',{name:'Add item'}).click();await page.getByLabel('basic service name').fill('Synthetic wash <b>literal</b>');await page.getByRole('spinbutton').nth(1).fill('90');await page.getByLabel('Internal notes or terms').fill('PRIVATE QUOTE NOTES');await page.getByRole('button',{name:'Create quote',exact:true}).click();await expect(page.getByRole('heading',{name:'Quotes',exact:true})).toBeVisible();
  const quote=(await db.query('select id from public.quotes where user_id=$1',[user])).rows[0];await page.locator(`tr[data-quote-id="${quote.id}"]`).getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Add service location',exact:true}).click();await page.getByLabel(/^Service street address/).fill('20 Synthetic Review Lane');await page.getByLabel(/^Service city/).fill('Fixture Town');await page.getByLabel(/^Country code/).fill('CA');await page.getByRole('button',{name:'Create service location',exact:true}).click();await expect(page.getByLabel('Customer service location',{exact:true})).toContainText('20 Synthetic Review Lane');await page.getByRole('button',{name:'Save service location',exact:true}).click();await expect(page.getByRole('button',{name:'Save service location',exact:true})).toBeDisabled();
  await expect(page.locator('#accepted-invoice-root')).toHaveCount(0);
  const owner=page.locator('#quote-review-root');await expect(owner.getByRole('button',{name:'Generate review link',exact:true})).toBeVisible();await owner.getByLabel('Customer-facing estimate message (optional)').fill('<img src=x onerror=alert(1)> Explicit message');
  let lost=true;const keys:string[]=[];
  await page.route('**/rest/v1/rpc/create_crm_quote_review',async route=>{if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/create_crm_quote_review'))return route.abort();if(route.request().method()!=='POST')return route.continue();keys.push(route.request().postDataJSON().p_request_key);const r=await route.fetch({maxRedirects:0});expect(r.status()).toBe(200);if(lost){lost=false;return route.abort('failed');}if(keys.length===2)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...await r.json(),id:''})});return route.fulfill({response:r});});
  await owner.getByRole('button',{name:'Generate review link',exact:true}).click();await expect(owner).toContainText('could not be confirmed');await owner.getByRole('button',{name:'Retry review request',exact:true}).click();await expect(owner).toContainText('could not be confirmed');await owner.getByRole('button',{name:'Retry review request',exact:true}).click();await expect(owner.getByLabel('Review link (anyone holding it can view this estimate)')).toBeVisible();expect(keys).toHaveLength(3);expect(new Set(keys).size).toBe(1);
  const link=await owner.getByLabel('Review link (anyone holding it can view this estimate)').inputValue();  const finalKeys:string[]=[];
  await page.route('**/rest/v1/rpc/record_crm_quote_review_acceptance',async route=>{if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/record_crm_quote_review_acceptance'))return route.abort();if(route.request().method()!=='POST')return route.continue();finalKeys.push(route.request().postDataJSON().p_request_key);const r=await route.fetch({maxRedirects:0});expect(r.status()).toBe(200);if(finalKeys.length===1)return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.fulfill({response:r});});
  expect((await db.query('select status from public.quotes where id=$1',[quote.id])).rows[0].status).toBe('draft');
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});const recipient=await context.newPage();recipient.on('pageerror',e=>errors.push(e.message));await recipient.route('**/*',route=>isLocalCrmQaUrl(route.request().url())?route.continue():route.abort());
  const responseKeys:string[]=[];
  await recipient.route('**/rest/v1/rpc/respond_crm_quote_review',async route=>{if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/respond_crm_quote_review'))return route.abort();if(route.request().method()!=='POST')return route.continue();responseKeys.push(route.request().postDataJSON().p_request_key);const r=await route.fetch({maxRedirects:0});expect(r.status()).toBe(200);if(responseKeys.length===1)return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.fulfill({response:r});});
  try{
    await recipient.goto(link);await expect(recipient.getByRole('heading',{name:'Review estimate',exact:true})).toBeVisible();await expect(recipient.getByText('20 Synthetic Review Lane, Fixture Town, CA',{exact:true})).toBeVisible();await expect(recipient.locator('main')).not.toContainText('PRIVATE');expect(await recipient.locator('main img,main b').count()).toBe(0);
    await recipient.getByRole('button',{name:'Confirm estimate response',exact:true}).click();await expect(recipient.getByRole('status')).toContainText('Choose an option');await recipient.getByLabel('Choose estimate option').selectOption('basic');await recipient.getByLabel('Your name',{exact:true}).fill('Actual Synthetic Recipient');await recipient.getByLabel('I confirm the displayed scope and price for my selected option.').check();
    await recipient.getByRole('button',{name:'Confirm estimate response',exact:true}).focus();await recipient.getByRole('button',{name:'Confirm estimate response',exact:true}).press('Enter');await expect(recipient.getByRole('status')).toContainText('could not be confirmed');await recipient.getByRole('button',{name:'Retry same response',exact:true}).click();await expect.poll(()=>responseKeys.length).toBe(2);expect(responseKeys[0]).toBe(responseKeys[1]);await expect(recipient.getByText('Your response was received. The business still needs to record acceptance.',{exact:true}).first()).toBeVisible();expect(await recipient.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await recipient.reload();await expect(recipient.getByText('Your response was received. The business still needs to record acceptance.',{exact:true})).toBeVisible();
    await recipient.setViewportSize({width:1280,height:900});await login(recipient,foreignEmail);await recipient.getByRole('link',{name:'Clients & Leads',exact:false}).click();await expect(recipient.getByText('No contacts found',{exact:true})).toBeVisible();
    await recipient.goto(link);await expect(recipient.getByText('Your response was received. The business still needs to record acceptance.',{exact:true})).toBeVisible();await expect(recipient.locator('main')).not.toContainText('PRIVATE');await expect(recipient.getByRole('button',{name:'Record customer response as acceptance',exact:true})).toHaveCount(0);
    await owner.getByRole('button',{name:'Reload review status',exact:true}).click();await expect(owner).toContainText('Actual Synthetic Recipient');await owner.getByRole('button',{name:'Record customer response as acceptance',exact:true}).click();await expect(owner).toContainText('could not be confirmed');await owner.getByRole('button',{name:'Retry review request',exact:true}).click();await expect.poll(()=>finalKeys.length).toBe(2);expect(finalKeys[0]).toBe(finalKeys[1]);await expect(page.locator('#quote-service-location-root')).toContainText('20 Synthetic Review Lane');await expect(page.locator('#quote-review-root')).toContainText('Response recorded as estimate acceptance.');
    const accepted=(await db.query('select actor_user_id,signer_name,quote_revision,accepted_total_amount from public.quote_acceptances where quote_id=$1',[quote.id])).rows;expect(accepted).toHaveLength(1);expect(accepted[0]).toMatchObject({actor_user_id:user,signer_name:'Actual Synthetic Recipient',quote_revision:2,accepted_total_amount:'90.00'});await page.reload();await expect(page.locator('#quote-review-root')).toContainText('Response recorded as estimate acceptance.');
    const invoicePanel=page.locator('#accepted-invoice-root');
    await expect(invoicePanel.getByRole('button',{name:'Create invoice',exact:true})).toBeVisible();
    const invoiceKeys:string[]=[];let dropInvoice=true;
    await page.route('**/rest/v1/rpc/create_invoice_from_accepted_quote',async route=>{
      if(!isLocalCrmQaBackendUrl(route.request().url(),'/rest/v1/rpc/create_invoice_from_accepted_quote'))return route.abort();
      if(route.request().method()!=='POST')return route.continue();
      invoiceKeys.push(route.request().postDataJSON().p_request_key);
      const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);
      if(dropInvoice){dropInvoice=false;return route.abort('failed');}
      const payload=await response.json();
      // Synthetic local diagnostic assertions: compare persisted response with the canonical snapshot.
      expect(typeof payload.invoice.invoice_number).toBe('number');
      expect(payload.invoice.total_amount).toBe(90);expect(payload.invoice.source_quote_revision).toBe(2);
      expect(payload.items[0]).toMatchObject({service_name:'Synthetic wash <b>literal</b>',description:'',quantity:1,unit_price:90,line_total:90,source_quote_item_order_index:0});
      return route.fulfill({response});
    });
    await invoicePanel.getByRole('button',{name:'Create invoice',exact:true}).dblclick();
    await expect(invoicePanel.getByRole('button',{name:'Retry invoice save',exact:true})).toBeVisible();
    await invoicePanel.getByRole('button',{name:'Retry invoice save',exact:true}).click();
    await expect(invoicePanel.getByRole('button',{name:'Open existing invoice',exact:true})).toBeVisible();
    expect(invoiceKeys).toHaveLength(2);expect(new Set(invoiceKeys).size).toBe(1);
    expect((await db.query('select total_amount,source_quote_revision,status from public.invoices where user_id=$1',[user])).rows).toEqual([{total_amount:'90.00',source_quote_revision:2,status:'issued'}]);
    await invoicePanel.getByRole('button',{name:'Open existing invoice',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Invoices',exact:true,level:1})).toBeVisible();
    await expect(page.locator('#invoice-detail-title')).toContainText('Invoice #');
    await expect(page.locator('.wo-invoice-items-card')).toContainText('Synthetic wash <b>literal</b>');
    expect(await page.locator('.wo-invoice-items-card b').count()).toBe(0);
    await page.reload();await expect(page.getByRole('heading',{name:'Invoices',exact:true,level:1})).toBeVisible();
    await page.getByRole('link',{name:'Quotes',exact:true}).click();
    await page.locator(`tr[data-quote-id="${quote.id}"]`).getByRole('button',{name:'Preview',exact:true}).click();
    await expect(page.locator('#accepted-invoice-root').getByRole('button',{name:'Open existing invoice',exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#accepted-invoice-root').getByRole('button',{name:'Open existing invoice',exact:true}).focus();
    await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Invoices',exact:true,level:1})).toBeVisible();
    await page.setViewportSize({width:1280,height:900});
    await page.getByRole('link',{name:'Quotes',exact:true}).click();await page.locator(`tr[data-quote-id="${quote.id}"]`).getByRole('button',{name:'Preview',exact:true}).click();
    await owner.getByRole('button',{name:'Revoke review link',exact:true}).click();await expect(owner).toContainText('This estimate is no longer editable.');await recipient.reload();await expect(recipient.getByRole('status')).toContainText('unavailable');
  }finally{await context.close();}
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.locator('#accepted-invoice-root')).toHaveCount(0);
  await page.goto('/#/invoices');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  for(const table of ['messages','calls','websites'])expect((await db.query(`select count(*)::int n from public.${table} where user_id=$1`,[user])).rows[0].n).toBe(0);
  expect(forbidden).toBe(0);expect(errors).toEqual([]);
});

test('independently expired and revoked synthetic links fail closed',async({browser})=>{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});const page=await ctx.newPage();
  await page.route('**/*',r=>isLocalCrmQaUrl(r.request().url())?r.continue():r.abort());
  try{for(const mode of ['expired','revoked']){
    const contact=`gate-${randomUUID()}`,quote=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
    await db.query("insert into public.contacts(id,user_id,name) values($1,$2,'Synthetic gate')",[contact,user]);
    await db.query("insert into public.quotes(id,user_id,contact_id,status,total_amount,selected_tier,request_key,request_fingerprint) values($1,$2,$3,'draft',90,'basic',$4,'synthetic')",[quote,user,contact,randomUUID()]);
    await db.query("insert into public.quote_items(user_id,quote_id,service_name,description,quantity,unit_price,tier,order_index) values($1,$2,'Synthetic gate wash','Scope',1,90,'basic',0)",[user,quote]);
    await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    const review=(await db.query("select public.create_crm_quote_review($1,1,$2,$3,'Synthetic gate') result",[quote,randomUUID(),token])).rows[0].result;await db.query('commit');
    await page.goto('http://127.0.0.1:4218/#/estimate-review/'+token);await expect(page.getByRole('heading',{name:'Review estimate',exact:true})).toBeVisible();
    if(mode==='expired'){
      await db.query("update private.crm_quote_reviews set expires_at=clock_timestamp()-interval '1 minute' where id=$1 and user_id=$2",[review.id,user]);
      expect((await db.query('select revoked_at from private.crm_quote_reviews where id=$1',[review.id])).rows[0].revoked_at).toBeNull();
    }else{
      await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
      await db.query('select public.revoke_crm_quote_review($1)',[review.id]);await db.query('commit');
    }
    await page.reload();await expect(page.getByRole('status')).toContainText('unavailable');await expect(page.getByRole('button',{name:'Confirm estimate response',exact:true})).toHaveCount(0);
  }}finally{await ctx.close();}
});
