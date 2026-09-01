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

  it('validates the Basic-selected quote before either production or local persistence', () => {
    const saveStart = source.indexOf('(window as any).saveQuote = async () =>');
    const saveSource = source.slice(saveStart, saveStart + 5_500);
    expect(saveSource.indexOf('validateSelectedQuoteTier(nqItems, selectedTier)')).toBeGreaterThan(-1);
    expect(saveSource.indexOf('validateSelectedQuoteTier(nqItems, selectedTier)'))
      .toBeLessThan(saveSource.indexOf('if (editorUsesSupabase())'));
    expect(saveSource).toContain('const basicTotal = tierValidation.selectedTotal');
    expect(saveSource).toContain('selected_tier: selectedTier');
  });

  it('derives production onboarding from durable Website ownership', () => {
    const dashboardStart = source.indexOf('function renderDashboard()');
    const dashboardSource = source.slice(dashboardStart, dashboardStart + 2_000);
    expect(dashboardSource).toContain('loadWebsiteDashboardCore({ actingUserId: userId })');
    expect(dashboardSource).toContain('durableWebsiteCount: core.websites.length');
    expect(dashboardSource).toContain('} else if (!alreadySeenOnboarding) {');
    expect(dashboardSource.indexOf("document.getElementById('website-onboarding-modal')?.remove()"))
      .toBeLessThan(dashboardSource.indexOf("if (currentView !== 'dashboard') return"));
  });

  it('resolves authenticated Preview from owned hydrated Website data', () => {
    const bootStart = source.indexOf('async function bootRouter()');
    const bootSource = source.slice(bootStart, bootStart + 5_000);
    expect(bootSource).toContain('resolveAuthenticatedPreview');
    expect(bootSource).toContain('hydrateAuthenticatedPreviewSections');
    expect(bootSource).toContain("params.get('websiteId')");
    expect(bootSource).toContain("params.get('pageId')");
    expect(source).toContain("|| { header_config: { nav_items: [] }, footer_config: {} }");
    expect(bootSource.indexOf('websiteSettingsHydrator.hydrate(authState.user.id, target.website)'))
      .toBeLessThan(bootSource.indexOf('hydrateAuthenticatedPreviewSections(previewOperation.pageId, previewOperation.userId, previewOperation.navigation)'));
    expect(bootSource.indexOf('websiteSettingsHydrator.hydrate(authState.user.id, target.website)'))
      .toBeLessThan(bootSource.indexOf('renderSitePage(target.funnel.id'));
    expect(bootSource).toContain('}, true, undefined, target.page)');
    expect(bootSource.indexOf('hydrateAuthenticatedPreviewSections(previewOperation.pageId, previewOperation.userId, previewOperation.navigation)'))
      .toBeLessThan(bootSource.indexOf('}, true, undefined, target.page)'));
  });

  it('clears tenant-scoped settings and preview context on identity changes', () => {
    const clearStart = source.indexOf('function clearProtectedRuntimeData()');
    const clearSource = source.slice(clearStart, clearStart + 1_000);
    expect(clearSource).toContain('websiteSettingsHydrator.clear()');
    expect(clearSource).toContain('applyPrimaryColor(mockWebsiteSettings.primary_color)');
    expect(clearSource).toContain('activeWebsiteContext = null');
  });

  it('removes seeded settings before production authentication can render', () => {
    const hydratorStart = source.indexOf('const websiteSettingsHydrator = new WebsiteSettingsHydrator');
    const authStart = source.indexOf('const applicationAuthController = new ApplicationAuthController');
    const initialization = source.slice(authStart, hydratorStart + 700);
    expect(initialization).toContain('if (!editorUsesLocalData())');
    expect(initialization).toContain('websiteSettingsHydrator.clear()');
    expect(initialization).toContain('applyPrimaryColor(mockWebsiteSettings.primary_color)');
  });

  it('clears settings before switching the active dashboard Website', () => {
    const switchStart = source.indexOf('(window as any).selectDashboardWebsite');
    const switchSource = source.slice(switchStart, switchStart + 500);
    expect(switchSource.indexOf('websiteSettingsHydrator.clear()'))
      .toBeLessThan(switchSource.indexOf('activeDashboardWebsiteId = websiteId'));
    expect(switchSource).toContain('activeBuilderWebsiteId = null');
  });

  it('refreshes the dashboard through the module function without an undefined window bridge', () => {
    expect(source).toContain("if (currentView === 'dashboard') renderDashboard();");
    expect(source).not.toContain('(window as any).renderDashboard()');
  });

  it('renders invoices from the protected durable production workspace without wiring mutations', () => {
    const start = source.indexOf('function renderInvoices()');
    const invoiceRenderer = source.slice(start, start + 1_800);
    const productionBranch = invoiceRenderer.slice(0, invoiceRenderer.indexOf('return;'));
    expect(productionBranch).toContain('renderProductionInvoiceWorkspace');
    expect(productionBranch).toContain('invoices: durableInvoices');
    expect(productionBranch).toContain('invoiceItems: durableInvoiceItems');
    expect(productionBranch).not.toContain('mockInvoices');
    expect(productionBranch).toContain("entities.invoices === 'ready'");
    expect(productionBranch).toContain("entities.invoice_items === 'ready'");
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
    expect(source.slice(layoutStart, layoutStart + 2_200)).toContain("client.from('website_layouts').upsert");
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
