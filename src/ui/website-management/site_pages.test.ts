import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Funnel, Website, WebsiteRoute } from '../../types';
import { createSitePagesViewModel, renderSitePagesContent } from './site_pages';

const website = (id: string, userId = 'u1'): Website => ({ id, user_id: userId, name: `Website ${id}`, domain: 'example.com', subdomain: id, homepage_funnel_id: null, created_at: '', updated_at: '' });
const route = (id: string, websiteId: string, funnelId: string, path: string): WebsiteRoute => ({ id, website_id: websiteId, funnel_id: funnelId, path, created_at: '' });
const funnel = (id: string, userId = 'u1', values: Partial<Funnel> = {}): Funnel => ({ id, user_id: userId, name: `Page ${id}`, status: 'draft', created_at: '', updated_at: '', ...values });

const ownedInput = () => ({
  userId: 'u1',
  activeWebsiteId: 'w1',
  websites: [website('w1'), website('foreign-site', 'u2')],
  routes: [
    route('home-route', 'w1', 'home', '/'),
    route('services-route', 'w1', 'services', '/services'),
    route('foreign-route', 'foreign-site', 'foreign-funnel', '/foreign'),
    route('wrong-website-route', 'foreign-site', 'services', '/not-services')
  ],
  funnels: [funnel('home', 'u1', { name: 'Home', status: 'published' }), funnel('services', 'u1'), funnel('foreign-funnel', 'u2'), funnel('unrouted', 'u1')]
});

describe('Site Pages model', () => {
  it('uses the acting-user owned active website, its routes, and its owned referenced funnels only', () => {
    const model = createSitePagesViewModel(ownedInput());
    expect(model.website?.id).toBe('w1');
    expect(model.rows.map(row => [row.funnel.id, row.route.id])).toEqual([['home', 'home-route'], ['services', 'services-route']]);
    expect(model.rows.map(row => row.funnel.id)).not.toContain('foreign-funnel');
    expect(model.rows.map(row => row.route.id)).not.toContain('wrong-website-route');
  });

  it('fails closed when the active website is foreign or unavailable', () => {
    const input = ownedInput();
    expect(createSitePagesViewModel({ ...input, activeWebsiteId: 'foreign-site' })).toEqual({ rows: [] });
    expect(createSitePagesViewModel({ ...input, activeWebsiteId: 'missing' })).toEqual({ rows: [] });
  });
});

describe('Site Pages renderer', () => {
  it('renders actual paths, preserved statuses, escaped content, and correctly targeted actions', () => {
    const model = createSitePagesViewModel({
      userId: 'u1', activeWebsiteId: 'w1', websites: [website('w1')],
      routes: [route('home-route', 'w1', 'home', '/'), route('page-route', 'w1', 'page', '/<service>')],
      funnels: [funnel('home', 'u1', { name: '', status: 'published' }), funnel('page', 'u1', { name: '<Page>', status: 'draft' })]
    });
    const managed: string[] = [];
    const deleted: Array<[string, string]> = [];
    const html = renderSitePagesContent({
      model,
      renderManageAction: funnelId => { managed.push(funnelId); return `<button data-manage="${funnelId}">Manage</button>`; },
      renderDeleteAction: (routeId, funnelId) => { deleted.push([routeId, funnelId]); return `<button data-delete="${routeId}">Delete</button>`; }
    });
    expect(html).toContain('Untitled Page');
    expect(html).toContain('&lt;Page&gt;');
    expect(html).toContain('/&lt;service&gt;');
    expect(html).toContain('published');
    expect(managed).toEqual(['home', 'page']);
    expect(deleted).toEqual([['page-route', 'page']]);
    expect(html).not.toContain('data-delete="home-route"');
  });

  it('escapes a malformed status label without putting tenant data in CSS classes', () => {
    const model = createSitePagesViewModel({
      userId: 'u1', activeWebsiteId: 'w1', websites: [website('w1')], routes: [route('r1', 'w1', 'f1', '/test')],
      funnels: [funnel('f1', 'u1', { name: '<img src=x>', status: '<script>alert(1)</script>' as Funnel['status'] })]
    });
    const html = renderSitePagesContent({ model, renderManageAction: () => '<button>Manage</button>', renderDeleteAction: () => '<button>Delete</button>' });
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('wo-badge--<script>');
  });

  it('uses an intentional empty state and introduces no page-level landmarks or fabricated analytics', () => {
    const html = renderSitePagesContent({ model: { website: website('w1'), rows: [] }, renderManageAction: () => '', renderDeleteAction: () => '' });
    expect(html).toContain('No Site Pages yet');
    expect(html).toContain('No Site Pages exist for this website yet.');
    expect(html).not.toMatch(/<h1\b|<main\b|class="sidebar"/);
    expect(html).not.toContain('conversion');
  });
});

describe('Marketing Pages legacy path', () => {
  it('retains the existing legacy marketing renderer rather than delegating it to Site Pages', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source).toContain("if (mode === 'website') {");
    expect(source).toContain('renderSitePagesContent({');
    expect(source).toContain("const rowsHtml = displayFunnels.map(funnel => {");
    expect(source).toContain("legacyMode === 'website' ? '📄' : '🎯'");
    expect(source).toContain("window.openNewPageModal('template')");
  });
});
