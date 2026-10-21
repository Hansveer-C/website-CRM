import { CrmMutationError, type InternalLeadInput, type InternalLeadResult } from '../../crm_production_mutations';
import { normalizeEmail, normalizeName } from '../../utils/validators';

export interface LeadCaptureDraft {
  name: string; phone: string; email: string; address: string; serviceType: string; message: string;
}
const fields: Array<[keyof LeadCaptureDraft, string, number, string]> = [
  ['name','full name',200,'lead_name'], ['phone','phone number',50,'lead_phone'],
  ['email','email address',200,'lead_email'], ['address','service address',500,'lead_address'],
  ['serviceType','service type',200,'lead_service_type'], ['message','message / details',5000,'lead_message']
];
export function normalizeLeadCaptureDraft(input: LeadCaptureDraft): LeadCaptureDraft {
  const draft = { ...input, name: normalizeName(input.name).replace(/\s+/g,' '), email: normalizeEmail(input.email) ?? '' };
  for (const [key,label,max] of fields) {
    draft[key] = draft[key].trim();
    if (!draft[key] || draft[key].length > max) throw new CrmMutationError('INVALID_INPUT',`Enter a ${label} of at most ${max} characters.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) throw new CrmMutationError('INVALID_INPUT','Enter a valid email address.');
  return draft;
}
interface Dependencies {
  create(input: InternalLeadInput): Promise<InternalLeadResult>;
  current(): boolean;
  created(result: InternalLeadResult): void;
  cancelled(): void;
  requestKey(): string;
}
export class LeadCaptureController {
  draft: LeadCaptureDraft = {name:'',phone:'',email:'',address:'',serviceType:'',message:''};
  phase: 'editing'|'saving'|'uncertain'|'conflict'|'saved' = 'editing';
  message = '';
  onChange?: () => void;
  private pending?: InternalLeadInput;
  private saved?: InternalLeadResult;
  private delivered = false;
  constructor(readonly ownerId: string, private dependencies: Dependencies) {}
  private changed() { if (this.dependencies.current()) this.onChange?.(); }
  edit(key: keyof LeadCaptureDraft, value: string) { if (this.phase === 'editing' && this.dependencies.current()) this.draft[key] = value; }
  cancel() { if (this.dependencies.current() && !['saving','uncertain'].includes(this.phase)) this.dependencies.cancelled(); }
  async save() {
    if (!this.dependencies.current()) return;
    if (this.phase === 'saved' && this.saved) { if (!this.delivered) { this.delivered=true; this.dependencies.created(this.saved); } return; }
    if (!['editing','uncertain'].includes(this.phase)) return;
    try { this.pending ??= {...normalizeLeadCaptureDraft(this.draft),requestKey:this.dependencies.requestKey(),source:'internal'}; }
    catch (error) { this.message=error instanceof CrmMutationError ? error.message : 'Review the lead fields.'; this.changed(); return; }
    this.phase='saving'; this.message='Saving lead. If you leave, reload Clients & Leads before starting another lead.'; this.changed();
    try {
      const result=await this.dependencies.create(this.pending);
      if (!result.contact.id || !result.opportunity.id || result.contact.user_id !== this.ownerId
          || result.opportunity.user_id !== this.ownerId || result.opportunity.contact_id !== result.contact.id) throw new CrmMutationError('INVALID_RESPONSE');
      this.saved=result; this.phase='saved'; this.message='Lead saved. View it in Clients & Leads.'; this.changed();
      if (this.dependencies.current()) { this.delivered=true; this.dependencies.created(result); }
    } catch (error) {
      if (error instanceof CrmMutationError && error.code === 'INVALID_INPUT') { this.pending=undefined; this.phase='editing'; this.message=error.message; }
      else if (error instanceof CrmMutationError && error.code === 'CONFLICT') { this.phase='conflict'; this.message='Lead details conflict with existing records. Reload Clients & Leads and review them before starting another lead.'; }
      else { this.phase='uncertain'; this.message='Lead creation could not be confirmed. Retry the same details. If you leave, reload Clients & Leads before starting another lead.'; }
      this.changed();
    }
  }
}
export function mountLeadCapture(form: HTMLFormElement, controller: LeadCaptureController) {
  form.noValidate=true;
  const controls=fields.map(([key,,max,id])=>{
    const input=form.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>(`#${id}`)!;
    input.value=controller.draft[key];
    if (!(input instanceof HTMLSelectElement)) input.maxLength=max;
    const update=()=>controller.edit(key,input.value); input.addEventListener('input',update); input.addEventListener('change',update);
    return input;
  });
  const submit=form.querySelector<HTMLButtonElement>('#lead-submit')!;
  const cancel=form.querySelector<HTMLButtonElement>('#lead-cancel')!;
  const status=form.querySelector<HTMLElement>('#lead-submit-status')!;
  controller.onChange=()=>{
    controls.forEach(input=>input.disabled=controller.phase !== 'editing');
    submit.disabled=['saving','conflict'].includes(controller.phase);
    submit.textContent=controller.phase === 'saving' ? 'Saving lead.' : controller.phase === 'uncertain' ? 'Retry lead creation' : controller.phase === 'saved' ? 'View saved lead' : 'Submit lead info';
    submit.setAttribute('aria-label',submit.textContent);
    cancel.disabled=['saving','uncertain'].includes(controller.phase);
    form.setAttribute('aria-busy',String(controller.phase === 'saving'));
    status.textContent=controller.message;
    status.setAttribute('role',controller.phase === 'saved' || controller.phase === 'saving' ? 'status' : 'alert');
  };
  controller.onChange();
  form.addEventListener('submit',event=>{event.preventDefault();void controller.save().then(()=>{if(form.isConnected && controller.message && controller.phase !== 'saving')status.focus();});});
  cancel.addEventListener('click',()=>controller.cancel());
  form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();controller.cancel();}});
}
