import { describe, expect, it } from 'vitest';
import type { Website } from '../../types';
import {
  renderWebsiteDashboardEmpty,
  renderWebsiteDashboardError,
  renderWebsiteDashboardLoading,
  renderWebsiteDashboardSelectionRequired,
  renderWebsiteDashboardUnavailable,
  renderWebsiteManagementSelectorContent,
  renderWebsiteManagementSwitcher
} from './website_dashboard_states';

const website = (id: string, userId = 'u1', name = `Site ${id}`, domain: string | null = 'example.com'): Website => ({
  id, user_id: userId, name, domain, subdomain: id, homepage_funnel_id: null, created_at: '', updated_at: ''
});

describe('Website Dashboard state renderers', () => {
  it('renders the loading state with understandable status semantics', () => {
    const html = renderWebsiteDashboardLoading();
    expect(html).toContain('Loading website dashboard…');
    expect(html).toContain('role="status"');
  });

  it('renders only supplied websites in the selection state and escapes their values', () => {
    const html = renderWebsiteDashboardSelectionRequired([
      website('owned', 'u1', '<Owned>', '<owned.example>')
    ]);
    expect(html).toContain('Choose a website');
    expect(html).toContain('&lt;Owned&gt; — &lt;owned.example&gt;');
    expect(html).toContain('value="owned"');
    expect(html).toContain('window.selectDashboardWebsite(this.value)');
    expect(html).not.toContain('foreign');
  });

  it('preserves empty, unavailable, and error state actions and their distinct semantics', () => {
    const empty = renderWebsiteDashboardEmpty();
    const unavailable = renderWebsiteDashboardUnavailable();
    const error = renderWebsiteDashboardError();
    expect(empty).toContain('Create your first website.');
    expect(empty).toContain('window.showOnboardingModal()');
    expect(empty).toContain('window.refreshWebsiteDashboard()');
    expect(unavailable).toContain('This website is not available.');
    expect(unavailable).toContain('window.refreshWebsiteDashboard()');
    expect(unavailable).not.toContain('window.showOnboardingModal()');
    expect(error).toContain('Website information could not be loaded.');
    expect(error).toContain('Please try again.');
    expect(error).toContain('window.refreshWebsiteDashboard()');
  });

  it('introduces no h1, main landmark, or legacy sidebar in any non-ready state', () => {
    const html = [
      renderWebsiteDashboardLoading(),
      renderWebsiteDashboardSelectionRequired([]),
      renderWebsiteDashboardEmpty(),
      renderWebsiteDashboardUnavailable(),
      renderWebsiteDashboardError()
    ].join('');
    expect(html).not.toMatch(/<h1\b|<main\b|class="sidebar"/);
  });
});

describe('Website management shared controls', () => {
  it('uses only supplied selector websites, represents invalid selection, escapes values, and preserves the target view', () => {
    const html = renderWebsiteManagementSelectorContent({
      view: 'website-navigation',
      title: 'Website Navigation',
      invalid: true,
      websites: [website('owned', 'u1', '<Owned>', '<owned.example>')]
    });
    expect(html).toContain('That website is not available for this account. Choose an owned website.');
    expect(html).toContain('&lt;Owned&gt; — &lt;owned.example&gt;');
    expect(html).toContain('window.selectWebsiteForManagement(&#39;website-navigation&#39;, this.value)');
    expect(html).not.toContain('foreign');
  });

  it('filters switcher websites by acting user, keeps the active website selected, and hides when context is insufficient', () => {
    const websites = [
      website('one', 'u1', '<One>', '<one.example>'),
      website('two', 'u1', 'Two', 'two.example'),
      website('foreign', 'u2', 'FOREIGN SITE', 'foreign.example')
    ];
    const html = renderWebsiteManagementSwitcher({ view: 'funnels', websites, actingUserId: 'u1', activeWebsiteId: 'two' });
    expect(html).toContain('&lt;One&gt; — &lt;one.example&gt;');
    expect(html).toContain('value="two" selected');
    expect(html).toContain('window.selectWebsiteForManagement(&#39;funnels&#39;, this.value)');
    expect(html).not.toContain('FOREIGN SITE');
    expect(renderWebsiteManagementSwitcher({ view: 'funnels', websites: [websites[0], websites[2]], actingUserId: 'u1', activeWebsiteId: 'one' })).toBe('');
    expect(renderWebsiteManagementSwitcher({ view: 'funnels', websites, actingUserId: 'u1', activeWebsiteId: null })).toBe('');
  });
});
