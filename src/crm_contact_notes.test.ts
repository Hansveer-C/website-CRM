import { describe, it, expect, vi } from 'vitest';
import { createContactNote, normalizeContactNote, type ContactNoteInput, type ContactNoteResult } from './crm_contact_notes';
import { CrmMutationError } from './crm_production_mutations';
import { ContactNoteController } from './ui/contacts/contact_note';
import { contactNoteAttempt, clearContactNoteAttempts } from './ui/contacts/contact_note_attempt';
import { renderHydratedContactActivity } from './crm_contact_detail';
import { ProtectedAsyncOperationGuard } from './website_dashboard_hydration_guard';

const input:ContactNoteInput={requestKey:'10000000-0000-4000-8000-000000000001',contactId:'contact',text:'Internal note'};
const row={id:'note',contact_id:'contact',type:'note',description:input.text,due_date:null,completed:true,created_at:'2026-10-21T00:00:00Z'};
const saved:ContactNoteResult={activity:{...row,type:'note',due_date:''},replayed:false};
function storage() {
  const values=new Map<string,string>();
  return {get length(){return values.size;},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);},clear:()=>values.clear()} as Storage;
}
function setup(overrides:Record<string,unknown>={}) {
  const dependencies={current:()=>true,create:vi.fn(async()=>saved),saved:vi.fn(),cancelled:vi.fn(),requestKey:()=>input.requestKey,...overrides};
  const controller=new ContactNoteController('contact',dependencies);return {controller,dependencies};
}
describe('contact note adapter',()=>{
  it('sends exactly the server-authorized parameters and parses safe fields',async()=>{
    const rpc=vi.fn(async()=>({data:{activity:row,replayed:false},error:null}));
    expect(await createContactNote({rpc},input)).toEqual(saved);
    expect(rpc).toHaveBeenCalledWith('create_crm_contact_note',{p_request_key:input.requestKey,p_contact_id:'contact',p_note:input.text});
  });
  it('normalizes only boundary whitespace and preserves newlines/Unicode/v',()=>{
    expect(normalizeContactNote('\u2000\uFEFFhello\nv\u00a0')).toBe('hello\nv');
    expect(()=>normalizeContactNote('\u2000\u00a0')).toThrow();expect(()=>normalizeContactNote('x'.repeat(5001))).toThrow();
    expect(normalizeContactNote('🙂'.repeat(5000))).toHaveLength(10000);
    expect(()=>normalizeContactNote('a\0b')).toThrow();expect(()=>normalizeContactNote('\uD800')).toThrow();
  });
  it.each(['42501','22023','23505','40001','XX000'])('classifies SQLSTATE %s',async code=>{
    const rpc=async()=>({data:null,error:{code}});
    await expect(createContactNote({rpc},input)).rejects.toMatchObject({code:['23505','40001'].includes(code)?'CONFLICT':['42501','22023'].includes(code)?'INVALID_INPUT':'UNAVAILABLE'});
  });
  it.each([{contact_id:'foreign'},{description:'changed'},{type:'call'},{due_date:'2026-10-21'},{created_at:'invalid'},{completed:false}])('rejects inconsistent server activity %j',async patch=>{
    await expect(createContactNote({rpc:async()=>({data:{activity:{...row,...patch},replayed:false},error:null})},input)).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
  it('does not call RPC with an invalid request or text',async()=>{
    const rpc=vi.fn();await expect(createContactNote({rpc},{...input,requestKey:'bad'})).rejects.toThrow();
    await expect(createContactNote({rpc},{...input,text:''})).rejects.toThrow();expect(rpc).not.toHaveBeenCalled();
  });
  it('keeps text repairable when the schema has not deployed the new RPC yet',async()=>{
    await expect(createContactNote({rpc:async()=>({data:null,error:{code:'PGRST202'}})},input)).rejects.toMatchObject({code:'INVALID_INPUT'});
  });
});
describe('contact note retry and navigation controller',()=>{
  it('validates before saving and cancels without mutation',async()=>{
    const {controller:c,dependencies:d}=setup();await c.save();expect(d.create).not.toHaveBeenCalled();c.cancel();expect(d.cancelled).toHaveBeenCalledOnce();
  });
  it('coalesces double submit and ignores cancel/edit while saving',async()=>{
    let resolve!:(result:ContactNoteResult)=>void;const create=vi.fn(()=>new Promise<ContactNoteResult>(r=>resolve=r));
    const {controller:c,dependencies:d}=setup({create});c.edit(input.text);const saving=c.save();await c.save();c.cancel();c.edit('changed');
    expect(create).toHaveBeenCalledOnce();expect(d.cancelled).not.toHaveBeenCalled();expect(c.text).toBe(input.text);resolve(saved);await saving;expect(d.saved).toHaveBeenCalledOnce();
  });
  it('retains the exact key/text on unknown outcome and across a full reload',async()=>{
    const store=storage(),attempt=contactNoteAttempt(store,'owner','contact');
    const first=setup({...attempt,create:vi.fn(async()=>{throw new Error('response lost');})});first.controller.edit(input.text);await first.controller.save();
    first.controller.edit('different');first.controller.cancel();expect(first.controller.phase).toBe('uncertain');expect(first.dependencies.cancelled).not.toHaveBeenCalled();
    const second=setup({...contactNoteAttempt(store,'owner','contact')});expect(second.controller.phase).toBe('uncertain');await second.controller.save();
    expect(second.dependencies.create).toHaveBeenCalledWith(input);expect(store.length).toBe(0);
  });
  it('fails closed before RPC if the browser cannot retain safe retry state',async()=>{
    const {controller:c,dependencies:d}=setup({...contactNoteAttempt(undefined,'owner','contact')});c.edit(input.text);await c.save();
    expect(c.message).toContain('No note was sent');expect(d.create).not.toHaveBeenCalled();expect(c.phase).toBe('editing');
  });
  it('preserves an ambiguous original request through a transient retry-storage failure',async()=>{
    let available=true,first=true;
    const remember=vi.fn(()=>{if(!available)throw Error('Storage unavailable');});
    const create=vi.fn(async()=>{if(first){first=false;throw Error('Response lost');}return saved;});
    const {controller:c}=setup({remember,create});c.edit(input.text);await c.save();available=false;await c.save();
    expect(c.phase).toBe('uncertain');expect(create).toHaveBeenCalledTimes(1);available=true;await c.save();
    expect(create).toHaveBeenCalledTimes(2);expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  });
  it('uses the actual navigation guard to prevent late delivery',async()=>{
    const guard=new ProtectedAsyncOperationGuard(),token=guard.bindCurrent(guard.beginUnbound('application-navigation'),'owner')!;
    let resolve!:(result:ContactNoteResult)=>void;
    const {controller:c,dependencies:d}=setup({current:()=>guard.isCurrent(token,'owner'),create:()=>new Promise<ContactNoteResult>(r=>resolve=r)});
    c.edit(input.text);const p=c.save();guard.beginUnbound('application-navigation');resolve(saved);await p;
    expect(d.saved).not.toHaveBeenCalled();c.deliverSaved();expect(d.saved).not.toHaveBeenCalled();
  });
  it('allows deterministic validation repair but locks request conflicts',async()=>{
    const first=setup({create:async()=>{throw new CrmMutationError('INVALID_INPUT','Access changed');}});first.controller.edit(input.text);await first.controller.save();expect(first.controller.phase).toBe('editing');
    const second=setup({create:async()=>{throw new CrmMutationError('CONFLICT','Reload');}});second.controller.edit(input.text);await second.controller.save();expect(second.controller.phase).toBe('conflict');
    second.controller.edit('replacement');await second.controller.save();expect(second.controller.text).toBe(input.text);
  });
});
describe('same-tab interrupted request privacy',()=>{
  it('isolates owner/contact and removes only its own namespace on sign-out',()=>{
    const store=storage();store.setItem('unrelated','keep');contactNoteAttempt(store,'a','contact').remember(input);
    expect(contactNoteAttempt(store,'b','contact').restore()).toBeNull();expect(contactNoteAttempt(store,'a','other').restore()).toBeNull();
    clearContactNoteAttempts(store,'b');expect(contactNoteAttempt(store,'a','contact').restore()).toBeNull();expect(store.getItem('unrelated')).toBe('keep');
    contactNoteAttempt(store,'b','contact').remember(input);clearContactNoteAttempts(store);expect(store.length).toBe(1);
  });
  it('late completion cannot remove a newer same-owner request',()=>{
    const store=storage(),attempt=contactNoteAttempt(store,'owner','contact');attempt.remember({...input,requestKey:'20000000-0000-4000-8000-000000000002'});
    attempt.forget(input);expect(attempt.restore()?.requestKey).toBe('20000000-0000-4000-8000-000000000002');
  });
  it('escapes persisted note HTML and displays true creation time separately',()=>{
    const html=renderHydratedContactActivity('owner','contact',true,[{...saved.activity,user_id:'owner',description:'<img src=x onerror=alert(1)>\n& text'}]);
    expect(html).toContain('&lt;img');expect(html).not.toContain('<img');expect(html).toContain('\n&amp; text');expect(html).toContain('Created: 2026-10-21T00:00:00Z');expect(html).toContain('No due date');
  });
});
