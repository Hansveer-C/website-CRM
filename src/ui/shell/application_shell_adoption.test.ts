import { describe, it, expect } from 'vitest';
import {
  renderAppWithShell,
  renderShellSidebar,
  renderShellTopbar,
  renderShellDrawer,
  resolveActiveNavId,
  renderApplicationShell,
  SHELL_NAV_GROUPS
} from './application_shell';
import * as fs from 'fs';
import * as path from 'path';

describe('Task 7B.2 Application Shell Adoption & Navigation Resolution', () => {
  describe('resolveActiveNavId', () => {
    it('resolves direct top-level views', () => {
      expect(resolveActiveNavId('dashboard')).toBe('dashboard');
      expect(resolveActiveNavId('clients')).toBe('clients');
      expect(resolveActiveNavId('opportunities')).toBe('opportunities');
      expect(resolveActiveNavId('quotes')).toBe('quotes');
      expect(resolveActiveNavId('invoices')).toBe('invoices');
      expect(resolveActiveNavId('funnels')).toBe('funnels');
      expect(resolveActiveNavId('marketing-funnels')).toBe('marketing-funnels');
      expect(resolveActiveNavId('website-dashboard')).toBe('website-dashboard');
      expect(resolveActiveNavId('website-navigation')).toBe('website-navigation');
      expect(resolveActiveNavId('seo-pages')).toBe('seo-pages');
      expect(resolveActiveNavId('reports')).toBe('reports');
      expect(resolveActiveNavId('quickstart')).toBe('quickstart');
      expect(resolveActiveNavId('lead-capture')).toBe('lead-capture');
      expect(resolveActiveNavId('event-logs')).toBe('event-logs');
      expect(resolveActiveNavId('qa-tools')).toBe('qa-tools');
      expect(resolveActiveNavId('website-settings')).toBe('website-settings');
    });

    it('resolves nested CRM subroutes to parent nav destinations', () => {
      expect(resolveActiveNavId('contact-detail')).toBe('clients');
      expect(resolveActiveNavId('new-quote')).toBe('quotes');
      expect(resolveActiveNavId('quote-preview')).toBe('quotes');
      expect(resolveActiveNavId('funnel-detail')).toBe('funnels');
      expect(resolveActiveNavId('pages')).toBe('funnels');
      expect(resolveActiveNavId('page-sections')).toBe('funnels');
      expect(resolveActiveNavId('website-structure')).toBe('funnels');
      expect(resolveActiveNavId('templates')).toBe('funnels');
      expect(resolveActiveNavId('components')).toBe('funnels');
      expect(resolveActiveNavId('pages-seo')).toBe('seo-pages');
    });
  });

  describe('renderApplicationShell HTML contract for ordinary CRM routes', () => {
    const ordinaryViews = [
      { view: 'dashboard', title: 'Dashboard' },
      { view: 'clients', title: 'Clients' },
      { view: 'contact-detail', title: 'John Doe' },
      { view: 'opportunities', title: 'Pipeline' },
      { view: 'quotes', title: 'Quotes' },
      { view: 'new-quote', title: 'Create Quote' },
      { view: 'quote-preview', title: 'Quote Preview' },
      { view: 'invoices', title: 'Invoices' },
      { view: 'lead-capture', title: 'Lead Capture' },
      { view: 'funnels', title: 'Site Pages' },
      { view: 'marketing-funnels', title: 'Marketing Pages' },
      { view: 'funnel-detail', title: 'Funnel Detail' },
      { view: 'pages', title: 'All Website Sections' },
      { view: 'page-sections', title: 'Page Sections' },
      { view: 'templates', title: 'Website Templates' },
      { view: 'components', title: 'Components Shelf' },
      { view: 'website-dashboard', title: 'Website Dashboard' },
      { view: 'website-navigation', title: 'Navigation Menus' },
      { view: 'website-structure', title: 'Website Structure' },
      { view: 'seo-pages', title: 'Local SEO Hub' },
      { view: 'pages-seo', title: 'Pages & SEO' },
      { view: 'website-settings', title: 'Website Settings' },
      { view: 'reports', title: 'Reports & Analytics' },
      { view: 'quickstart', title: 'Quickstart Guide' },
      { view: 'event-logs', title: 'System Event Logs' },
      { view: 'qa-tools', title: 'QA Tools' }
    ];

    it.each(ordinaryViews)('generates valid shell markup with active nav highlight for view "$view"', ({
      view,
      title
    }) => {
      const html = renderApplicationShell({
        activeView: view,
        title,
        contentVariant: 'wide',
        contentHtml: `<div class="test-content">Content for ${view}</div>`
      });

      expect(html).toContain('class="wo-shell"');
      expect(html).toContain('class="wo-shell-sidebar"');
      expect(html).toContain('class="wo-shell-topbar"');
      expect(html).toContain('class="wo-shell-drawer"');
      expect(html).toContain('class="wo-shell-main');
      expect(html).toContain(`Content for ${view}`);

      const expectedActiveNav = resolveActiveNavId(view);
      expect(html).toContain('data-nav-view="' + expectedActiveNav + '"');
      expect(html).toContain('wo-shell-nav-item--active');
      expect(html).toContain('aria-current="page"');
    });

    it('renders wide and standard content variants correctly', () => {
      const wideHtml = renderApplicationShell({
        activeView: 'dashboard',
        title: 'Dashboard',
        contentVariant: 'wide',
        contentHtml: '<div>Wide content</div>'
      });
      expect(wideHtml).toContain('wo-shell-main--wide');

      const standardHtml = renderApplicationShell({
        activeView: 'quickstart',
        title: 'Quickstart Guide',
        contentVariant: 'standard',
        contentHtml: '<div>Standard content</div>'
      });

      expect(standardHtml).toContain('wo-shell-main--standard');
    });

    it('renders subtitles and header actions when provided', () => {
      const html = renderApplicationShell({
        activeView: 'quotes',
        title: 'Quotes',
        subtitle: 'Manage all customer estimates',
        headerActionsHtml: '<button id="test-btn">+ New Quote</button>',
        contentHtml: '<div>Quotes list</div>'
      });

      expect(html).toContain('Manage all customer estimates');
      expect(html).toContain('<button id="test-btn">+ New Quote</button>');
    });
  });

  describe('Legacy Sidebar Deletion Verification', () => {
    it('verifies renderLegacySidebar is completely absent from main.ts', () => {
      const mainContent = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');
      expect(mainContent.includes('function renderLegacySidebar')).toBe(false);
      expect(mainContent.includes('renderLegacySidebar(')).toBe(false);
      expect(mainContent.includes('function renderSidebar(')).toBe(false);
      expect(mainContent.includes('renderSidebar(')).toBe(false);
    });
  });

  describe('Print Style Contract', () => {
    it('verifies application_shell.css contains @media print rules that hide shell and reset main padding', () => {
      const cssContent = fs.readFileSync(path.resolve(__dirname, 'application_shell.css'), 'utf8');
      expect(cssContent).toContain('@media print');
      expect(cssContent).toContain('.wo-shell-sidebar');
      expect(cssContent).toContain('.wo-shell-topbar');
      expect(cssContent).toContain('.wo-shell-drawer');
      expect(cssContent).toContain('.no-print');
      expect(cssContent).toContain('display: none !important');
    });
  });
});
