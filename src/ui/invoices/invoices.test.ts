import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderApplicationShell } from '../shell';
import { ownedInvoices, renderInvoicesContent } from './invoices';

const owner = 'owner-1';
const contact = { id: 'contact-1', user_id: owner, name: 'Avery Exterior', phone: '6045550100', email: 'avery@example.test', address: '10 Clean Way', tags: [], source: 'Website', service: 'House wash', status: 'lead' as const, created_at: '2026-08-21T10:00:00.000Z' };
const invoice = { id: 'invoice-1', user_id: owner, contact_id: contact.id, quote_id: 'quote-1', amount: 1250, status: 'unpaid' as const, due_date: '2026-08-28T10:00:00.000Z', created_at: '2026-08-21T10:00:00.000Z' };
const base = { userId: owner, invoices: [invoice], contacts: [contact], filter: 'all' as const, production: false };

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

  it('uses deliberate empty and production-unavailable states without actions', () => {
    const empty = renderInvoicesContent({ ...base, invoices: [] });
    expect(empty).toContain('No invoices match this filter');
    expect(empty).toContain('wo-empty-state');
    const production = renderInvoicesContent({ ...base, production: true });
    expect(production).toContain('Invoices are not available yet');
    expect(production).not.toContain('Mark paid');
    expect(production).not.toContain('window.navigateTo');
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
});
