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
    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (selector === '#wo-shell-drawer-backdrop' && child.id === 'wo-shell-drawer-backdrop') {
          results.push(child);
        } else if (selector === '#wo-shell-drawer' && child.id === 'wo-shell-drawer') {
          results.push(child);
        } else if (selector.includes('data-shell-drawer-toggle') && child.hasAttribute('data-shell-drawer-toggle')) {
          results.push(child);
        } else if (selector.includes('data-shell-drawer-close') && child.hasAttribute('data-shell-drawer-close')) {
          results.push(child);
        } else if (selector.includes('button') && child.tagName === 'BUTTON') {
          results.push(child);
        } else if (selector.includes('.wo-shell-nav-item') && child.getAttribute('class')?.includes('wo-shell-nav-item')) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
  }
}

describe('WashOps Permanent Application Shell Foundation (Phase 1C / Task 7B.1)', () => {
  const cssPath = path.resolve(__dirname, 'application_shell.css');
  const stylePath = path.resolve(__dirname, '../../style.css');

  // ==========================================================================
  // 1. FILE STRUCTURE & TOKEN CONSUMPTION
  // ==========================================================================
  it('A. verifies application_shell.css exists and is imported in style.css', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, 'application_shell.ts'))).toBe(true);

    const styleContent = fs.readFileSync(stylePath, 'utf8');
    expect(styleContent).toMatch(/@import\s+['"]\.\/ui\/shell\/application_shell\.css['"];/m);
  });

  it('B. verifies token consumption in application_shell.css', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    const expectedTokens = [
      'var(--wo-color-surface)',
      'var(--wo-color-interactive)',
      'var(--wo-color-border)',
      'var(--wo-space-2)',
      'var(--wo-space-3)',
      'var(--wo-space-4)',
      'var(--wo-space-6)',
      'var(--wo-radius-md)',
      'var(--wo-radius-full)',
      'var(--wo-shadow-xl)',
      'var(--wo-z-modal)',
      'var(--wo-z-elevated)',
      'var(--wo-focus-ring-outline)'
    ];

    for (const token of expectedTokens) {
      expect(css).toContain(token);
    }
  });

  // ==========================================================================
  // 2. PRIMARY NAVIGATION INFORMATION ARCHITECTURE
  // ==========================================================================
  it('C. verifies default navigation groups contain only real supported destinations', () => {
    const groups = getDefaultNavGroups('dashboard');
    const groupTitles = groups.map(g => g.title);
    expect(groupTitles).toEqual([
      'Core',
      'Customers & Sales',
      'Marketing & Outreach',
      'Websites',
      'System'
    ]);

    const allItems = groups.flatMap(g => g.items);
    const itemIds = allItems.map(i => i.id);

    // All canonical CRM destinations supported in this codebase
    expect(itemIds).toContain('dashboard');
    expect(itemIds).toContain('clients');
    expect(itemIds).toContain('opportunities');
    expect(itemIds).toContain('quotes');
    expect(itemIds).toContain('invoices');
    expect(itemIds).toContain('lead-capture');
    expect(itemIds).toContain('marketing-funnels');
    expect(itemIds).toContain('website-dashboard');
    expect(itemIds).toContain('funnels');
    expect(itemIds).toContain('website-navigation');
    expect(itemIds).toContain('seo-pages');
    expect(itemIds).toContain('website-settings');
    expect(itemIds).toContain('reports');
    expect(itemIds).toContain('quickstart');
    expect(itemIds).toContain('event-logs');
    expect(itemIds).toContain('qa-tools');
  });

  // ==========================================================================
  // 3. ACTIVE ROUTE & SEMANTIC MAPPING
  // ==========================================================================
  it('D. verifies active destination exposes aria-current="page" and active class', () => {
    const sidebarHtml = renderShellSidebar({ activeView: 'clients' });

    expect(sidebarHtml).toContain('data-nav-view="clients" aria-current="page"');
    expect(sidebarHtml).toContain('wo-shell-nav-item--active');
    expect(sidebarHtml).not.toContain('data-nav-view="dashboard" aria-current="page"');
  });

  it('E. verifies secondary detail views map to their parent navigation item', () => {
    // contact-detail maps to clients
    const contactDetailHtml = renderShellSidebar({ activeView: 'contact-detail' });
    expect(contactDetailHtml).toContain('data-nav-view="clients" aria-current="page"');

    // new-quote maps to quotes
    const newQuoteHtml = renderShellSidebar({ activeView: 'new-quote' });
    expect(newQuoteHtml).toContain('data-nav-view="quotes" aria-current="page"');
  });

  // ==========================================================================
  // 4. SECURITY & DATA ESCAPING
  // ==========================================================================
  it('F. verifies dynamic user, business, title, and subtitle data are HTML-escaped', () => {
    const dangerousString = '"><script>alert("xss")</script>&test\'';

    const shellHtml = renderApplicationShell({
      activeView: 'dashboard',
      title: dangerousString,
      subtitle: dangerousString,
      contentHtml: '<p>Safe Content</p>',
      user: {
        name: dangerousString,
        businessName: dangerousString
      }
    });

    expect(shellHtml).not.toContain('<script>');
    expect(shellHtml).toContain('&quot;&gt;&lt;script&gt;');
    expect(shellHtml).toContain('&amp;test&#39;');
  });

  // ==========================================================================
  // 5. DESKTOP SIDEBAR & TOPBAR STRUCTURE
  // ==========================================================================
  it('G. verifies desktop sidebar brand, navigation lists, and user profile region', () => {
    const sidebarHtml = renderShellSidebar({
      activeView: 'dashboard',
      user: {
        name: 'John Doe',
        businessName: 'Sparkle Wash Co.',
        initials: 'JD'
      }
    });

    expect(sidebarHtml).toContain('class="wo-shell-sidebar"');
    expect(sidebarHtml).toContain('class="wo-shell-logo"');
    expect(sidebarHtml).toContain('WashOps');
    expect(sidebarHtml).toContain('class="wo-shell-nav"');
    expect(sidebarHtml).toContain('class="wo-shell-user-section"');
    expect(sidebarHtml).toContain('class="wo-shell-avatar"');
    expect(sidebarHtml).toContain('JD');
    expect(sidebarHtml).toContain('John Doe');
    expect(sidebarHtml).toContain('Sparkle Wash Co.');
    expect(sidebarHtml).toContain('aria-label="Sign out"');
  });

  it('H. verifies topbar title, subtitle, header actions, and mobile menu button', () => {
    const topbarHtml = renderShellTopbar({
      activeView: 'clients',
      title: 'Clients & Leads',
      subtitle: 'Manage all customer records and lead pipelines',
      headerActionsHtml: '<button class="wo-button wo-button--primary">Add Client</button>'
    });

    expect(topbarHtml).toContain('class="wo-shell-topbar"');
    expect(topbarHtml).toContain('class="wo-shell-menu-button"');
    expect(topbarHtml).toContain('aria-label="Open navigation menu"');
    expect(topbarHtml).toContain('aria-expanded="false"');
    expect(topbarHtml).toContain('aria-controls="wo-shell-drawer"');
    expect(topbarHtml).toContain('class="wo-shell-topbar-title">Clients &amp; Leads</h1>');
    expect(topbarHtml).toContain('class="wo-shell-topbar-subtitle">Manage all customer records');
    expect(topbarHtml).toContain('Add Client</button>');
  });

  it('I. verifies application shell standard vs wide layout variants', () => {
    const standardShell = renderApplicationShell({
      activeView: 'dashboard',
      title: 'Dashboard',
      contentHtml: '<div>Standard Content</div>',
      contentVariant: 'standard'
    });
    expect(standardShell).toContain('wo-shell-main wo-shell-main--standard');

    const wideShell = renderApplicationShell({
      activeView: 'clients',
      title: 'Clients & Leads',
      contentHtml: '<div>Wide Table Content</div>',
      contentVariant: 'wide'
    });
    expect(wideShell).toContain('wo-shell-main wo-shell-main--wide');
  });

  // ==========================================================================
  // 6. MOBILE DRAWER INTERACTION CONTROLLER
  // ==========================================================================
  it('J. verifies mobile drawer open, close, background inert, and focus restoration', () => {
    const rootBody = new MockElement('body') as any;

    const container = new MockElement('div') as any;
    container.setAttribute('class', 'wo-shell');

    const menuToggle = new MockElement('button') as any;
    menuToggle.setAttribute('data-shell-drawer-toggle', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    (globalThis as any).document = {
      body: rootBody,
      activeElement: null
    };

    menuToggle.focus();

    const drawerBackdrop = new MockElement('div') as any;
    drawerBackdrop.id = 'wo-shell-drawer-backdrop';
    drawerBackdrop.hidden = true;

    const drawer = new MockElement('div') as any;
    drawer.id = 'wo-shell-drawer';

    const closeBtn = new MockElement('button') as any;
    closeBtn.setAttribute('data-shell-drawer-close', 'true');

    const navBtn = new MockElement('button') as any;
    navBtn.setAttribute('class', 'wo-shell-nav-item');
    navBtn.setAttribute('data-nav-view', 'clients');

    drawer.appendChild(closeBtn);
    drawer.appendChild(navBtn);
    drawerBackdrop.appendChild(drawer);

    const mainSibling = new MockElement('main') as any;
    mainSibling.setAttribute('class', 'wo-shell-main');

    container.appendChild(menuToggle);
    container.appendChild(drawerBackdrop);
    container.appendChild(mainSibling);
    rootBody.appendChild(container);

    (globalThis as any).document = {
      body: rootBody,
      activeElement: menuToggle
    };

    const navigateSpy = vi.fn();
    const controller = initApplicationShell(container, { onNavigate: navigateSpy });

    // 1. Initial state: drawer hidden
    expect(drawerBackdrop.hidden).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    // 2. Open drawer via menu toggle
    menuToggle.dispatchEvent({ type: 'click' });
    expect(drawerBackdrop.hidden).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');
    expect(mainSibling.inert).toBe(true);
    expect(mainSibling.getAttribute('aria-hidden')).toBe('true');

    // 3. Tab trapping
    navBtn.focus();
    drawerBackdrop.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: false });
    expect((globalThis as any).document.activeElement).toBe(closeBtn);

    // 4. Escape key closes drawer and restores focus
    container.dispatchEvent({ type: 'keydown', key: 'Escape' });
    expect(drawerBackdrop.hidden).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(mainSibling.inert).toBe(false);
    expect(mainSibling.getAttribute('aria-hidden')).toBe(null);
    expect((globalThis as any).document.activeElement).toBe(menuToggle);

    // 5. Open again and click nav item inside drawer
    menuToggle.dispatchEvent({ type: 'click' });
    expect(drawerBackdrop.hidden).toBe(false);
    navBtn.dispatchEvent({ type: 'click' });
    expect(drawerBackdrop.hidden).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('clients');

    controller.destroy();
  });
});
