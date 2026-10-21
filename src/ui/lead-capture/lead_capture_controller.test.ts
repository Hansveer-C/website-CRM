import { describe, it, expect, vi } from 'vitest';
import { LeadCaptureController, normalizeLeadCaptureDraft } from './lead_capture_controller';
import { CrmMutationError, type InternalLeadResult } from '../../crm_production_mutations';
import { isLocalCrmQaUrl, isLocalCrmQaBackendUrl } from '../../../tests/fixtures/local_crm_browser_guard';
import { ProtectedAsyncOperationGuard } from '../../website_dashboard_hydration_guard';

const draft = { name:'  Synthetic   Wash ', phone:'613-555-0101', email:' QA@EXAMPLE.TEST ', address:' 10 Fixture Lane ', serviceType:'Residential Pressure Washing', message:' Synthetic only ' };
const result = () => ({contact:{id:'contact-a',user_id:'owner-a'},opportunity:{id:'opportunity-a',user_id:'owner-a',contact_id:'contact-a'},isRepeat:false,replayed:false}) as InternalLeadResult;
function setup() {
  let current=true;
  const dependencies={create:vi.fn().mockResolvedValue(result()),current:()=>current,created:vi.fn(),cancelled:vi.fn(),requestKey:vi.fn(()=> 'request-1')};
  const controller=new LeadCaptureController('owner-a',dependencies);Object.assign(controller.draft,draft);
  return {controller,dependencies,leave:()=>current=false,return:()=>current=true};
}
describe('authenticated lead capture',()=>{
  it('does not redirect after a new navigation invocation starts, even before its view renders',async()=>{
    const s=setup(), guard=new ProtectedAsyncOperationGuard();
    const navigation=guard.bindCurrent(guard.beginUnbound('application-navigation'),'owner-a')!;
    s.dependencies.current=()=>guard.isCurrent(navigation,'owner-a');
    let finish!:(value:InternalLeadResult)=>void;s.dependencies.create.mockImplementation(()=>new Promise(r=>finish=r));
    const saving=s.controller.save();guard.beginUnbound('application-navigation');finish(result());await saving;
    expect(s.controller.phase).toBe('saved');expect(s.dependencies.created).not.toHaveBeenCalled();
  });
  it('blocks matching external URLs before specialized browser routes can fetch or continue',()=>{
    const path='/rest/v1/rpc/create_internal_crm_lead';
    expect(isLocalCrmQaBackendUrl(`https://127.0.0.1:56429${path}`,path)).toBe(true);
    for(const value of [`https://remote.example${path}`,`https://127.0.0.1:56429@remote.example${path}`,`https://127.0.0.1.evil:56429${path}`,`http://127.0.0.1:56429${path}`,`https://127.0.0.1:56429/api/websites/generate`,'not a URL']){expect(isLocalCrmQaUrl(value)).toBe(false);expect(isLocalCrmQaBackendUrl(value,path)).toBe(false);}
    expect(isLocalCrmQaBackendUrl('https://remote.example/rest/v1/contacts?select=*','/rest/v1/contacts')).toBe(false);
    expect(isLocalCrmQaUrl('https://127.0.0.1:56429/rest/v1/rpc/accept_crm_quote')).toBe(false);
  });
  it('normalizes identity and bounds the existing form fields',()=>{
    expect(normalizeLeadCaptureDraft(draft)).toMatchObject({name:'Synthetic Wash',email:'qa@example.test',address:'10 Fixture Lane',message:'Synthetic only'});
    for(const key of Object.keys(draft))expect(()=>normalizeLeadCaptureDraft({...draft,[key]:' '})).toThrow();
    expect(()=>normalizeLeadCaptureDraft({...draft,name:'x'.repeat(201)})).toThrow();
    expect(()=>normalizeLeadCaptureDraft({...draft,email:'bad-address'})).toThrow();
  });
  it('validates before allocating a key or calling persistence',async()=>{const {controller:c,dependencies:d}=setup();c.draft.name=' ';await c.save();expect(c.phase).toBe('editing');expect(c.message).toContain('name');expect(d.create).not.toHaveBeenCalled();expect(d.requestKey).not.toHaveBeenCalled();});
  it('sends existing lead input only and completes once',async()=>{const {controller:c,dependencies:d}=setup();await c.save();expect(d.create).toHaveBeenCalledWith({...normalizeLeadCaptureDraft(draft),requestKey:'request-1',source:'internal'});expect(d.created).toHaveBeenCalledOnce();expect(c.phase).toBe('saved');});
  it('coalesces concurrent clicks and disables cancellation/editing',async()=>{const {controller:c,dependencies:d}=setup();let finish!:(v:InternalLeadResult)=>void;d.create.mockImplementation(()=>new Promise(r=>finish=r));const saving=c.save();c.edit('name','Changed');c.cancel();await c.save();expect(c.draft.name).toBe(draft.name);expect(d.create).toHaveBeenCalledOnce();expect(d.cancelled).not.toHaveBeenCalled();finish(result());await saving;});
  it('retries unknown outcomes with the identical frozen intent/key',async()=>{const {controller:c,dependencies:d}=setup();d.create.mockRejectedValueOnce(new Error('private transport detail'));await c.save();expect(c.phase).toBe('uncertain');expect(c.message).not.toContain('private');c.edit('name','Changed');c.cancel();await c.save();expect(d.create.mock.calls[1][0]).toEqual(d.create.mock.calls[0][0]);expect(d.requestKey).toHaveBeenCalledOnce();});
  it('retains uncertain intent across navigation and resumes safely',async()=>{const s=setup();s.dependencies.create.mockRejectedValueOnce(new Error('lost'));await s.controller.save();s.leave();await s.controller.save();expect(s.dependencies.create).toHaveBeenCalledOnce();s.return();await s.controller.save();expect(s.dependencies.create.mock.calls[1][0].requestKey).toBe('request-1');});
  it('keeps a late committed result without navigating or mutating another view',async()=>{const s=setup();let finish!:(v:InternalLeadResult)=>void;s.dependencies.create.mockImplementation(()=>new Promise(r=>finish=r));const p=s.controller.save();s.leave();finish(result());await p;expect(s.controller.phase).toBe('saved');expect(s.dependencies.created).not.toHaveBeenCalled();s.return();await s.controller.save();expect(s.dependencies.created).toHaveBeenCalledOnce();expect(s.dependencies.create).toHaveBeenCalledOnce();});
  it('does not accept foreign-owner or mismatched graph results',async()=>{for(const invalid of [{...result(),contact:{...result().contact,user_id:'other'}},{...result(),opportunity:{...result().opportunity,contact_id:'other'}},{...result(),opportunity:{...result().opportunity,user_id:'other'}}]){const s=setup();s.dependencies.create.mockResolvedValue(invalid);await s.controller.save();expect(s.controller.phase).toBe('uncertain');expect(s.dependencies.created).not.toHaveBeenCalled();}});
  it('permits correction/cancel only after known validation or permission rejection',async()=>{const s=setup();s.dependencies.create.mockRejectedValue(new CrmMutationError('INVALID_INPUT','Lead access changed.'));await s.controller.save();expect(s.controller.phase).toBe('editing');s.controller.edit('name','Correction');s.controller.cancel();expect(s.dependencies.cancelled).toHaveBeenCalledOnce();});
  it('keeps conflicts fail-closed until the user cancels/reviews records',async()=>{const s=setup();s.dependencies.create.mockRejectedValue(new CrmMutationError('CONFLICT'));await s.controller.save();expect(s.controller.phase).toBe('conflict');await s.controller.save();expect(s.dependencies.create).toHaveBeenCalledOnce();s.controller.cancel();expect(s.dependencies.cancelled).toHaveBeenCalledOnce();});
});
