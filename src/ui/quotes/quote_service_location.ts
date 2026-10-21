import { escapeHtmlText as escape } from '../../crm_html_output';
import { CrmMutationError, readAcceptedServiceLocation, type AcceptedServiceLocation, type QuoteServicePropertyInput, type QuoteServicePropertyResult, type ServicePropertyCreateInput, type ServicePropertyCreateResult } from '../../crm_production_mutations';
import { ServicePropertyCreateController, renderServicePropertyCreate, mountServicePropertyCreate } from './service_property_create';
import type { Quote, QuoteItem } from '../../types';
import { renderCard } from '../primitives';

export type ServiceLocation = Omit<AcceptedServiceLocation, 'schema_version' | 'property_id'> & { id: string; contact_id: string };
export interface LocationData { quote: Quote; locations: ServiceLocation[]; snapshot?: unknown; items?: QuoteItem[] }
export interface LocationDependencies {
  load(): Promise<LocationData>;
  save(input: QuoteServicePropertyInput): Promise<QuoteServicePropertyResult>;
  current(): boolean;
  updateQuote(quote: Quote, items?: QuoteItem[]): void;
  requestKey(): string;
  create?(input: ServicePropertyCreateInput): Promise<ServicePropertyCreateResult>;
}
export class QuoteServiceLocationController {
  data?: LocationData;
  phase: 'loading' | 'ready' | 'saving' | 'error' | 'conflict' = 'loading';
  message = '';
  selected = '';
  private pending?: QuoteServicePropertyInput;
  private generation = 0;
  readonly creator?: ServicePropertyCreateController;
  constructor(readonly quoteId: string, readonly contactId: string, readonly userId: string, private dependencies: LocationDependencies, private changed: () => void = () => {}) {
    if (dependencies.create) this.creator = new ServicePropertyCreateController(contactId, {
      create: input => dependencies.create!(input), requestKey: () => dependencies.requestKey(),
      current: () => dependencies.current() && this.phase === 'ready' && !this.pending && Boolean(this.data && ['draft','sent'].includes(this.data.quote.status)),
      created: result => {
        if (!this.data) return;
        this.data = { ...this.data, locations: [...this.data.locations.filter(row => row.id !== result.property.id), result.property] };
        this.selected = result.property.id;
        this.message = 'Location created. Save service location to associate it with this estimate.';
      }
    }, () => { if (this.creator?.open) this.message = ''; this.changed(); });
  }
  get busy() { return this.phase === 'saving' || this.creator?.phase === 'saving'; }
  get acceptanceBlocked() { return this.phase !== 'ready' || this.creator?.open === true || this.retryPending || this.selected !== (this.data?.quote.property_id ?? ''); }
  async load() {
    if (this.busy || this.creator?.open) return;
    const generation = ++this.generation;
    this.phase = 'loading'; this.message = ''; this.changed();
    try {
      const data = await this.dependencies.load();
      if (!this.dependencies.current() || generation !== this.generation) return;
      if (data.quote.id !== this.quoteId || data.quote.contact_id !== this.contactId || data.quote.user_id !== this.userId) throw new Error('Unavailable');
      if (data.quote.status === 'approved') readAcceptedServiceLocation(data.snapshot);
      this.data = { ...data, locations: data.locations.filter(row => row.contact_id === this.contactId) };
      this.selected = data.quote.property_id ?? '';
      // A successful refresh establishes current server truth after an uncertain write.
      this.pending = undefined;
      this.dependencies.updateQuote(data.quote, data.items);
      this.phase = 'ready';
    } catch {
      if (!this.dependencies.current() || generation !== this.generation) return;
      this.data = undefined; this.phase = 'error'; this.message = 'Service location could not be loaded. Try again.';
    }
    this.changed();
  }
  select(id: string) { if (this.phase === 'ready' && !this.pending && !this.creator?.open) { this.selected = id; this.message = ''; this.changed(); } }
  cancel() { if (this.phase === 'ready' && !this.pending && !this.creator?.open) { this.selected = this.data?.quote.property_id ?? ''; this.changed(); } }
  async save() {
    const quote = this.data?.quote;
    if (this.phase !== 'ready' || this.creator?.open || !quote || !['draft', 'sent'].includes(quote.status)) return;
    if (!this.pending && (!this.selected || this.selected === quote.property_id || !this.data?.locations.some(row => row.id === this.selected))) return;
    if (!Number.isInteger(quote.revision)) { this.phase = 'conflict'; this.message = 'Refresh this estimate before changing its service location.'; this.changed(); return; }
    this.pending ??= { quoteId: quote.id, expectedRevision: quote.revision!, propertyId: this.selected, requestKey: this.dependencies.requestKey() };
    const request = this.pending;
    this.phase = 'saving'; this.message = ''; this.changed();
    try {
      await this.dependencies.save(request);
      if (!this.dependencies.current()) return;
      // Replay may describe an older successful assignment. Reload instead of rolling local state back.
      this.phase = 'ready';
      await this.load();
    } catch (error) {
      if (!this.dependencies.current()) return;
      if (error instanceof CrmMutationError && error.code === 'CONFLICT') {
        this.phase = 'conflict'; this.message = 'This estimate changed. Refresh before choosing a service location again.';
      } else {
        this.phase = 'ready'; this.message = 'Save could not be confirmed. Retry the same selection or refresh to check its status.';
      }
      this.changed();
    }
  }
  get retryPending() { return Boolean(this.pending); }
}

/** Main preview integration: replace quote + items together, then synchronously render
 * before the acceptance handler can observe the refreshed revision. */
export function applyServiceLocationPreviewRefresh(previous: Quote, fresh: Quote, items: QuoteItem[], quotes: Quote[], allItems: QuoteItem[], render: () => void) {
  if (fresh.id !== previous.id || fresh.user_id !== previous.user_id || fresh.contact_id !== previous.contact_id
    || items.some(row => row.quote_id !== fresh.id || row.user_id !== fresh.user_id)) throw new Error('Unavailable');
  const existingItems = allItems.filter(row => row.quote_id === previous.id && row.user_id === previous.user_id);
  const changed = JSON.stringify(previous) !== JSON.stringify(fresh) || JSON.stringify(existingItems) !== JSON.stringify(items);
  const index = quotes.findIndex(row => row.id === fresh.id && row.user_id === fresh.user_id);
  if (index < 0) throw new Error('Unavailable');
  quotes[index] = fresh;
  for (let i = allItems.length - 1; i >= 0; i--) if (allItems[i].quote_id === fresh.id && allItems[i].user_id === fresh.user_id) allItems.splice(i, 1);
  allItems.push(...items);
  if (changed) render();
}

const address = (row: Omit<ServiceLocation, 'id' | 'contact_id'>) => [row.label, row.service_address_line1, row.service_address_line2, row.locality, row.administrative_area, row.postal_code, row.country_code].filter(Boolean).join(', ');
export function renderQuoteServiceLocation(controller: QuoteServiceLocationController): string {
  const data = controller.data;
  const refresh = '<button type="button" class="wo-button wo-button--secondary" data-location-refresh>Refresh service location</button>';
  let content = '';
  if (controller.phase === 'loading') content = '<p role="status">Loading service location…</p>';
  else if (controller.phase === 'error' || controller.phase === 'conflict') content = `<p role="alert">${escape(controller.message)}</p>${refresh}`;
  else if (data?.quote.status === 'approved') {
    const evidence = readAcceptedServiceLocation(data.snapshot);
    content = evidence.status === 'recorded'
      ? `<p>${escape(address(evidence.location))}</p><p>Service location recorded at acceptance. Later customer address changes do not alter this record.</p>`
      : `<p>${evidence.status === 'unassigned' ? 'No service location was assigned when this estimate was accepted.' : 'This older acceptance has no recorded service-location evidence.'}</p>`;
  } else if (data && ['draft', 'sent'].includes(data.quote.status)) {
    const saving = controller.busy;
    const locked = saving || controller.retryPending || controller.creator?.open;
    const options = data.locations.map(row => `<option value="${escape(row.id)}" ${row.id === controller.selected ? 'selected' : ''}>${escape(address(row))}</option>`).join('');
    content = data.locations.length ? `<label for="quote-service-location">Customer service location</label><select class="wo-field-select" id="quote-service-location" ${locked ? 'disabled' : ''}><option value="">Choose a service location</option>${options}</select><p>Choose where the work will take place. Saving updates this estimate before acceptance.</p><button type="button" class="wo-button wo-button--primary" data-location-save ${saving || controller.creator?.open || !controller.selected || (!controller.retryPending && controller.selected === data.quote.property_id) ? 'disabled' : ''}>${saving ? 'Saving…' : controller.retryPending ? 'Retry save' : 'Save service location'}</button> <button type="button" class="wo-button wo-button--secondary" data-location-cancel ${locked ? 'disabled' : ''}>Cancel selection</button>` : '<p>No service locations are available for this customer. No address has been inferred from billing details.</p>';
    if (!saving && !controller.creator?.open) content += refresh;
    if (controller.message) content += `<p role="alert">${escape(controller.message)}</p>`;
    if (controller.creator && !controller.retryPending) content += renderServicePropertyCreate(controller.creator);
  } else content = '<p>Service-location changes are unavailable for this estimate status.</p>';
  return `<section class="wo-quote-location" aria-labelledby="quote-location-heading" aria-busy="${controller.phase === 'loading' || controller.busy}">${renderCard({ bodyHtml: `<h2 id="quote-location-heading">Service location</h2>${content}` })}</section>`;
}
export function mountQuoteServiceLocation(root: HTMLElement, controller: QuoteServiceLocationController) {
  root.innerHTML = renderQuoteServiceLocation(controller);
  root.querySelector<HTMLSelectElement>('select')?.addEventListener('change', event => controller.select((event.target as HTMLSelectElement).value));
  root.querySelector('[data-location-save]')?.addEventListener('click', () => void controller.save());
  root.querySelector('[data-location-cancel]')?.addEventListener('click', () => controller.cancel());
  root.querySelector('[data-location-refresh]')?.addEventListener('click', () => void controller.load());
  if (controller.creator) mountServicePropertyCreate(root, controller.creator);
}
