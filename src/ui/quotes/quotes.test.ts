import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderApplicationShell } from '../shell';
import { getOwnedQuotePreview, ownedNewQuoteContacts, ownedNewQuoteOpportunities, renderNewQuoteContent, renderQuotePreviewContent, renderQuotesContent } from './quotes';

const owner = 'owner';
const contact = { id: 'c1', user_id: owner, name: 'Owner', email: 'owner@example.test', phone: null, address: '1 Clean Way', status: 'lead' as const, source: 'Referral', tags: [], created_at: '2026-08-01T00:00:00Z' };
const quote = { id: 'q1', user_id: owner, contact_id: 'c1', opportunity_id: 'o1', status: 'sent' as const, total_amount: 250, selected_tier: 'basic' as const, notes: 'Owned note', created_at: '2026-08-01T00:00:00Z' };
const opportunity = { id: 'o1', user_id: owner, contact_id: 'c1', pipeline_stage: 'Quote Sent', value: 250, status: 'open' as const, created_at: '2026-08-01T00:00:00Z' };
const item = { id: 'i1', user_id: owner, quote_id: 'q1', service_name: 'Driveway wash', description: 'Clean concrete', quantity: 1, unit_price: 250, total: 250, tier: 'basic' as const };
const base = { userId: owner, quotes: [quote], contacts: [contact], editable: true };

describe('WashOps quote workflow', () => {
  it('scopes the list and related contact to the acting tenant', () => {
    const html = renderQuotesContent({ ...base, quotes: [quote, { ...quote, id: 'foreign', user_id: 'other', total_amount: 99999 }], contacts: [{ ...contact, user_id: 'other', name: 'FOREIGN CONTACT' }] });
    expect(html).toContain('Contact unavailable'); expect(html).not.toContain('FOREIGN CONTACT'); expect(html).not.toContain('99,999');
  });
  it('scopes new quote contacts and opportunities to the selected owned contact', () => {
    const model = { userId: owner, contacts: [contact, { ...contact, id: 'foreign', user_id: 'other' }], opportunities: [opportunity, { ...opportunity, id: 'wrong-contact', contact_id: 'c2' }, { ...opportunity, id: 'foreign-opp', user_id: 'other' }], contactId: 'c1', opportunityId: 'o1', items: [{ service: 'Wash', description: '', quantity: 1, price: 250, tier: 'basic' as const }] };
    expect(ownedNewQuoteContacts(model).map(row => row.id)).toEqual(['c1']); expect(ownedNewQuoteOpportunities(model).map(row => row.id)).toEqual(['o1']); expect(renderNewQuoteContent(model)).not.toContain('foreign-opp');
  });
  it('scopes preview quote, contact, and line items and escapes tenant data', () => {
    const html = renderQuotePreviewContent({ userId: owner, quoteId: 'q1', quotes: [quote], contacts: [{ ...contact, name: '<img onerror=1>' }], items: [{ ...item, service_name: '<script>x</script>' }, { ...item, id: 'foreign-item', user_id: 'other', service_name: 'FOREIGN ITEM' }], editable: true });
    expect(html).toContain('&lt;img onerror=1&gt;'); expect(html).toContain('&lt;script&gt;x&lt;/script&gt;'); expect(html).not.toContain('FOREIGN ITEM'); expect(html).toContain('Selected option');
  });
  it('renders an intentional empty preview and read-only production controls', () => {
    expect(renderQuotePreviewContent({ userId: owner, quoteId: 'foreign', quotes: [{ ...quote, user_id: 'other', id: 'foreign' }], contacts: [contact], items: [], editable: false })).toContain('Quote unavailable');
    const html = renderQuotePreviewContent({ userId: owner, quoteId: 'q1', quotes: [quote], contacts: [contact], items: [item], editable: false });
    expect(html).toContain('unavailable in production'); expect(html).not.toContain('window.selectQuoteTier');
  });
  it('composes one shell and preserves keyboard-safe quote rows', () => {
    const content = renderQuotesContent(base); const shell = renderApplicationShell({ activeView: 'quotes', title: 'Quotes', contentHtml: content, contentVariant: 'wide' });
    expect(content).toContain('event.target === event.currentTarget'); expect((shell.match(/class="wo-shell"/g) ?? []).length).toBe(1); expect((shell.match(/<main\b/g) ?? []).length).toBe(1); expect(shell).not.toContain('class="sidebar"');
  });
  it('keeps direct local quote mutations tenant-safe', () => {
    const main = readFileSync(fileURLToPath(new URL('../../main.ts', import.meta.url)), 'utf8');
    expect(main).toContain("mockQuotes.find(q => q.user_id === getActingUserId() && q.id === quoteId)"); expect(main).toContain("mockQuoteItems.filter(i => i.user_id === getActingUserId() && i.quote_id === quoteId && i.tier === tier)"); expect(main).toContain("mockOpportunities.find(o => o.user_id === getActingUserId() && o.id === quote.opportunity_id)");
  });
});
