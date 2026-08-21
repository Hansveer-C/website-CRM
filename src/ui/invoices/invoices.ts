import { escapeHtmlText } from '../../crm_html_output';
import type { Contact, Invoice } from '../../types';
import { renderCard, renderEmptyState, renderStatusBadge } from '../primitives';
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
