import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderSitePageDetail, renderSitePageDetailError, renderSitePageDetailLoading, type SitePageDetailModel } from './site_page_detail';

const model = (overrides: Partial<SitePageDetailModel> = {}): SitePageDetailModel => ({
  funnelId: 'f1', name: 'Services', status: 'published',
  routes: [{ id: 'r1', path: '/services', publicUrl: 'https://example.com/services' }],
  metrics: { totalLeads: 8, leadsToday: 2, leadsThisWeek: 5, responseTime: '42s' },
  steps: [{ id: 's1', step_type: 'hero', name: 'Welcome', slug: 'welcome' }, { id: 's2', step_type: 'form', name: 'Request quote', slug: 'quote' }],
  activities: [{ id: 'a1', eventName: 'lead_captured', contactName: 'Avery', createdAt: '2026-08-22T10:00:00.000Z' }],
  ...overrides
});
const render = (value = model()) => renderSitePageDetail({
  model: value,
  renderAttachAction: id => `<button data-attach="${id}">Manage Connection</button>`,
  renderEditAction: (stepId, funnelId) => `<button data-edit="${stepId}" data-funnel="${funnelId}">Edit Section</button>`
});

describe('Site Page Detail renderer', () => {
  it('preserves connection, real lead metrics, response-time availability, ordered sections, and safe action IDs', () => {
    const html = render();
    expect(html).toContain('Connected to Website');
    expect(html).toContain('https://example.com/services');
    expect(html).toContain('Total Leads'); expect(html).toContain('8');
    expect(html).toContain('Leads Today'); expect(html).toContain('2');
    expect(html).toContain('Leads This Week'); expect(html).toContain('5');
    expect(html).toContain('Avg. response time'); expect(html).toContain('42s');
    expect(html.indexOf('Welcome')).toBeLessThan(html.indexOf('Request quote'));
    expect(html).toContain('data-edit="s1"'); expect(html).toContain('data-funnel="f1"');
    expect(html).not.toMatch(/conversion|revenue|page views|Add New Step/i);
  });

  it('renders a connected route as non-clickable text when its public URL is unsafe', () => {
    const html = render(model({ routes: [{ id: 'r1', path: '/<unsafe>', publicUrl: null }], metrics: { totalLeads: 0, leadsToday: 0, leadsThisWeek: 0, responseTime: 'No data yet' } }));
    expect(html).toContain('Connected to Website');
    expect(html).toContain('/&lt;unsafe&gt;');
    expect(html).toContain('No data yet');
    expect(html).not.toContain('href=');
  });

  it('renders a truthful disconnected state when no owned route is available', () => {
    const html = render(model({ routes: [] }));
    expect(html).toContain('Not Connected to Website');
    expect(html).toContain('This page is not attached to an owned website route yet.');
  });

  it('escapes all tenant-controlled presentation values and keeps unknown events out of classes and styles', () => {
    const html = render(model({
      name: '<script>alert(1)</script>', status: '<img onerror=alert(1)>',
      routes: [{ id: 'r1', path: '/<script>', publicUrl: null }],
      steps: [{ id: 's1', step_type: '<img onerror=1>', name: '<script>', slug: 'javascript:alert(1)' }],
      activities: [{ id: 'a1', eventName: '<img onerror=1>', contactName: '<script>', createdAt: 'invalid' }]
    }));
    expect(html).toContain('&lt;img onerror=1&gt;'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('javascript:alert(1)');
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img onerror=');
    expect(html).not.toContain('class="<'); expect(html).not.toContain('style="<');
  });

  it('uses an intentional activity empty state and introduces no page landmarks', () => {
    const html = render(model({ activities: [], steps: [] }));
    expect(html).toContain('No activity yet'); expect(html).toContain('No Page Sections yet');
    expect(html).not.toMatch(/<h1\b|<main\b|class="sidebar"/);
  });

  it('has canonical website loading and error states', () => {
    expect(renderSitePageDetailLoading()).toContain('Loading Site Page details…');
    expect(renderSitePageDetailError('No access', '<button>Retry</button>')).toContain('No access');
  });
});

describe('Site Page Detail main wiring', () => {
  it('delegates only owned website mode to the new renderer and preserves the marketing legacy path', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source).toContain("if (funnelMode === 'website') {");
    expect(source).toContain('funnel.user_id === userId && ownedRoutes.length > 0');
    expect(source).toContain('renderSitePageDetail({');
    expect(source).toContain('renderSitePageDetailLoading()');
    expect(source).toContain('const backTarget = funnelMode === \'marketing\' ? \'marketing-funnels\' : \'funnels\';');
  });

  it('keeps user-owned filtering on metrics and activity data and caps the activity feed', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source).toContain('o.user_id === userId && o.funnel_id === funnelId');
    expect(source).toContain("const logs = (logsAll.data || []).filter((log: any) => log.user_id === userId);");
    expect(source).toContain('const ownedLogs = logs;');
    expect(source).toContain('.slice(0, 15)');
    expect(source).toContain('safePublicUrl');
  });
});
