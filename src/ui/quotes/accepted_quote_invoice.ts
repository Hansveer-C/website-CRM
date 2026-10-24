import { CrmMutationError, type CrmMutationClient, type InvoiceCreationInput, type InvoiceCreationResult } from '../../crm_production_mutations';
import { escapeHtmlText as escape } from '../../crm_html_output';
import { renderCard } from '../primitives';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CrmMutationError('INVALID_RESPONSE');
  return value as Record<string, unknown>;
};
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e10;
const cents = (value: number) => Math.round(value * 100);
const revision = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 2147483647;
export interface AcceptedInvoiceLine { service_name: string; description: string; quantity: number; unit_price: number; line_total: number; order_index: number; tier: 'basic' | 'standard' | 'premium' }
export interface AcceptedInvoiceEvidence {
  quoteId: string; acceptedRevision: number; currentRevision: number; eligible: boolean;
  selectedTier: AcceptedInvoiceLine['tier']; currency: 'USD'; total: number;
  items: AcceptedInvoiceLine[]; invoiceId: string | null;
}
export function parseAcceptedInvoiceEvidence(value: unknown, quoteId: string): AcceptedInvoiceEvidence {
  const data = record(value);
  const allowed = ['quote_id', 'accepted_revision', 'current_revision', 'eligible', 'selected_tier', 'currency', 'total_amount', 'snapshot_total_amount', 'items', 'invoice_id'];
  if (Object.keys(data).some(key => !allowed.includes(key)) || data.quote_id !== quoteId || !uuid.test(quoteId)
    || !revision(data.accepted_revision) || !revision(data.current_revision) || typeof data.eligible !== 'boolean'
    || data.eligible !== (data.current_revision === data.accepted_revision + 1)
    || !['basic', 'standard', 'premium'].includes(String(data.selected_tier)) || data.currency !== 'USD'
    || !money(data.total_amount) || data.total_amount !== data.snapshot_total_amount
    || (data.invoice_id !== null && (typeof data.invoice_id !== 'string' || !uuid.test(data.invoice_id)))
    || !Array.isArray(data.items) || data.items.length === 0) throw new CrmMutationError('INVALID_RESPONSE');
  const orders = new Set<number>();
  const items = data.items.map(value => {
    const item = record(value);
    if (Object.keys(item).some(key => !['service_name','description','quantity','unit_price','line_total','order_index','tier'].includes(key))
      || typeof item.service_name !== 'string' || !item.service_name.trim() || item.service_name.length > 200
      || typeof item.description !== 'string' || item.description.length > 2000
      || !money(item.quantity) || item.quantity <= 0 || !money(item.unit_price) || !money(item.line_total)
      || !Number.isInteger(item.order_index) || (item.order_index as number) < 0 || orders.has(item.order_index as number)
      || item.tier !== data.selected_tier) throw new CrmMutationError('INVALID_RESPONSE');
    orders.add(item.order_index as number);
    return item as unknown as AcceptedInvoiceLine;
  }).sort((a, b) => a.order_index - b.order_index);
  // Never recalculate pricing in the browser; compare server-projected cent values.
  if (items.reduce((sum, item) => sum + cents(item.line_total), 0) !== cents(data.total_amount)) throw new CrmMutationError('INVALID_RESPONSE');
  return { quoteId, acceptedRevision: data.accepted_revision, currentRevision: data.current_revision, eligible: data.eligible,
    selectedTier: data.selected_tier as AcceptedInvoiceLine['tier'], currency: 'USD', total: data.total_amount,
    items, invoiceId: data.invoice_id as string | null };
}
export async function loadAcceptedInvoiceEvidence(client: CrmMutationClient, quoteId: string) {
  if (!uuid.test(quoteId)) throw new CrmMutationError('INVALID_INPUT');
  const result = await client.rpc('read_crm_accepted_invoice_evidence', { p_quote_id: quoteId });
  if (result.error) {
    if (record(result.error).code === '42501') throw new CrmMutationError('FORBIDDEN');
    throw new CrmMutationError('UNAVAILABLE');
  }
  return parseAcceptedInvoiceEvidence(result.data, quoteId);
}
interface Dependencies {
  load(): Promise<AcceptedInvoiceEvidence>;
  create(input: InvoiceCreationInput): Promise<InvoiceCreationResult>;
  view(invoiceId: string): Promise<void>;
  current(): boolean;
  requestKey(): string;
}
export class AcceptedQuoteInvoiceController {
  phase: 'loading' | 'ready' | 'saving' | 'success' | 'conflict' | 'error' | 'permission' | 'opening' = 'loading';
  evidence?: AcceptedInvoiceEvidence;
  message = '';
  invoiceId?: string;
  private pending?: InvoiceCreationInput;
  private generation = 0;
  constructor(readonly quoteId: string, readonly userId: string, private dependencies: Dependencies, private changed: () => void = () => {}) {}
  get retryPending() { return Boolean(this.pending); }
  async load() {
    if (!this.dependencies.current() || this.phase === 'saving' || this.phase === 'opening') return;
    const generation = ++this.generation;
    this.phase = 'loading'; this.message = ''; this.changed();
    try {
      const evidence = await this.dependencies.load();
      if (!this.dependencies.current() || generation !== this.generation) return;
      if (evidence.quoteId !== this.quoteId) throw new CrmMutationError('INVALID_RESPONSE');
      this.evidence = evidence; this.pending = undefined; this.invoiceId = evidence.invoiceId ?? undefined;
      this.phase = this.invoiceId ? 'success' : evidence.eligible ? 'ready' : 'conflict';
      if (this.phase === 'conflict') this.message = 'This estimate changed after acceptance. No invoice can be created from this revision.';
    } catch (error) {
      if (!this.dependencies.current() || generation !== this.generation) return;
      this.phase = error instanceof CrmMutationError && error.code === 'FORBIDDEN' ? 'permission' : 'error';
      this.message = this.phase === 'permission' ? 'This accepted estimate is unavailable for this account. Sign in or refresh to check access.' : 'Accepted invoice evidence could not be loaded. Refresh before relying on this estimate.';
    }
    this.changed();
  }
  async create() {
    const evidence = this.evidence;
    if (!this.dependencies.current() || this.phase !== 'ready' || !evidence?.eligible || this.invoiceId) return;
    this.pending ??= { quoteId: this.quoteId, acceptedQuoteRevision: evidence.acceptedRevision, requestKey: this.dependencies.requestKey() };
    this.phase = 'saving'; this.message = ''; this.changed();
    try {
      const result = await this.dependencies.create(this.pending);
      if (!this.dependencies.current()) return;
      const invoice = result.invoice;
      if (invoice.user_id !== this.userId || invoice.quote_id !== this.quoteId || invoice.source_quote_revision !== evidence.acceptedRevision
        || invoice.currency !== evidence.currency || invoice.total_amount !== evidence.total || !uuid.test(String(invoice.id))
        || result.items.length !== evidence.items.length) throw new CrmMutationError('INVALID_RESPONSE');
      const issued = [...result.items].sort((a, b) => Number(a.source_quote_item_order_index) - Number(b.source_quote_item_order_index));
      if (issued.some((item, index) => {
        const accepted = evidence.items[index];
        return item.user_id !== this.userId || item.invoice_id !== invoice.id || item.source_quote_item_order_index !== accepted.order_index
          || item.service_name !== accepted.service_name || item.description !== accepted.description
          || item.quantity !== accepted.quantity || item.unit_price !== accepted.unit_price || item.line_total !== accepted.line_total;
      })) throw new CrmMutationError('INVALID_RESPONSE');
      this.invoiceId = invoice.id as string; this.pending = undefined; this.phase = 'success'; this.message = 'Invoice saved from the accepted estimate.';
    } catch (error) {
      if (!this.dependencies.current()) return;
      const code = error instanceof CrmMutationError ? error.code : 'UNAVAILABLE';
      this.phase = code === 'FORBIDDEN' ? 'permission' : code === 'CONFLICT' ? 'conflict' : code === 'INVALID_INPUT' ? 'error' : 'ready';
      this.message = code === 'FORBIDDEN' ? 'Invoice access changed. Sign in or refresh to check this account.'
        : code === 'CONFLICT' ? 'This accepted estimate changed. Refresh before trying again.'
          : code === 'INVALID_INPUT' ? 'The accepted evidence cannot be invoiced. Refresh to verify it.'
            : 'Invoice save could not be confirmed. Retry the same request or refresh to check whether it was saved.';
    }
    this.changed();
  }
  async view() {
    if (!this.dependencies.current() || !this.invoiceId || this.phase !== 'success') return;
    this.phase = 'opening'; this.changed();
    try { await this.dependencies.view(this.invoiceId); }
    catch { if (this.dependencies.current()) this.message = 'Invoice is saved but could not be opened. Try opening it again.'; }
    if (this.dependencies.current()) { this.phase = 'success'; this.changed(); }
  }
}
export function mountAcceptedQuoteInvoice(root: HTMLElement, controller: AcceptedQuoteInvoiceController) {
  const evidence = controller.evidence;
  const summary = evidence ? `<p>Accepted ${escape(evidence.selectedTier)} option - ${escape(evidence.currency)} ${escape(evidence.total.toFixed(2))} - acceptance revision ${evidence.acceptedRevision}</p><ul>${evidence.items.map(item => `<li>${escape(item.service_name)} --- ${escape(evidence.currency)} ${escape(item.line_total.toFixed(2))}</li>`).join('')}</ul>` : '';
  const busy = ['loading','saving','opening'].includes(controller.phase);
  const action = controller.phase === 'ready' ? `<button type="button" class="wo-button wo-button--primary" data-invoice-create>${controller.retryPending ? 'Retry invoice save' : 'Create invoice'}</button>`
    : controller.phase === 'success' ? '<button type="button" class="wo-button wo-button--primary" data-invoice-view>Open existing invoice</button>'
      : busy ? `<button type="button" class="wo-button wo-button--primary" disabled>${controller.phase === 'saving' ? 'Creating invoice---' : controller.phase === 'opening' ? 'Opening invoice---' : 'Loading accepted invoice---'}</button>` : '';
  root.innerHTML = `<section class="no-print" aria-labelledby="accepted-invoice-heading" aria-busy="${busy}">${renderCard({ bodyHtml: `<h2 id="accepted-invoice-heading">Invoice from accepted estimate</h2>${summary}${controller.message ? `<p role="${controller.phase === 'success' ? 'status' : 'alert'}">${escape(controller.message)}</p>` : ''}${action}${!busy ? ' <button type="button" class="wo-button wo-button--secondary" data-invoice-refresh>Refresh invoice evidence</button>' : ''}` })}</section>`;
  root.querySelector('[data-invoice-create]')?.addEventListener('click', () => void controller.create());
  root.querySelector('[data-invoice-view]')?.addEventListener('click', () => void controller.view());
  root.querySelector('[data-invoice-refresh]')?.addEventListener('click', () => void controller.load());
}
