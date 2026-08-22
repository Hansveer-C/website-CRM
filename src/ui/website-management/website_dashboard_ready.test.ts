import { describe, expect, it } from 'vitest';
import type { WebsiteDashboardModel } from '../../website_dashboard_model';
import { renderApplicationShell } from '../shell';
import { renderWebsiteDashboardReady } from './website_dashboard_ready';

const actions: WebsiteDashboardModel['actions'] = {
  edit: { enabled: true }, pages: { enabled: true }, settings: { enabled: true }, assets: { enabled: false, reason: 'Assets unavailable <now>' }, guidedSetup: { enabled: true }, preview: { enabled: true }, publish: { enabled: false, reason: 'Publish is unavailable <now>' }, viewLive: { enabled: true }
};
const model: WebsiteDashboardModel = {
  website: { id: 'w1', name: '<Wash & Go>', publicHost: 'wash<script>.example' },
  homepage: { state: 'resolved', id: 'p1', name: '<Home>', path: '/<home>', legacyPageStatus: 'draft', publicationState: 'unpublished-changes', lastPublishedAt: '2026-08-21T10:00:00.000Z' },
  currentPage: { id: 'p1', name: 'Home' }, counts: { pages: 7, draftPages: 3, pagesWithTargets: 2, mediaAssets: null },
  readiness: { homepage: true, publicHost: true, settings: true, setupBriefVersion: 4 }, publicUrl: 'https://wash.example', actions
};
const websites = [{ id: 'w1', user_id: 'owner', name: 'Primary', domain: 'primary.example', subdomain: 'primary', created_at: '' }, { id: 'w2', user_id: 'owner', name: '<Second>', domain: '<second.example>', subdomain: 'second', created_at: '' }];
const renderAction = (key: keyof WebsiteDashboardModel['actions'], label: string) => { const action = model.actions[key]; const reasonId = `reason-${key}`; return `<div><button type="button" ${action.enabled ? '' : 'disabled'}${action.reason ? ` aria-describedby="${reasonId}"` : ''}>${label}</button>${action.reason ? `<span id="${reasonId}">${action.reason.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>` : ''}</div>`; };
const ready = (overrides = {}) => renderWebsiteDashboardReady({ model, websites, publicationLabel: 'Changes waiting to be published', renderAction, ...overrides });

describe('Website Dashboard ready renderer', () => {
  it('escapes website, host, homepage, path, and switcher values', () => {
    const html = ready();
    expect(html).toContain('&lt;Wash &amp; Go&gt;');
    expect(html).toContain('wash&lt;script&gt;.example');
    expect(html).toContain('&lt;Home&gt;');
    expect(html).toContain('/&lt;home&gt;');
    expect(html).toContain('&lt;Second&gt;');
    expect(html).not.toContain('<script>');
  });

  it('preserves publication and homepage facts', () => {
    const html = ready();
    expect(html).toContain('Changes waiting to be published');
    expect(html).toContain('Page row status');
    expect(html).toContain('Last published');
  });

  it('preserves enabled and disabled primary action contracts and reasons', () => {
    const html = ready();
    expect(html).toMatch(/<button type="button" >Edit Home Page/);
    expect(html).toMatch(/<button type="button" disabled aria-describedby="reason-publish">Publish/);
    expect(html).toContain('id="reason-publish"');
    expect(html).toContain('Publish is unavailable &lt;now&gt;');
  });

  it('uses supplied quick-action availability and supplied summary values', () => {
    const html = ready();
    expect(html).toContain('Manage Pages');
    expect(html).toMatch(/<button type="button" disabled aria-describedby="reason-assets">Assets/);
    expect(html).toContain('>7<');
    expect(html).toContain('>3<');
    expect(html).toContain('Media count unavailable');
    expect(html).not.toContain('>0</strong><span>Media assets');
    expect(html).toContain('>v4<');
  });

  it('introduces no page landmark, h1, legacy sidebar, or fabricated analytics', () => {
    const content = ready();
    expect(content).not.toMatch(/<h1\b|<main\b|class="sidebar"/);
    expect(content).not.toContain('conversion rate');
    const shell = renderApplicationShell({ activeView: 'website-dashboard', title: 'Website Dashboard', contentVariant: 'wide', contentHtml: content });
    expect((shell.match(/class="wo-shell"/g) ?? []).length).toBe(1);
    expect((shell.match(/<main\b/g) ?? []).length).toBe(1);
    expect((shell.match(/<h1\b/g) ?? []).length).toBe(1);
  });
});
