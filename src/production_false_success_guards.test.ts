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

  it.each([
    'saveNewPage',
    'saveWebsiteAttachment',
    'deletePage',
    'finalizePageCreation',
    'duplicatePage',
    'togglePublish',
    'generatePageWithAI',
    'applyTemplate',
    'useTemplate',
    'updatePageName',
    'togglePublishFromBuilder'
  ])('blocks legacy Website handler %s before any fixture mutation', handler => {
    const start = source.indexOf(`(window as any).${handler}`);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, start + 300)).toContain('blockUnsupportedProductionWebsiteMutation');
  });

  it('blocks browser-simulated funnel mutations in Supabase mode', () => {
    const start = source.indexOf("if (url.startsWith('/api/funnels'))");
    expect(source.slice(start, start + 450)).toContain("editorUsesSupabase() && method !== 'GET'");
    expect(source.slice(start, start + 450)).toContain('temporarily unavailable in production');
  });

  it('keeps route mutations guarded and layout persistence durable', () => {
    for (const handler of ['saveRoute', 'deleteRoute']) {
      const start = source.indexOf(`(window as any).${handler}`);
      expect(source.slice(start, start + 250)).toContain('editorUsesSupabase()');
    }
    const layoutStart = source.indexOf('(window as any).saveWebsiteLayout');
    expect(source.slice(layoutStart, layoutStart + 1_500)).toContain("client.from('website_layouts').upsert");
  });

  it('sends one stable request key through both authenticated transport attempts', () => {
    expect(source).toContain('authenticatedFormAttempts.begin(internalAttemptScope, leadData)');
    expect(source.match(/body: JSON\.stringify\(internalLeadData\)/g)).toHaveLength(2);
    expect(source).toContain('authenticatedFormAttempts.accept(internalAttemptScope, internalAttempt.key)');
  });

  it('fails authenticated lead submission truthfully when the request key is missing', () => {
    const start = source.indexOf("if (url === '/api/leads' && method === 'POST')");
    const leadRoute = source.slice(start, start + 2_500);
    expect(leadRoute).toContain("typeof body.request_key !== 'string'");
    expect(leadRoute).toContain('Production lead persistence is unavailable.');
    expect(leadRoute).not.toContain('createLocalMockWebsiteLead(body');
  });
});
