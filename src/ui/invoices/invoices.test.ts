import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderApplicationShell } from '../shell';
import { itemsForDurableInvoice, ownedInvoices, renderInvoicesContent, renderProductionInvoiceWorkspace } from './invoices';

const owner = 'owner-1';
const contact = { id: 'contact-1', user_id: owner, name: 'Avery Exterior', phone: '6045550100', email: 'avery@example.test', address: '10 Clean Way', tags: [], source: 'Website', service: 'House wash', status: 'lead' as const, created_at: '2026-08-21T10:00:00.000Z' };
const invoice = { id: 'invoice-1', user_id: owner, contact_id: contact.id, quote_id: 'quote-1', amount: 1250, status: 'unpaid' as const, due_date: '2026-08-28T10:00:00.000Z', created_at: '2026-08-21T10:00:00.000Z' };
const base = { userId: owner, invoices: [invoice], contacts: [contact], filter: 'all' as const, production: false };
const durableInvoice = {
  id: 'durable-invoice-1', user_id: owner, contact_id: contact.id, quote_id: 'durable-quote-1', quote_acceptance_id: 'acceptance-1',
  source_quote_revision: 2, invoice_number: 108, status: 'issued' as const, currency: 'USD' as const, total_amount: 1250,
  customer_name: 'Historical Avery Exterior', customer_email: 'historical@example.test', customer_phone: '+16045550100',
  billing_address: '10 Historical Clean Way\nVancouver, BC', issued_at: '2026-08-21T10:00:00.000Z', due_at: '2026-08-28T10:00:00.000Z',
  origin: 'accepted_quote' as const, created_at: '2026-08-21T10:00:00.000Z'
};
const durableItems = [
  { id: 'durable-item-2', user_id: owner, invoice_id: durableInvoice.id, source_quote_item_order_index: 1, service_name: 'Gutter clean', description: 'Historical second service', quantity: 1, unit_price: 250, line_total: 250, created_at: durableInvoice.created_at },
  { id: 'durable-item-1', user_id: owner, invoice_id: durableInvoice.id, source_quote_item_order_index: 0, service_name: 'Exterior wash', description: 'Historical first service', quantity: 1, unit_price: 1000, line_total: 1000, created_at: durableInvoice.created_at }
];
const productionBase = { userId: owner, invoices: [durableInvoice], invoiceItems: durableItems, state: 'ready' as const, selectedInvoiceId: null, sourceQuoteIds: ['durable-quote-1'] };

describe('WashOps invoices interior', () => {
  it('derives complete owned invoice summary values without foreign records', () => {
    const overdue = { ...invoice, id: 'invoice-overdue', amount: 500, status: 'overdue' as const };
    const paid = { ...invoice, id: 'invoice-paid', amount: 300, status: 'paid' as const };
    const foreign = { ...invoice, id: 'foreign-invoice', user_id: 'other-user', amount: 99999 };
    expect(ownedInvoices({ ...base, invoices: [invoice, overdue, paid, foreign] }).map(item => item.id)).toEqual(['invoice-1', 'invoice-overdue', 'invoice-paid']);
    const html = renderInvoicesContent({ ...base, invoices: [invoice, overdue, paid, foreign] });
    expect(html).toContain('$1,750 outstanding');
    expect(html).toContain('$500 overdue');
    expect(html).toContain('$300 paid invoice value');
    expect(html).not.toContain('99,999');
  });

  it('does not resolve a foreign contact for an owned invoice', () => {
    const html = renderInvoicesContent({ ...base, contacts: [{ ...contact, user_id: 'other-user', name: 'FOREIGN CONTACT MUST NOT RENDER' }] });
    expect(html).toContain('Contact unavailable');
    expect(html).not.toContain('FOREIGN CONTACT MUST NOT RENDER');
  });

  it('escapes invoice-controlled contact output', () => {
    const html = renderInvoicesContent({ ...base, contacts: [{ ...contact, name: '<img src=x onerror=alert(1)>' }] });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('keeps the legacy local renderer empty state and does not expose its actions in production workspace markup', () => {
    const empty = renderInvoicesContent({ ...base, invoices: [] });
    expect(empty).toContain('No invoices match this filter');
    expect(empty).toContain('wo-empty-state');
    const production = renderProductionInvoiceWorkspace(productionBase);
    expect(production).toContain('Read-only');
    expect(production).not.toContain('Mark paid');
    expect(production).not.toContain('convertToInvoice');
    expect(production).not.toContain('sendInvoice');
  });

  it('renders the populated production list from durable historical values only', () => {
    const html = renderProductionInvoiceWorkspace({
      ...productionBase,
      invoices: [{ ...durableInvoice, customer_name: '<img src=x onerror=alert(1)>' }]
    });
    expect(html).toContain('#108');
    expect(html).toContain('$1,250.00');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('View details');
  });

  it('renders legitimate empty, loading, and read-error production states without mock fallback', () => {
    expect(renderProductionInvoiceWorkspace({ ...productionBase, state: 'loading' })).toContain('Loading durable invoices');
    const empty = renderProductionInvoiceWorkspace({ ...productionBase, invoices: [], invoiceItems: [] });
    expect(empty).toContain('No durable invoices yet');
    const error = renderProductionInvoiceWorkspace({ ...productionBase, state: 'error' });
    expect(error).toContain('Invoice records could not be loaded');
    expect(error).not.toContain('invoice-1');
  });

  it('renders durable invoice detail, historical snapshots, ordered items, and a safe source-quote link', () => {
    const html = renderProductionInvoiceWorkspace({ ...productionBase, selectedInvoiceId: durableInvoice.id });
    expect(html).toContain('Historical Avery Exterior');
    expect(html).toContain('10 Historical Clean Way<br>Vancouver, BC');
    expect(html.indexOf('Exterior wash')).toBeLessThan(html.indexOf('Gutter clean'));
    expect(html).toContain('View source quote');
    expect(html).toContain("window.navigateTo('quote-preview',this.dataset.quoteId)");
    expect(itemsForDurableInvoice(productionBase, durableInvoice.id).map(item => item.id)).toEqual(['durable-item-1', 'durable-item-2']);
  });

  it('does not offer a source quote navigation control when the durable quote is not hydrated', () => {
    const html = renderProductionInvoiceWorkspace({ ...productionBase, selectedInvoiceId: durableInvoice.id, sourceQuoteIds: [] });
    expect(html).toContain('Source quote is unavailable in this workspace.');
    expect(html).not.toContain('View source quote');
  });

  it('uses the canonical card, status badge, and responsive table hooks', () => {
    const html = renderInvoicesContent(base);
    expect(html).toContain('wo-card');
    expect(html).toContain('wo-badge');
    expect(html).toContain('wo-invoices-table');
    expect(html).toContain('Mark paid');
  });

  it('renders inside exactly one permanent shell and main landmark', () => {
    const html = renderApplicationShell({ activeView: 'invoices', title: 'Invoices', contentVariant: 'wide', contentHtml: renderInvoicesContent(base) });
    expect((html.match(/class="wo-shell"/g) ?? []).length).toBe(1);
    expect((html.match(/<main\b/g) ?? []).length).toBe(1);
    expect(html).not.toContain('class="sidebar"');
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  it('keeps invoice mutations scoped to the acting user', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source).toContain("mockInvoices.find(i => i.user_id === getActingUserId() && i.id === invoiceId)");
    expect(source).toContain("mockQuotes.find(q => q.user_id === getActingUserId() && q.id === invoice.quote_id)");
    expect(source).toContain("mockContacts.find(contact => contact.user_id === getActingUserId() && contact.id === contactId)");
    expect(source).toContain("mockQuotes.filter(q => q.user_id === getActingUserId() && q.contact_id === ownedContact.id)");
    expect(source).toContain(".sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]");
  });

  it('uses semantic controls and responsive design-system hooks for narrow viewports', () => {
    const html = renderProductionInvoiceWorkspace(productionBase);
    const css = readFileSync('src/ui/invoices/invoices.css', 'utf8');
    expect(html).toContain('<table class="wo-invoices-table"');
    expect(html).toContain('data-label="Invoice"');
    expect(html).toContain('type="button"');
    expect(css).toContain('@media(max-width:1023px)');
    expect(css).toContain('@media(max-width:639px)');
    expect(css).toContain('overflow-wrap:anywhere');
    expect(css).toContain('min-height:var(--wo-min-touch-target)');
  });
});
