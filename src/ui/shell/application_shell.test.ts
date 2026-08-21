import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  renderApplicationShell,
  renderShellSidebar,
  renderShellTopbar,
  getDefaultNavGroups,
  initApplicationShell,
  SHELL_ICONS
} from './application_shell';
import {
  renderCard,
  renderField,
  renderSelect,
  getFieldAccessibilityProps
} from '../index';

// Lightweight mock DOM environment for framework-neutral interaction controller testing
class MockElement {
  public tagName: string;
  public id: string = '';
  public disabled: boolean = false;
  public hidden: boolean = false;
  public inert: boolean = false;
  public nodeType: number = 1;
  public offsetParent: any = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  private attributes: Map<string, string> = new Map();
  private listeners: Map<string, Array<(event: any) => void>> = new Map();

  constructor(tagName: string = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
    if (name === 'disabled') this.disabled = true;
    if (name === 'hidden') this.hidden = true;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name === 'disabled') this.disabled = false;
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type: string, listener: (event: any) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter(l => l !== listener));
  }

  dispatchEvent(event: any): boolean {
    event.target = event.target ?? this;
    event.preventDefault = event.preventDefault ?? (() => {});
    let current: MockElement | null = this;
    while (current) {
      const list = current.listeners.get(event.type) ?? [];
      for (const listener of list) {
        listener(event);
      }
      current = current.parentElement;
    }
    return true;
  }

  focus() {
    (globalThis as any).document.activeElement = this;
  }

  closest(selector: string): MockElement | null {
    if (selector.includes('data-shell-drawer-toggle') && this.hasAttribute('data-shell-drawer-toggle')) return this;
    if (selector.includes('data-shell-drawer-close') && this.hasAttribute('data-shell-drawer-close')) return this;
    if (selector.includes('wo-shell-nav-item') && this.getAttribute('class')?.includes('wo-shell-nav-item')) return this;
    if (selector.includes('wo-shell-logo') && this.getAttribute('class')?.includes('wo-shell-logo')) return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }

  contains(element: any): boolean {
    if (element === this) return true;
    for (const child of this.children) {
      if (child === element || child.contains(element)) return true;
    }
    return false;
  }

  querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (el: MockElement) => {
      let matches = false;
      if (selector === '#wo-shell-drawer-backdrop' && el.id === 'wo-shell-drawer-backdrop') matches = true;
      else if (selector === '#wo-shell-drawer' && el.id === 'wo-shell-drawer') matches = true;
      else if (selector === '[data-shell-drawer-toggle]' && el.hasAttribute('data-shell-drawer-toggle')) matches = true;
      else if (selector === '[data-shell-drawer-close]' && el.hasAttribute('data-shell-drawer-close')) matches = true;
      else if (selector === '.wo-shell-nav-item' && el.getAttribute('class')?.includes('wo-shell-nav-item')) matches = true;
      else if (selector.includes('button') && el.tagName === 'BUTTON' && !el.disabled) matches = true;
      else if (selector.includes('[href]') && el.hasAttribute('href')) matches = true;

      if (matches) results.push(el);
      for (const child of el.children) {
        check(child);
      }
    };
    check(this);
    return results;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
  }
}

describe('WashOps Permanent Application Shell (Phase 1C / Task 7B.1)', () => {
  const cssPath = path.resolve(__dirname, 'application_shell.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  const tokensCssPath = path.resolve(__dirname, '../../tokens/tokens.css');
  const tokensCssContent = fs.readFileSync(tokensCssPath, 'utf-8');

  it('A. Token Reference Audit: every var(--wo-*) in application_shell.css is defined in tokens.css or has a fallback', () => {
    // Extract all declared variables in tokens.css: --wo-[a-zA-Z0-9_-]+:
    const declaredVarMatches = tokensCssContent.match(/--wo-[a-zA-Z0-9_-]+(?=\s*:)/g) || [];
    const declaredTokens = new Set(declaredVarMatches);

    // Extract all var(--wo-...) usages in application_shell.css
    const varUsageRegex = /var\(\s*(--wo-[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)/g;
    let match: RegExpExecArray | null;
    const undefinedTokens: string[] = [];

    while ((match = varUsageRegex.exec(cssContent)) !== null) {
      const tokenName = match[1];
      const fallback = match[2];
      if (!declaredTokens.has(tokenName) && !fallback) {
        undefinedTokens.push(tokenName);
      }
    }

    expect(undefinedTokens).toEqual([]);
  });

  it('B. Focus Styling Contract: focus-visible states use valid outline / ring tokens without invalid box-shadow syntax', () => {
    // Verify no box-shadow: var(--wo-focus-ring-outline)
    expect(cssContent).not.toMatch(/box-shadow:\s*var\(--wo-focus-ring-outline\)/);
    // Verify valid outline usages
    expect(cssContent).toContain('outline: var(--wo-focus-ring-outline)');
    expect(cssContent).toContain('outline-offset: var(--wo-focus-outline-offset)');
  });

  it('C. Canonical Navigation Hierarchy: getDefaultNavGroups covers all core, customers, marketing, websites, and system destinations', () => {
    const navGroups = getDefaultNavGroups('dashboard', { clients: 5 });
    expect(navGroups.map(g => g.title)).toEqual([
      'Core',
      'Customers & Sales',
      'Marketing & Outreach',
      'Websites',
      'System'
    ]);

    const core = navGroups.find(g => g.title === 'Core')!;
    expect(core.items.map(i => i.id)).toContain('dashboard');

    const customers = navGroups.find(g => g.title === 'Customers & Sales')!;
    expect(customers.items.map(i => i.id)).toEqual(['clients', 'opportunities', 'quotes', 'invoices']);
    const clientsItem = customers.items.find(i => i.id === 'clients')!;
    expect(clientsItem.badge?.count).toBe(5);
    expect(clientsItem.badge?.variant).toBe('warning');

    const websites = navGroups.find(g => g.title === 'Websites')!;
    expect(websites.items.map(i => i.id)).toEqual([
      'website-dashboard',
      'funnels',
      'website-navigation',
      'seo-pages',
      'website-settings'
    ]);
  });

  it('D. Desktop Sidebar Renderer: renders docked sidebar, grouped semantic navigation, and user section with initials', () => {
    const sidebarHtml = renderShellSidebar({
      activeView: 'dashboard',
      user: {
        name: 'Hansveer Singh',
        businessName: 'PressurePro WashOps'
      }
    });

    expect(sidebarHtml).toContain('class="wo-shell-sidebar"');
    expect(sidebarHtml).toContain('WashOps');
    expect(sidebarHtml).toContain('CRM');
    expect(sidebarHtml).toContain('Hansveer Singh');
    expect(sidebarHtml).toContain('PressurePro WashOps');
    expect(sidebarHtml).toContain('HS'); // avatar initials
    expect(sidebarHtml).toContain('aria-label="Primary Navigation"');
    expect(sidebarHtml).toContain('aria-current="page"'); // Dashboard active
  });

  it('E. Topbar Renderer: renders sticky topbar, title, subtitle, header actions, and responsive menu trigger', () => {
    const topbarHtml = renderShellTopbar({
      activeView: 'clients',
      title: 'Clients & Leads',
      subtitle: 'Manage your customer accounts and leads',
      headerActionsHtml: '<button class="btn-primary">+ Add Lead</button>'
    });

    expect(topbarHtml).toContain('class="wo-shell-topbar"');
    expect(topbarHtml).toContain('data-shell-drawer-toggle');
    expect(topbarHtml).toContain('aria-expanded="false"');
    expect(topbarHtml).toContain('Clients &amp; Leads');
    expect(topbarHtml).toContain('Manage your customer accounts and leads');
    expect(topbarHtml).toContain('<button class="btn-primary">+ Add Lead</button>');
  });

  it('F. Full Application Shell Composition: renders outer frame with sidebar, drawer, topbar, and main content area', () => {
    const shellHtml = renderApplicationShell({
      activeView: 'dashboard',
      title: 'Dashboard Overview',
      contentHtml: '<div class="dashboard-widgets">Metrics</div>',
      contentVariant: 'standard',
      user: {
        name: 'Alex Rivera',
        businessName: 'Apex Wash Services'
      }
    });

    expect(shellHtml).toContain('class="wo-shell"');
    expect(shellHtml).toContain('class="wo-shell-sidebar"');
    expect(shellHtml).toContain('id="wo-shell-drawer-backdrop"');
    expect(shellHtml).toContain('id="wo-shell-drawer"');
    expect(shellHtml).toContain('class="wo-shell-body"');
    expect(shellHtml).toContain('class="wo-shell-topbar"');
    expect(shellHtml).toContain('class="wo-shell-main wo-shell-main--standard"');
    expect(shellHtml).toContain('Metrics');
  });

  it('G. Wide Layout Variant: renders wo-shell-main--wide when contentVariant is wide', () => {
    const shellHtml = renderApplicationShell({
      activeView: 'clients',
      title: 'Clients & Leads',
      contentHtml: '<table class="clients-table"></table>',
      contentVariant: 'wide'
    });

    expect(shellHtml).toContain('class="wo-shell-main wo-shell-main--wide"');
  });

  it('H. Pilot Screen Composition: Dashboard renders full shell with topbar and no duplicate view-header', () => {
    const dashboardContent = `
      <div class="dashboard-grid">
        <div class="card"><h3>Pipeline Value</h3></div>
      </div>
    `;
    const renderedDashboard = renderApplicationShell({
      activeView: 'dashboard',
      title: 'Dashboard Overview',
      contentVariant: 'standard',
      contentHtml: dashboardContent
    });

    expect(renderedDashboard).toContain('class="wo-shell"');
    expect(renderedDashboard).toContain('class="wo-shell-sidebar"');
    expect(renderedDashboard).toContain('class="wo-shell-topbar"');
    expect(renderedDashboard).toContain('id="wo-shell-drawer-backdrop"');
    expect(renderedDashboard).toContain('<h1 class="wo-shell-topbar-title">Dashboard Overview</h1>');
    expect(renderedDashboard).not.toContain('<header class="view-header">');
  });

  it('I. Pilot Screen Composition: Contacts renders wide shell and preserves action slot', () => {
    const contactsContent = `<div class="card"><table class="clients-table"></table></div>`;
    const renderedContacts = renderApplicationShell({
      activeView: 'clients',
      title: 'Clients & Leads',
      headerActionsHtml: '<button class="btn-primary" onclick="window.navigateTo(\'lead-capture\')">+ Add Lead</button>',
      contentVariant: 'wide',
      contentHtml: contactsContent
    });

    expect(renderedContacts).toContain('class="wo-shell"');
    expect(renderedContacts).toContain('class="wo-shell-main wo-shell-main--wide"');
    expect(renderedContacts).toContain('<button class="btn-primary" onclick="window.navigateTo(\'lead-capture\')">+ Add Lead</button>');
    expect(renderedContacts).not.toContain('<header class="view-header">');
  });

  it('J. Pilot Screen Composition: Website Settings Selector renders full shell with primitive card', () => {
    const selectHtml = renderSelect({
      id: 'settings-website-select',
      options: [{ value: 'site-1', label: 'Main Website' }]
    });
    const fieldHtml = renderField({
      id: 'settings-website-select',
      label: 'Website',
      controlHtml: selectHtml
    });
    const cardHtml = renderCard({
      title: 'Choose a website',
      bodyHtml: fieldHtml
    });
    const selectorContent = `<section class="website-settings-selection-container">${cardHtml}</section>`;

    const renderedSelector = renderApplicationShell({
      activeView: 'website-settings',
      title: 'Website Branding & Tracking',
      contentVariant: 'standard',
      contentHtml: selectorContent
    });

    expect(renderedSelector).toContain('class="wo-shell"');
    expect(renderedSelector).toContain('<h1 class="wo-shell-topbar-title">Website Branding &amp; Tracking</h1>');
    expect(renderedSelector).toContain('settings-website-select');
    expect(renderedSelector).not.toContain('<header class="view-header">');
  });

  it('K. Security & XSS Escaping: dangerous characters in user names and titles are escaped in shell output', () => {
    const shellHtml = renderApplicationShell({
      activeView: 'dashboard',
      title: '<script>alert("xss")</script>',
      subtitle: '<img src=x onerror=alert(1)>',
      user: {
        name: 'Jane <script>alert("u")</script>',
        businessName: 'Business & "Co"'
      },
      contentHtml: '<div>Safe</div>'
    });

    expect(shellHtml).not.toContain('<script>alert("xss")</script>');
    expect(shellHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(shellHtml).not.toContain('<script>alert("u")</script>');
    expect(shellHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(shellHtml).toContain('Business &amp; &quot;Co&quot;');
  });

  it('L. Mobile Drawer Lifecycle & Single-Fire Navigation: opens, closes, traps focus, isolates background, and fires navigation exactly once', () => {
    // Setup Mock DOM Tree
    (globalThis as any).document = { activeElement: null, body: new MockElement('body') };

    const body = (globalThis as any).document.body;
    const container = new MockElement('div');
    body.appendChild(container);

    const mainSibling = new MockElement('main');
    container.appendChild(mainSibling);

    const menuToggle = new MockElement('button');
    menuToggle.setAttribute('data-shell-drawer-toggle', '');
    container.appendChild(menuToggle);

    const drawerBackdrop = new MockElement('div');
    drawerBackdrop.setAttribute('id', 'wo-shell-drawer-backdrop');
    drawerBackdrop.setAttribute('hidden', '');
    container.appendChild(drawerBackdrop);

    const drawer = new MockElement('div');
    drawer.setAttribute('id', 'wo-shell-drawer');
    drawerBackdrop.appendChild(drawer);

    const closeBtn = new MockElement('button');
    closeBtn.setAttribute('data-shell-drawer-close', '');
    drawer.appendChild(closeBtn);

    const navLink = new MockElement('a');
    navLink.setAttribute('class', 'wo-shell-nav-item');
    navLink.setAttribute('data-nav-view', 'clients');
    navLink.setAttribute('href', '#/clients');
    drawer.appendChild(navLink);

    let navigatedTarget: any = null;
    let navigateCount = 0;
    const onNavigate = (target: any) => {
      navigatedTarget = target;
      navigateCount += 1;
    };

    const controller = initApplicationShell(container as any, { onNavigate });

    // Initial state: drawer hidden, background not inert
    expect(drawerBackdrop.hidden).toBe(true);
    expect(mainSibling.inert).toBe(false);

    // 1. Open drawer via toggle button
    menuToggle.dispatchEvent({ type: 'click' });
    expect(drawerBackdrop.hidden).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');
    expect(mainSibling.inert).toBe(true);
    expect((globalThis as any).document.activeElement).toBe(closeBtn);

    // 2. Click nav link inside drawer -> closes drawer and calls onNavigate EXACTLY ONCE
    navLink.dispatchEvent({ type: 'click' });
    expect(drawerBackdrop.hidden).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(mainSibling.inert).toBe(false);
    expect(navigatedTarget).toEqual({ kind: 'view', view: 'clients' });
    expect(navigateCount).toBe(1);

    // 3. Open drawer again
    controller.openDrawer();
    expect(drawerBackdrop.hidden).toBe(false);
    expect((globalThis as any).document.activeElement).toBe(closeBtn);

    // 4. Escape key closes drawer and restores focus
    container.dispatchEvent({ type: 'keydown', key: 'Escape' });
    expect(drawerBackdrop.hidden).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(mainSibling.inert).toBe(false);
    expect((globalThis as any).document.activeElement).toBe(menuToggle);

    // 5. Cleanup / Destroy
    controller.destroy();
  });

  it('M. ShellNavItem href Contract: no generated href starts with (\\#', () => {
    const renderedSidebar = renderShellSidebar({ activeView: 'dashboard' });
    expect(renderedSidebar).not.toMatch(/href=["']\(#/);
    expect(renderedSidebar).toContain('href="#/dashboard"');
    expect(renderedSidebar).toContain('href="#/clients"');
  });

  it('N. Typed Shell Navigation Targets: verify default nav groups specify typed targets for CRM and Website views', () => {
    const groups = getDefaultNavGroups('dashboard');
    const allItems = groups.flatMap(g => g.items);

    const dashboardItem = allItems.find(i => i.id === 'dashboard');
    expect(dashboardItem?.navTarget).toEqual({ kind: 'view', view: 'dashboard' });

    const clientsItem = allItems.find(i => i.id === 'clients');
    expect(clientsItem?.navTarget).toEqual({ kind: 'view', view: 'clients' });

    const websiteSettingsItem = allItems.find(i => i.id === 'website-settings');
    expect(websiteSettingsItem?.navTarget).toEqual({ kind: 'website-settings' });

    const funnelsItem = allItems.find(i => i.id === 'funnels');
    expect(funnelsItem?.navTarget).toEqual({ kind: 'website-management', view: 'funnels' });

    const navItem = allItems.find(i => i.id === 'website-navigation');
    expect(navItem?.navTarget).toEqual({ kind: 'website-management', view: 'website-navigation' });

    const seoItem = allItems.find(i => i.id === 'seo-pages');
    expect(seoItem?.navTarget).toEqual({ kind: 'website-management', view: 'seo-pages' });
  });

  it('O. Desktop Single-Fire Navigation: clicking desktop nav item invokes onNavigate with typed target exactly once', () => {
    const container = new MockElement('div');
    const navLink = new MockElement('a');
    navLink.setAttribute('class', 'wo-shell-nav-item');
    navLink.setAttribute('data-nav-view', 'quotes');
    navLink.setAttribute('data-nav-target', JSON.stringify({ kind: 'view', view: 'quotes' }));
    navLink.setAttribute('href', '#/quotes');
    container.appendChild(navLink);

    let receivedTarget: any = null;
    let clickCount = 0;

    const controller = initApplicationShell(container as any, {
      onNavigate: (target) => {
        receivedTarget = target;
        clickCount += 1;
      }
    });

    navLink.dispatchEvent({ type: 'click' });
    expect(clickCount).toBe(1);
    expect(receivedTarget).toEqual({ kind: 'view', view: 'quotes' });

    controller.destroy();
  });

  it('P. Brand Logo Navigation: clicking WashOps logo invokes onNavigate with dashboard target', () => {
    const container = new MockElement('div');
    const logoLink = new MockElement('a');
    logoLink.setAttribute('class', 'wo-shell-logo');
    logoLink.setAttribute('data-nav-target', JSON.stringify({ kind: 'view', view: 'dashboard' }));
    logoLink.setAttribute('href', '#/dashboard');
    container.appendChild(logoLink);

    let receivedTarget: any = null;
    let clickCount = 0;

    const controller = initApplicationShell(container as any, {
      onNavigate: (target) => {
        receivedTarget = target;
        clickCount += 1;
      }
    });

    logoLink.dispatchEvent({ type: 'click' });
    expect(clickCount).toBe(1);
    expect(receivedTarget).toEqual({ kind: 'view', view: 'dashboard' });

    controller.destroy();
  });

  it('Q. Touch-Target Contract in CSS: menu button and drawer items use --wo-min-touch-target', () => {
    expect(cssContent).toMatch(/\.wo-shell-menu-button\s*\{[^}]*min-width:\s*var\(--wo-min-touch-target/);
    expect(cssContent).toMatch(/\.wo-shell-drawer\s+\.wo-shell-nav-item\s*\{[^}]*min-height:\s*var\(--wo-min-touch-target/);
  });
});
