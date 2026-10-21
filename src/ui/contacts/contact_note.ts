import { CrmMutationError } from '../../crm_production_mutations';
import { normalizeContactNote, type ContactNoteInput, type ContactNoteResult } from '../../crm_contact_notes';

interface Dependencies {
  current(): boolean;
  create(input: ContactNoteInput): Promise<ContactNoteResult>;
  saved(result: ContactNoteResult): void;
  cancelled(): void;
  requestKey(): string;
  restore?(): ContactNoteInput | null;
  remember?(input: ContactNoteInput): void;
  forget?(input?: ContactNoteInput): void;
}
export class ContactNoteController {
  text = '';
  phase: 'editing'|'saving'|'uncertain'|'conflict'|'saved' = 'editing';
  message = '';
  onChange?: () => void;
  private pending?: ContactNoteInput;
  private result?: ContactNoteResult;
  constructor(readonly contactId: string, private dependencies: Dependencies) {
    const pending=dependencies.restore?.();
    if (pending) {this.pending=pending;this.text=pending.text;this.phase='uncertain';this.message='An interrupted note request is saved in this tab. Retry the same text to confirm it.';}
  }
  isCurrent() { return this.dependencies.current(); }
  private changed() { if (this.dependencies.current()) this.onChange?.(); }
  edit(text: string) { if (this.phase === 'editing' && this.dependencies.current()) this.text=text; }
  cancel() { if (this.dependencies.current() && !['saving','uncertain'].includes(this.phase)) {this.dependencies.forget?.(this.pending);this.dependencies.cancelled();} }
  deliverSaved() { if (this.result && this.dependencies.current()) this.dependencies.saved(this.result); }
  async save() {
    if (!this.dependencies.current() || !['editing','uncertain'].includes(this.phase)) return;
    const retrying=this.phase==='uncertain';
    try { this.pending ??= {contactId:this.contactId,text:normalizeContactNote(this.text),requestKey:this.dependencies.requestKey()};this.dependencies.remember?.(this.pending); }
    catch (error) {
      if (retrying) this.message='The original note is still unconfirmed; its retry key is retained. Retry when session storage is available.';
      else {this.pending=undefined;this.message=(error as Error).message;}
      this.changed();return;
    }
    this.phase='saving';this.message='Saving note. If you leave, reopen Note for this contact to check or retry this request.';this.changed();
    try {
      const result=await this.dependencies.create(this.pending);
      if (result.activity.contact_id!==this.contactId) throw new CrmMutationError('INVALID_RESPONSE');
      this.result=result;this.phase='saved';this.dependencies.forget?.(this.pending);this.message='Note saved to activity history.';this.changed();this.deliverSaved();
    } catch(error) {
      if (error instanceof CrmMutationError && error.code === 'INVALID_INPUT') {this.dependencies.forget?.(this.pending);this.pending=undefined;this.phase='editing';this.message=error.message;}
      else if (error instanceof CrmMutationError && error.code === 'CONFLICT') {this.phase='conflict';this.message=error.message;}
      else {this.phase='uncertain';this.message='Note save could not be confirmed. Retry the same text. This tab preserves the request across reload until confirmed or signed out.';}
      this.changed();
    }
  }
}
export const contactNoteFormHtml = `<form id="contact-note-form" class="wo-contact-note-form" novalidate>
  <h2>Add internal note</h2><label for="contact-note-text">Note text</label>
  <textarea id="contact-note-text" class="wo-field-textarea" rows="5" maxlength="5000" aria-describedby="contact-note-help" required></textarea>
  <p id="contact-note-help">Internal activity only. This does not send a message. An unconfirmed save stays in this tab for safe retry until confirmed or signed out.</p>
  <div class="wo-contact-detail-actions"><button type="submit" class="wo-button wo-button--primary" id="contact-note-save">Save note</button>
  <button type="button" class="wo-button wo-button--secondary" id="contact-note-cancel">Cancel note</button></div>
  <p id="contact-note-status" role="status" aria-live="polite" tabindex="-1"></p></form>`;
export function mountContactNote(form: HTMLFormElement, controller: ContactNoteController) {
  const input=form.querySelector<HTMLTextAreaElement>('#contact-note-text')!;
  const save=form.querySelector<HTMLButtonElement>('#contact-note-save')!;
  const cancel=form.querySelector<HTMLButtonElement>('#contact-note-cancel')!;
  const status=form.querySelector<HTMLElement>('#contact-note-status')!;
  input.value=controller.text;
  input.addEventListener('input',()=>controller.edit(input.value));
  controller.onChange=()=>{
    input.disabled=controller.phase!=='editing';
    save.disabled=['saving','conflict','saved'].includes(controller.phase);
    save.textContent=controller.phase==='saving'?'Saving note.':controller.phase==='uncertain'?'Retry note save':'Save note';
    cancel.disabled=['saving','uncertain'].includes(controller.phase);
    cancel.textContent=controller.phase==='saved'?'Close note':'Cancel note';
    form.setAttribute('aria-busy',String(controller.phase==='saving'));
    status.textContent=controller.message;
  };
  controller.onChange();controller.deliverSaved();
  form.addEventListener('submit',event=>{event.preventDefault();void controller.save().then(()=>{if(form.isConnected && controller.isCurrent() && controller.message)status.focus();});});
  cancel.addEventListener('click',()=>controller.cancel());
  form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();controller.cancel();}});
  if (!input.disabled) input.focus();
}
