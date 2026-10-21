import { CrmMutationError, normalizeServicePropertyDraft, type ServicePropertyDraft, type ServicePropertyCreateInput, type ServicePropertyCreateResult } from '../../crm_production_mutations';
import { escapeHtmlText as escape } from '../../crm_html_output';
import { renderField, renderInput } from '../primitives';

interface Dependencies {
  create(input: ServicePropertyCreateInput): Promise<ServicePropertyCreateResult>;
  current(): boolean;
  created(result: ServicePropertyCreateResult): void;
  requestKey(): string;
}
const empty = (): ServicePropertyDraft => ({ serviceAddressLine1: '', locality: '', countryCode: '' });
export class ServicePropertyCreateController {
  open = false;
  phase: 'editing' | 'saving' | 'uncertain' | 'conflict' = 'editing';
  draft = empty();
  message = '';
  private pending?: ServicePropertyCreateInput;
  constructor(readonly contactId: string, private dependencies: Dependencies, private changed: () => void = () => {}) {}
  begin() { if (!this.dependencies.current() || this.open) return; this.open = true; this.phase = 'editing'; this.draft = empty(); this.message = ''; this.changed(); }
  edit(key: keyof ServicePropertyDraft, value: string) { if (this.open && this.phase === 'editing' && this.dependencies.current()) this.draft[key] = value; }
  cancel() { if (!this.open || this.phase === 'saving' || this.phase === 'uncertain') return; this.open = false; this.pending = undefined; this.draft = empty(); this.message = ''; this.changed(); }
  async save() {
    if (!this.open || !this.dependencies.current() || !['editing','uncertain'].includes(this.phase)) return;
    try {
      this.pending ??= { ...normalizeServicePropertyDraft(this.draft), contactId: this.contactId, requestKey: this.dependencies.requestKey() };
    } catch (error) { this.message = error instanceof CrmMutationError ? error.message : 'Check the address fields.'; this.changed(); return; }
    this.phase = 'saving'; this.message = ''; this.changed();
    try {
      const result = await this.dependencies.create(this.pending);
      if (!this.dependencies.current()) return;
      if (result.property.contact_id !== this.contactId) throw new CrmMutationError('INVALID_RESPONSE');
      this.open = false; this.pending = undefined; this.draft = empty(); this.phase = 'editing';
      this.dependencies.created(result);
    } catch (error) {
      if (!this.dependencies.current()) return;
      if (error instanceof CrmMutationError && error.code === 'INVALID_INPUT') {
        this.phase = 'editing'; this.pending = undefined; this.message = error.message;
      } else if (error instanceof CrmMutationError && error.code === 'CONFLICT') {
        this.phase = 'conflict'; this.message = 'This request could not create a new location. Close and refresh before starting another.';
      } else {
        this.phase = 'uncertain'; this.message = 'Creation could not be confirmed. Retry the same request. If you leave this page, check existing locations before creating another; the first request may have saved.';
      }
    }
    this.changed();
  }
}

const fields: Array<[keyof ServicePropertyDraft,string,number,boolean,string]> = [
  ['label','Location label (optional)',120,false,'off'], ['serviceAddressLine1','Service street address',200,true,'address-line1'],
  ['serviceAddressLine2','Address line 2 (optional)',200,false,'address-line2'], ['locality','Service city',120,true,'address-level2'],
  ['administrativeArea','Province or state (optional)',120,false,'address-level1'], ['postalCode','Postal code (optional)',32,false,'postal-code'],
  ['countryCode','Country code (two letters)',2,true,'country']
];
export function renderServicePropertyCreate(controller: ServicePropertyCreateController) {
  if (!controller.open) return '<button type="button" class="wo-button wo-button--secondary" data-property-add>Add service location</button>';
  const locked = controller.phase !== 'editing';
  const controls = fields.map(([key,label,max,required,autocomplete]) => renderField({ id: `new-property-${key}`, label, required,
    controlHtml: renderInput({ id: `new-property-${key}`, value: controller.draft[key] ?? '', disabled: locked, required,
      attributes: { 'data-property-field': key, maxlength: String(max), autocomplete } }) })).join('');
  return `<form data-property-form novalidate aria-label="Create washing service address" aria-busy="${controller.phase === 'saving'}"><h3>Add service location</h3><p>Enter the washing service address. Billing details are not copied. Creating a location does not send or accept this estimate.</p>${controls}${controller.message ? `<p role="alert" tabindex="-1" data-property-error>${escape(controller.message)}</p>` : ''}<button class="wo-button wo-button--primary" type="submit" ${['saving','conflict'].includes(controller.phase) ? 'disabled' : ''}>${controller.phase === 'saving' ? 'Creating location…' : controller.phase === 'uncertain' ? 'Retry location creation' : 'Create service location'}</button> <button type="button" class="wo-button wo-button--secondary" data-property-cancel ${['saving','uncertain'].includes(controller.phase) ? 'disabled' : ''}>Cancel location creation</button></form>`;
}
export function mountServicePropertyCreate(root: HTMLElement, controller: ServicePropertyCreateController) {
  root.querySelector('[data-property-add]')?.addEventListener('click', () => { controller.begin(); root.querySelector<HTMLInputElement>('[data-property-field="serviceAddressLine1"]')?.focus(); });
  root.querySelectorAll<HTMLInputElement>('[data-property-field]').forEach(input => input.addEventListener('input', () => controller.edit(input.dataset.propertyField as keyof ServicePropertyDraft, input.value)));
  root.querySelector('[data-property-form]')?.addEventListener('submit', event => { event.preventDefault(); void controller.save().then(() => { if (controller.open) root.querySelector<HTMLElement>('[data-property-error]')?.focus(); else root.querySelector<HTMLSelectElement>('#quote-service-location')?.focus(); }); });
  const cancel = () => { controller.cancel(); root.querySelector<HTMLButtonElement>('[data-property-add]')?.focus(); };
  root.querySelector('[data-property-cancel]')?.addEventListener('click', cancel);
  root.querySelector('[data-property-form]')?.addEventListener('keydown', event => { if ((event as KeyboardEvent).key === 'Escape') { event.preventDefault(); cancel(); } });
}
