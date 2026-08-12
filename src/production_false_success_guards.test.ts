import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');

describe('production false-success guards', () => {
  it('renders Website Navigation safely with or without a hydrated layout', () => {
    expect(source).toContain("websiteLayoutHydrator.state.status === 'loading'");
    expect(source).toContain("websiteLayoutHydrator.state.status === 'error'");
    expect(source).toContain('layout?.header_config.nav_items ?? []');
    expect(source).not.toContain("mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0]");
  });

  it('routes production lead and quote creation through transactional RPC clients', () => {
    expect(source).toContain('await createProductionLead');
    expect(source).toContain("await saveProductionQuote");
    expect(source).toContain("if (editorUsesSupabase()) {");
    expect(source).toContain("Lead creation is temporarily unavailable. Please try again.");
  });

  it('marks invoices explicitly unavailable when production storage does not exist', () => {
    const start = source.indexOf('function renderInvoices()');
    expect(source.slice(start, start + 700)).toContain('Invoices are not available yet.');
    expect(source.slice(start, start + 700)).toContain('if (editorUsesSupabase())');
  });

  it.each([
    ['markAsPaid', 'Invoice persistence is not available yet.'],
    ['convertToInvoice', 'Invoice persistence is not available yet.'],
    ['approveQuote', 'Quote status updates are temporarily unavailable.'],
    ['rejectQuote', 'Quote status updates are temporarily unavailable.'],
    ['sendQuote', 'Quote sending is temporarily unavailable.'],
    ['updateContactField', 'Contact updates are temporarily unavailable.'],
    ['updateOpportunityField', 'Opportunity updates are temporarily unavailable.'],
    ['logCall', 'Activity creation is temporarily unavailable.']
  ])('blocks %s from reporting memory-only production success', (handler, message) => {
    const start = source.indexOf(`(window as any).${handler}`);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, start + 500)).toContain("if (editorUsesSupabase())");
    expect(source.slice(start, start + 500)).toContain(message);
  });
});
