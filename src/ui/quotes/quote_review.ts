import { isCrmApplicationHost } from '../../application_host';
/** Same trusted CRM host boundary as the existing application; authorization is server-side. */
export function allowsEstimateReview(origin: string, backend: string): boolean {
  try {
    const app=new URL(origin),api=new URL(backend);
    const loopback=['localhost','127.0.0.1','[::1]'].includes(app.hostname);
    return isCrmApplicationHost(app.hostname) && (app.protocol==='https:' || (loopback&&app.protocol==='http:'))
      && api.protocol==='https:' && !api.username && !api.password && !api.search && !api.hash && api.pathname==='/';
  } catch { return false; }
}
export interface ReviewClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: {message: string} | null}> }
type Row = Record<string, any>;
function object(data: unknown): Row {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid estimate review response.');
  return data as Row;
}
async function rpc(client: ReviewClient, name: string, args: Record<string, unknown>) {
  const result = await client.rpc(name, args);
  if (result.error) throw Error('The request could not be confirmed. Retry the same request, or reload to check its status.');
  return result.data;
}
function element<K extends keyof HTMLElementTagNameMap>(name: K, text?: string) {
  const node = document.createElement(name); if (text !== undefined) node.textContent = text; return node;
}
function button(text: string, action: () => void) { const b=element('button',text);b.type='button';b.className='wo-button wo-button--secondary';b.addEventListener('click',action);return b; }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''); }
const money = (value: unknown) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
export function reviewItemTotal(items: {total: unknown}[]): number {
  return items.reduce((cents,item)=>cents+Math.round(Number(item.total)*100),0)/100;
}
export function validateOwnerReviewResult(name: string, value: unknown, args: Record<string,unknown>): Row {
  const r=object(value);
  if(name==='record_crm_quote_review_acceptance') {
    if(r.quote_id!==args.expected_quote_id || r.status!=='approved' || r.revision!==Number(args.expected_revision)+1 || typeof r.replayed!=='boolean')throw Error('Acceptance outcome could not be confirmed. Retry the same request.');
  }else if(typeof r.id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)
    || r.quote_id!==args.expected_quote_id || !Number.isInteger(r.revision)
    || typeof r.expires_at!=='string' || !Number.isFinite(Date.parse(r.expires_at))
    || (name==='create_crm_quote_review' && (r.revision!==args.p_revision || r.customer_text!==args.p_customer_text))
    || (name==='revoke_crm_quote_review' && (r.id!==args.p_review_id || typeof r.revoked_at!=='string')))throw Error('Review outcome could not be confirmed. Retry the same request.');
  return r;
}
export function validateRecipientReviewResult(value: unknown, args: Record<string,unknown>, revision: number, expectedTotal: number): Row {
  const r=object(value);
  if(r.state!=='response_received'||r.revision!==revision||r.tier!==args.p_tier||r.total!==expectedTotal||r.currency!=='USD'||typeof r.received_at!=='string')throw Error('Response outcome could not be confirmed. Retry the same response.');
  return r;
}

export function mountOwnerQuoteReview(root: HTMLElement, options: {
  client: ReviewClient; quoteId: string; revision: number; canGenerate: boolean; ready(): boolean; current(): boolean; recorded(): void;
}) {
  let busy=false,loaded=false,rows: Row[]=[],rawLink='',rawReviewId='',message='Loading review status.',text='',loadSequence=0;
  let pending: {name: string; args: Record<string, unknown>; token?: string} | undefined;
  const current=()=>root.isConnected&&options.current();
  async function load() {
    const sequence=++loadSequence;loaded=false;
    try { const data=await rpc(options.client,'read_crm_quote_reviews',{p_quote_id:options.quoteId});if(!Array.isArray(data))throw Error();if(!current()||sequence!==loadSequence)return;rows=data.map(object);message='';loaded=true;
      if(!rows.some(r=>r.id===rawReviewId&&!r.revoked_at)){rawLink='';rawReviewId='';} }
    catch { if(current()&&sequence===loadSequence){loaded=false;message='Review status unavailable. Reload status to retry.';} }
    if(current()&&sequence===loadSequence)paint();
  }
  async function execute() {
    if(!current()||busy||!pending)return;busy=true;message='Saving. Keep this page open to confirm the outcome.';paint();
    const request=pending;
    try {
      const args={...request.args};delete args.expected_quote_id;delete args.expected_revision;
      const result=validateOwnerReviewResult(request.name,await rpc(options.client,request.name,args),request.args);if(!current())return;
      if(request.token){rawLink=`${location.origin}/#/estimate-review/${request.token}`;rawReviewId=result.id;}
      pending=undefined;message='Saved.';
      if(request.name==='record_crm_quote_review_acceptance'){options.recorded();return;}
      if(request.name==='revoke_crm_quote_review')rawLink='';
      await load();
    } catch(error) {if(current())message=(error as Error).message||'Request outcome unavailable. Retry the same request.';}
    finally{busy=false;if(current())paint();}
  }
  function start(name: string,args: Record<string,unknown>,rawToken?: string) {
    if(pending||busy||!current())return;
    if(name!=='revoke_crm_quote_review'&&!options.ready()){message='Save, cancel or refresh the service-location selection first.';paint();return;}
    pending={name,args:{...args,expected_quote_id:options.quoteId,expected_revision:options.revision},token:rawToken};void execute();
  }
  function paint() {
    if(!current())return;root.replaceChildren();root.className='wo-card no-print';
    root.append(element('h2','Customer estimate review'));
    root.append(element('p','A link is not proof of delivery. Recipient confirmation is recorded by the owner in a separate step. Links expire after 24 hours.'));
    const status=element('p',message);status.setAttribute('role','status');root.append(status);
    if(pending){const retry=button('Retry review request',()=>void execute());retry.disabled=busy;root.append(retry);return;}
    root.append(button('Reload review status',()=>void load()));
    if(!loaded)return;
    const active=rows.find(r=>!r.revoked_at);
    if(active){
      root.append(element('p',`Revision ${active.revision}. Link access expires ${new Date(active.expires_at).toLocaleString()}.`));
      if(active.responded_at)root.append(element('p',`Recipient response: ${active.signer_name}, ${active.tier}, ${money(active.total)}. This name is self-declared, not verified identity.`));
      if(active.finalized)root.append(element('p','Response recorded as estimate acceptance.'));
      else if(active.responded_at)root.append(button('Record customer response as acceptance',()=>start('record_crm_quote_review_acceptance',{p_review_id:active.id,p_request_key:crypto.randomUUID()})));
      root.append(button('Revoke review link',()=>start('revoke_crm_quote_review',{p_review_id:active.id})));
      if(rawLink){const label=element('label','Review link (anyone holding it can view this estimate)');const input=element('input');input.readOnly=true;input.value=rawLink;input.style.width='100%';label.append(input);root.append(label);root.append(button('Copy review link',()=>{void navigator.clipboard.writeText(rawLink).then(()=>{if(current()){message='Link copied. Delivery has not been recorded.';paint();}},()=>{if(current()){message='Copy unavailable. Select and copy the displayed link.';paint();}});}));}
      else root.append(element('p','The raw link is not stored. If you lost it, revoke and generate a replacement.'));
    }else if(options.canGenerate){
      const label=element('label','Customer-facing estimate message (optional)');const input=element('textarea');input.maxLength=2000;input.value=text;input.style.width='100%';input.addEventListener('input',()=>{text=input.value;});label.append(input);root.append(label);
      root.append(element('p','Only this message, estimate line items, pricing options and service address will be disclosed. Internal notes and billing/contact details stay private.'));
      root.append(button('Generate review link',()=>{const raw=token();start('create_crm_quote_review',{p_quote_id:options.quoteId,p_revision:options.revision,p_request_key:crypto.randomUUID(),p_token:raw,p_customer_text:text},raw);}));
    }else root.append(element('p','No active review link. This estimate is no longer editable.'));
  }
  paint();void load();
}

export function mountRecipientQuoteReview(root: HTMLElement, options: {client: ReviewClient; token: string; current(): boolean}) {
  let data: Row|undefined,busy=false,message='Loading estimate.',pending: Record<string,unknown>|undefined;
  let tier='',name='',confirmed=false;
  const current=()=>root.isConnected&&options.current();
  async function load() {
    if(busy)return;busy=true;
    try{const result=object(await rpc(options.client,'read_crm_quote_review',{p_token:options.token}));if(!current())return;data=result;message='';}
    catch{if(current()){data=undefined;message='This link is unavailable, expired, revoked or the estimate changed. Ask the business for a replacement.';}}
    finally{busy=false;if(current())paint();}
  }
  async function submit() {
    if(!current()||busy||!data)return;
    if(!pending){if(!tier||!name.trim()||!confirmed){message='Choose an option, enter your name and confirm the scope and price.';paint();return;}
      pending={p_token:options.token,p_request_key:crypto.randomUUID(),p_tier:tier,p_signer_name:name,p_confirm:true};}
    busy=true;message='Recording your response.';paint();
    try{const expectedTotal=reviewItemTotal((data.items as Row[]).filter(i=>i.tier===pending!.p_tier) as {total: unknown}[]);
      validateRecipientReviewResult(await rpc(options.client,'respond_crm_quote_review',pending),pending,data.revision,expectedTotal);
      if(!current())return;pending=undefined;data.state='response_received';message='Your response was received. The business still needs to record acceptance.';}
    catch(error){if(current())message=(error as Error).message;}
    finally{busy=false;if(current())paint();}
  }
  function paint(){
    if(!current())return;root.replaceChildren();root.append(element('h1','Review estimate'));
    const status=element('p',message);status.setAttribute('role','status');root.append(status);
    if(!data){const retry=button('Retry estimate review',()=>void load());retry.disabled=busy;root.append(retry);return;}
    root.append(element('p',`Frozen revision ${data.revision}. Link access expires ${new Date(data.expires_at).toLocaleString()}. Currency: USD.`));
    if(data.customer_text)root.append(element('p',String(data.customer_text)));
    const address=data.service_location;if(address)root.append(element('p',['service_address_line1','service_address_line2','locality','administrative_area','postal_code','country_code'].map(k=>address[k]).filter(Boolean).join(', ')));
    else root.append(element('p','No service location recorded.'));
    const items=Array.isArray(data.items)?data.items.map(object):[];
    const tiers=['basic','standard','premium'].filter(t=>items.some(i=>i.tier===t));
    for(const t of tiers){const section=element('section');section.append(element('h2',`${t} — ${money(reviewItemTotal(items.filter(i=>i.tier===t) as {total: unknown}[]))}`));
      for(const i of items.filter(i=>i.tier===t))section.append(element('p',`${i.service_name}: ${i.description||''} — ${i.quantity} × ${money(i.unit_price)} = ${money(i.total)}`));root.append(section);}
    if(data.state!=='awaiting_response'){root.append(element('p',data.state==='owner_recorded'?'The business recorded acceptance.':'Your response was received. The business still needs to record acceptance.'));return;}
    const disabled=busy||Boolean(pending);
    const tierLabel=element('label','Choose estimate option');const select=element('select');select.append(new Option('Choose an option',''));for(const t of tiers)select.append(new Option(t,t));select.value=tier;select.disabled=disabled;select.addEventListener('change',()=>{tier=select.value;});tierLabel.append(select);root.append(tierLabel);
    const nameLabel=element('label','Your name');const input=element('input');input.value=name;input.maxLength=200;input.disabled=disabled;input.addEventListener('input',()=>{name=input.value;});nameLabel.append(input);root.append(nameLabel);
    const confirmLabel=element('label','I confirm the displayed scope and price for my selected option.');const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=confirmed;checkbox.disabled=disabled;checkbox.addEventListener('change',()=>{confirmed=checkbox.checked;});confirmLabel.prepend(checkbox);root.append(confirmLabel);
    const send=button(pending?'Retry same response':'Confirm estimate response',()=>void submit());send.disabled=busy;root.append(send);
    root.append(element('p','This records your response for the business to review. No payment is taken and no additional terms are implied.'));
  }
  paint();void load();
}
