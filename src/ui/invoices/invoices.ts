import { escapeHtmlText } from '../../crm_html_output';
import type { Contact, DurableInvoice, DurableInvoiceItem, Invoice } from '../../types';
import { renderBadge, renderCard, renderEmptyState, renderStatusBadge } from '../primitives';
export type InvoiceFilter = 'all' | 'unpaid' | 'paid' | 'overdue';
export interface InvoiceModel { userId: string; invoices: Invoice[]; contacts: Contact[]; filter: InvoiceFilter; production: boolean; }

const money = (value: number) => `$${value.toLocaleString('en-US')}`;

export function ownedInvoices(model: InvoiceModel) {
  return model.invoices.filter(invoice => invoice.user_id === model.userId).filter(invoice => model.filter === 'all' || invoice.status === model.filter);
}

export function renderInvoicesContent(model: InvoiceModel): string {
  if (model.production) return `<section class="wo-invoices">${renderCard({ bodyHtml: renderEmptyState({ title: 'Invoices are not available yet', description: 'Invoice persistence is not available yet. No production invoice records or actions are available.' }) })}</section>`;
  const invoices = ownedInvoices(model);
  const all = model.invoices.filter(invoice => invoice.user_id === model.userId);
  const total = (predicate: (invoice: Invoice) => boolean) => all.filter(predicate).reduce((sum, invoice) => sum + invoice.amount, 0);
  const rows = invoices.map(invoice => {
    const contact = model.contacts.find(candidate => candidate.user_id === model.userId && candidate.id === invoice.contact_id);
    const view = `<button type="button" class="wo-button wo-button--secondary wo-button--sm" data-contact-id="${escapeHtmlText(invoice.contact_id)}" onclick="window.navigateTo('contact-detail', this.dataset.contactId)">View</button>`;
    const paid = invoice.status !== 'paid' ? `<button type="button" class="wo-button wo-button--primary wo-button--sm" data-invoice-id="${escapeHtmlText(invoice.id)}" onclick="window.markAsPaid(this.dataset.invoiceId)">Mark paid</button>` : '';
    return `<tr><td data-label="Invoice"><strong>INV-${escapeHtmlText(invoice.id)}</strong></td><td data-label="Contact">${escapeHtmlText(contact?.name ?? 'Contact unavailable')}</td><td data-label="Amount">${escapeHtmlText(money(invoice.amount))}</td><td data-label="Status">${renderStatusBadge(invoice.status)}</td><td data-label="Due date">${escapeHtmlText(new Date(invoice.due_date).toLocaleDateString())}</td><td data-label="Actions">${view}${paid}</td></tr>`;
  }).join('');
  const filter = (['all', 'unpaid', 'paid', 'overdue'] as InvoiceFilter[]).map(status => `<option value="${status}" ${model.filter === status ? 'selected' : ''}>${status[0].toUpperCase() + status.slice(1)}</option>`).join('');
  const bodyHtml = rows ? `<div class="wo-invoices-table-wrap"><table class="wo-invoices-table"><thead><tr><th>Invoice</th><th>Contact</th><th>Amount</th><th>Status</th><th>Due date</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : renderEmptyState({ title: 'No invoices match this filter', description: 'Invoice records created locally will appear here.' });
  return `<section class="wo-invoices"><div class="wo-invoices-summary"><span>${all.length} invoices</span><span>${escapeHtmlText(money(total(invoice => invoice.status !== 'paid')))} outstanding</span><span>${escapeHtmlText(money(total(invoice => invoice.status === 'overdue')))} overdue</span><span>${escapeHtmlText(money(total(invoice => invoice.status === 'paid')))} paid invoice value</span></div><label class="wo-invoices-filter">Status <select class="wo-field-select" onchange="window.updateInvoiceFilter(this.value)">${filter}</select></label>${renderCard({ className: 'wo-invoices-card', bodyHtml })}</section>`;
}

export interface ProductionInvoiceWorkspaceModel {
  userId: string;
  invoices: DurableInvoice[];
  invoiceItems: DurableInvoiceItem[];
  state: 'loading' | 'ready' | 'error';
  selectedInvoiceId: string | null;
  sourceQuoteIds: readonly string[];
}

const formatDurableMoney = (value: number, currency: string) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, minimumFractionDigits: 2
}).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
const durableAddress = (value: string) => escapeHtmlText(value).replace(/\n/g, '<br>');

export function ownedDurableInvoices(model: ProductionInvoiceWorkspaceModel): DurableInvoice[] {
  return model.invoices.filter(invoice => invoice.user_id === model.userId);
}

export function itemsForDurableInvoice(model: ProductionInvoiceWorkspaceModel, invoiceId: string): DurableInvoiceItem[] {
  return model.invoiceItems
    .filter(item => item.user_id === model.userId && item.invoice_id === invoiceId)
    .sort((a, b) => a.source_quote_item_order_index - b.source_quote_item_order_index || a.id.localeCompare(b.id));
}

function renderProductionInvoiceDetail(model: ProductionInvoiceWorkspaceModel, invoice: DurableInvoice): string {
  const items = itemsForDurableInvoice(model, invoice.id);
  const sourceQuoteAvailable = model.sourceQuoteIds.includes(invoice.quote_id);
  const sourceQuote = sourceQuoteAvailable
    ? `<button type="button" class="wo-button wo-button--secondary wo-button--sm" data-quote-id="${escapeHtmlText(invoice.quote_id)}" onclick="window.navigateTo('quote-preview',this.dataset.quoteId)">View source quote</button>`
    : '<span class="wo-invoice-detail-muted">Source quote is unavailable in this workspace.</span>';
  const itemRows = items.map(item => `<tr><td data-label="Service"><strong>${escapeHtmlText(item.service_name)}</strong><span>${escapeHtmlText(item.description)}</span></td><td data-label="Quantity">${escapeHtmlText(String(item.quantity))}</td><td data-label="Unit rate">${escapeHtmlText(formatDurableMoney(item.unit_price, invoice.currency))}</td><td data-label="Line total"><strong>${escapeHtmlText(formatDurableMoney(item.line_total, invoice.currency))}</strong></td></tr>`).join('');
  return `<section class="wo-invoice-workspace" aria-labelledby="invoice-detail-title"><div class="wo-invoice-workspace-heading"><div><p class="wo-invoice-eyebrow">Read-only invoice</p><h2 id="invoice-detail-title">Invoice #${escapeHtmlText(String(invoice.invoice_number))}</h2></div><div class="wo-invoice-detail-actions"><button type="button" class="wo-button wo-button--ghost wo-button--sm" onclick="window.closeProductionInvoiceDetail()">Back to invoices</button>${sourceQuote}</div></div>${renderCard({ className: 'wo-invoice-detail-card', bodyHtml: `<div class="wo-invoice-detail-topline"><div>${renderBadge({ label: 'Issued', variant: 'success' })}<span class="wo-invoice-detail-muted">Accepted quote revision ${escapeHtmlText(String(invoice.source_quote_revision))}</span></div><strong>${escapeHtmlText(formatDurableMoney(invoice.total_amount, invoice.currency))}</strong></div><div class="wo-invoice-detail-grid"><section><h3>Historical customer snapshot</h3><strong>${escapeHtmlText(invoice.customer_name)}</strong>${invoice.customer_email ? `<a href="mailto:${escapeHtmlText(invoice.customer_email)}">${escapeHtmlText(invoice.customer_email)}</a>` : ''}${invoice.customer_phone ? `<a href="tel:${escapeHtmlText(invoice.customer_phone)}">${escapeHtmlText(invoice.customer_phone)}</a>` : ''}</section><section><h3>Historical billing address</h3><address>${durableAddress(invoice.billing_address) || 'No billing address recorded.'}</address></section><section><h3>Invoice dates</h3><dl><div><dt>Issued</dt><dd>${escapeHtmlText(formatDate(invoice.issued_at))}</dd></div><div><dt>Due</dt><dd>${escapeHtmlText(formatDate(invoice.due_at))}</dd></div><div><dt>Currency</dt><dd>${escapeHtmlText(invoice.currency)}</dd></div></dl></section></div>` })}${renderCard({ className: 'wo-invoice-items-card', title: 'Invoice items', bodyHtml: itemRows ? `<div class="wo-invoices-table-wrap"><table class="wo-invoices-table wo-invoice-items-table"><thead><tr><th>Service</th><th>Quantity</th><th>Unit rate</th><th>Line total</th></tr></thead><tbody>${itemRows}</tbody></table></div>` : renderEmptyState({ title: 'No invoice items', description: 'This durable invoice has no item records.' }) })}</section>`;
}

export function renderProductionInvoiceWorkspace(model: ProductionInvoiceWorkspaceModel): string {
  if (model.state === 'loading') {
    return `<section class="wo-invoice-workspace" aria-busy="true" aria-live="polite">${renderCard({ bodyHtml: '<p class="wo-invoice-state">Loading durable invoices…</p>' })}</section>`;
  }
  if (model.state === 'error') {
    return `<section class="wo-invoice-workspace" aria-live="assertive">${renderCard({ bodyHtml: '<div class="wo-invoice-state" role="alert"><h2>Invoice records could not be loaded</h2><p>Retry the CRM data load before relying on invoice records.</p></div>' })}</section>`;
  }
  const invoices = ownedDurableInvoices(model);
  const selected = invoices.find(invoice => invoice.id === model.selectedInvoiceId);
  if (selected) return renderProductionInvoiceDetail(model, selected);
  if (!invoices.length) {
    return `<section class="wo-invoice-workspace" aria-live="polite">${renderCard({ bodyHtml: renderEmptyState({ title: 'No durable invoices yet', description: 'Invoices created from accepted quotes will appear here.' }) })}</section>`;
  }
  const rows = invoices.map(invoice => `<tr class="wo-invoice-row"><td data-label="Invoice"><strong>#${escapeHtmlText(String(invoice.invoice_number))}</strong><span>${escapeHtmlText(invoice.customer_name)}</span></td><td data-label="Status">${renderStatusBadge('issued')}</td><td data-label="Issued">${escapeHtmlText(formatDate(invoice.issued_at))}</td><td data-label="Due">${escapeHtmlText(formatDate(invoice.due_at))}</td><td data-label="Total"><strong>${escapeHtmlText(formatDurableMoney(invoice.total_amount, invoice.currency))}</strong></td><td data-label="Actions"><button type="button" class="wo-button wo-button--secondary wo-button--sm" data-invoice-id="${escapeHtmlText(invoice.id)}" onclick="window.viewProductionInvoice(this.dataset.invoiceId)">View details</button></td></tr>`).join('');
  const total = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  return `<section class="wo-invoice-workspace" aria-labelledby="invoices-workspace-title"><div class="wo-invoice-workspace-heading"><div><p class="wo-invoice-eyebrow">Production records</p><h2 id="invoices-workspace-title">Invoices</h2></div>${renderBadge({ label: 'Read-only', variant: 'neutral' })}</div><div class="wo-invoice-summary" aria-label="Invoice summary"><span>${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}</span><strong>${escapeHtmlText(formatDurableMoney(total, invoices[0].currency))} issued</strong></div>${renderCard({ className: 'wo-invoices-card', bodyHtml: `<div class="wo-invoices-table-wrap"><table class="wo-invoices-table"><thead><tr><th>Invoice</th><th>Status</th><th>Issued</th><th>Due</th><th>Total</th><th><span class="wo-sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` })}</section>`;
}
