import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  renderButton,
  renderField,
  getFieldAccessibilityProps,
  renderInput,
  renderSelect,
  renderTextarea,
  renderCheckbox,
  renderSwitch,
  initSwitch,
  renderCard,
  renderBadge,
  renderStatusBadge,
  renderTabs,
  renderTabPanel,
  initTabs,
  renderTable,
  renderDialog,
  initDialog,
  renderAlert,
  renderSpinner,
  renderEmptyState,
  renderErrorState
} from './primitives';

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
    if (selector.includes('role="tab"') && this.getAttribute('role') === 'tab') return this;
    if (selector.includes('data-dialog-close') && this.hasAttribute('data-dialog-close')) return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }

  contains(element: any): boolean {
    if (element === this) return true;
    for (const child of this.children) {
      if (child === element || child.contains(element)) return true;
    }
    return false;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (selector.includes('[role="tab"]') && child.getAttribute('role') === 'tab') {
          results.push(child);
        } else if (selector.includes('button') && child.tagName === 'BUTTON') {
          results.push(child);
        } else if (selector.includes('input') && child.tagName === 'INPUT') {
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

describe('WashOps Canonical UI Primitives (Phase 1C / Task 7A.2)', () => {
  const cssPath = path.resolve(__dirname, 'primitives.css');
  const stylePath = path.resolve(__dirname, '../style.css');

  // ==========================================================================
  // 1. FILE STRUCTURE & TOKEN INTEGRATION
  // ==========================================================================
  it('A. verifies that primitives.css and primitives.ts exist and style.css imports primitives.css', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, 'primitives.ts'))).toBe(true);

    const styleContent = fs.readFileSync(stylePath, 'utf8');
    expect(styleContent).toMatch(/@import\s+['"]\.\/ui\/primitives\.css['"];/m);
  });

  it('B. verifies that all required primitive families exist in primitives.css', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    const requiredClasses = [
      '.wo-button',
      '.wo-button--primary',
      '.wo-button--secondary',
      '.wo-button--ghost',
      '.wo-button--danger',
      '.wo-button--icon',
      '.wo-button--sm',
      '.wo-button--md',
      '.wo-button--lg',
      '.wo-button--loading',
      '.wo-field',
      '.wo-label',
      '.wo-required-marker',
      '.wo-input',
      '.wo-select',
      '.wo-textarea',
      '.wo-field-helper',
      '.wo-field-error',
      '.wo-checkbox',
      '.wo-checkbox-label',
      '.wo-switch',
      '.wo-switch-label',
      '.wo-switch-thumb',
      '.wo-card',
      '.wo-card--elevated',
      '.wo-card--interactive',
      '.wo-card-header',
      '.wo-card-title',
      '.wo-card-body',
      '.wo-card-footer',
      '.wo-badge',
      '.wo-badge--neutral',
      '.wo-badge--info',
      '.wo-badge--success',
      '.wo-badge--warning',
      '.wo-badge--danger',
      '.wo-tabs',
      '.wo-tab',
      '.wo-tab-panel',
      '.wo-table-container',
      '.wo-table',
      '.wo-table-empty-cell',
      '.wo-dialog-backdrop',
      '.wo-dialog-backdrop[hidden]',
      '.wo-dialog',
      '.wo-dialog-header',
      '.wo-dialog-title',
      '.wo-dialog-body',
      '.wo-dialog-footer',
      '.wo-alert',
      '.wo-alert--info',
      '.wo-alert--success',
      '.wo-alert--warning',
      '.wo-alert--danger',
      '.wo-spinner',
      '.wo-empty-state',
      '.wo-error-state'
    ];

    for (const cls of requiredClasses) {
      expect(css).toContain(cls);
    }
  });

  it('C. verifies that primitives.css strictly consumes canonical --wo-* design tokens', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--wo-color-interactive)');
    expect(css).toContain('var(--wo-color-surface)');
    expect(css).toContain('var(--wo-color-border)');
    expect(css).toContain('var(--wo-space-2)');
    expect(css).toContain('var(--wo-space-4)');
    expect(css).toContain('var(--wo-space-8)');
    expect(css).toContain('var(--wo-radius-md)');
    expect(css).toContain('var(--wo-radius-lg)');
    expect(css).toContain('var(--wo-shadow-xs)');
    expect(css).toContain('var(--wo-shadow-xl)');
    expect(css).toContain('var(--wo-z-modal)');
    expect(css).toContain('var(--wo-focus-ring-outline)');
    expect(css).toContain('var(--wo-color-backdrop-overlay)');
  });

  // ==========================================================================
  // 2. BUTTON PRIMITIVE & HARDENING
  // ==========================================================================
  it('D. verifies renderButton variant, size, loading, and disabled contracts', () => {
    // Primary Button
    const primaryHtml = renderButton({ label: 'Save Changes', variant: 'primary', size: 'md' });
    expect(primaryHtml).toContain('class="wo-button wo-button--primary wo-button--md"');
    expect(primaryHtml).toContain('<span>Save Changes</span>');

    // Loading Button: must expose aria-busy and disabled attribute to prevent repeated activation
    const loadingHtml = renderButton({ label: 'Processing', variant: 'primary', loading: true });
    expect(loadingHtml).toContain('wo-button--loading');
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('disabled');
    expect(loadingHtml).toContain('wo-spinner');
    expect(loadingHtml).toContain('<span>Processing</span>');

    // Disabled Button
    const disabledHtml = renderButton({ label: 'Delete', variant: 'danger', disabled: true });
    expect(disabledHtml).toContain('wo-button--danger');
    expect(disabledHtml).toContain('disabled');
  });

  it('E. verifies icon-only button accessible name fallback and icon trust boundary', () => {
    // Explicit ariaLabel
    const explicitIconBtn = renderButton({ label: 'Close', icon: '✕', iconOnly: true, ariaLabel: 'Dismiss Modal' });
    expect(explicitIconBtn).toContain('wo-button--icon');
    expect(explicitIconBtn).toContain('aria-label="Dismiss Modal"');
    expect(explicitIconBtn).toContain('<span class="wo-sr-only">Dismiss Modal</span>');
    expect(explicitIconBtn).toContain('<span class="wo-button-icon" aria-hidden="true">✕</span>');

    // Fallback to label when ariaLabel is omitted
    const fallbackIconBtn = renderButton({ label: 'Close dialog', icon: '✕', iconOnly: true });
    expect(fallbackIconBtn).toContain('aria-label="Close dialog"');
    expect(fallbackIconBtn).toContain('<span class="wo-sr-only">Close dialog</span>');

    // Trusted developer HTML icon markup
    const trustedSvgBtn = renderButton({
      label: 'Search',
      iconHtml: '<svg class="icon-search"><path d="M0 0h24v24H0z"/></svg>'
    });
    expect(trustedSvgBtn).toContain('<svg class="icon-search"><path d="M0 0h24v24H0z"/></svg>');
  });

  // ==========================================================================
  // 3. FORM CONTROLS & ACCESSIBILITY LINKAGE
  // ==========================================================================
  it('F. verifies renderField and getFieldAccessibilityProps semantic linkage', () => {
    const a11y = getFieldAccessibilityProps('user-email', { hasHelper: true, hasError: true });
    expect(a11y.helperId).toBe('user-email-helper');
    expect(a11y.errorId).toBe('user-email-error');
    expect(a11y.describedBy).toBe('user-email-helper user-email-error');
    expect(a11y.invalid).toBe(true);

    const fieldHtml = renderField({
      id: 'user-email',
      label: 'Email Address',
      required: true,
      helperText: 'We will never share your email.',
      errorMessage: 'Please enter a valid email address.',
      controlHtml: renderInput({
        id: 'user-email',
        type: 'email',
        invalid: a11y.invalid,
        describedBy: a11y.describedBy
      })
    });

    expect(fieldHtml).toContain('for="user-email"');
    expect(fieldHtml).toContain('class="wo-required-marker"');
    expect(fieldHtml).toContain('id="user-email-helper"');
    expect(fieldHtml).toContain('id="user-email-error"');
    expect(fieldHtml).toContain('role="alert"');
    expect(fieldHtml).toContain('aria-invalid="true"');
    expect(fieldHtml).toContain('aria-describedby="user-email-helper user-email-error"');
  });

  it('G. verifies select, textarea, checkbox, and switch primitive contracts', () => {
    // Select
    const selectHtml = renderSelect({
      id: 'site-selector',
      options: [
        { value: '', label: 'Select site' },
        { value: 'site-1', label: 'WashOps HQ', selected: true }
      ]
    });
    expect(selectHtml).toContain('id="site-selector"');
    expect(selectHtml).toContain('<option value="site-1" selected>WashOps HQ</option>');

    // Textarea
    const textareaHtml = renderTextarea({
      id: 'feedback-msg',
      value: 'Great service!',
      rows: 4
    });
    expect(textareaHtml).toContain('id="feedback-msg"');
    expect(textareaHtml).toContain('rows="4"');
    expect(textareaHtml).toContain('>Great service!</textarea>');

    // Checkbox
    const checkboxHtml = renderCheckbox({
      id: 'accept-terms',
      name: 'terms',
      label: 'I accept the terms and conditions',
      checked: true,
      required: true
    });
    expect(checkboxHtml).toContain('class="wo-checkbox-label" for="accept-terms"');
    expect(checkboxHtml).toContain('type="checkbox" id="accept-terms" class="wo-checkbox" name="terms" checked required');
    expect(checkboxHtml).toContain('<span>I accept the terms and conditions</span>');

    // Switch
    const switchHtml = renderSwitch({
      id: 'notifications-toggle',
      label: 'Enable SMS notifications',
      checked: false
    });
    expect(switchHtml).toContain('class="wo-switch-label" for="notifications-toggle"');
    expect(switchHtml).toContain('type="button" role="switch" id="notifications-toggle" aria-checked="false" class="wo-switch"');
    expect(switchHtml).toContain('aria-label="Enable SMS notifications"');
    expect(switchHtml).toContain('<span class="wo-switch-thumb" aria-hidden="true"></span>');
  });

  it('H. verifies switch interaction controller (initSwitch)', () => {
    const buttonEl = new MockElement('button') as any;
    buttonEl.setAttribute('id', 'test-switch');
    buttonEl.setAttribute('role', 'switch');
    buttonEl.setAttribute('aria-checked', 'false');

    const toggleSpy = vi.fn();
    const cleanup = initSwitch(buttonEl, toggleSpy);

    // Initial click: false -> true
    buttonEl.dispatchEvent({ type: 'click' });
    expect(buttonEl.getAttribute('aria-checked')).toBe('true');
    expect(toggleSpy).toHaveBeenCalledWith(true);

    // Space keydown: true -> false
    buttonEl.dispatchEvent({ type: 'keydown', key: ' ' });
    expect(buttonEl.getAttribute('aria-checked')).toBe('false');
    expect(toggleSpy).toHaveBeenCalledWith(false);

    // Disabled switch ignores interaction
    buttonEl.disabled = true;
    buttonEl.dispatchEvent({ type: 'click' });
    expect(buttonEl.getAttribute('aria-checked')).toBe('false');
    expect(toggleSpy).toHaveBeenCalledTimes(2);

    cleanup();
  });

  // ==========================================================================
  // 4. CARD, BADGE & STATUS PRIMITIVES
  // ==========================================================================
  it('I. verifies card and surface primitive rendering', () => {
    const cardHtml = renderCard({
      title: 'Business Information',
      bodyHtml: '<p>Details here</p>',
      footerHtml: renderButton({ label: 'Edit', variant: 'secondary', size: 'sm' }),
      elevated: true
    });

    expect(cardHtml).toContain('class="wo-card wo-card--elevated"');
    expect(cardHtml).toContain('<h3 class="wo-card-title">Business Information</h3>');
    expect(cardHtml).toContain('<div class="wo-card-body"><p>Details here</p></div>');
    expect(cardHtml).toContain('<div class="wo-card-footer">');
  });

  it('J. verifies badge semantic variants, icon trust boundary, and renderStatusBadge domain mapping', () => {
    expect(renderBadge({ label: 'Active', variant: 'success' })).toContain('wo-badge wo-badge--success');
    expect(renderBadge({ label: 'Pending', variant: 'warning' })).toContain('wo-badge wo-badge--warning');

    // Plain text icon is escaped
    const escapedIconBadge = renderBadge({ label: 'Live', variant: 'info', icon: '★' });
    expect(escapedIconBadge).toContain('<span class="wo-badge-icon" aria-hidden="true">★</span>');

    // Domain status mapping
    expect(renderStatusBadge('completed')).toContain('wo-badge--success');
    expect(renderStatusBadge('paid')).toContain('wo-badge--success');
    expect(renderStatusBadge('approved')).toContain('wo-badge--success');
    expect(renderStatusBadge('published')).toContain('wo-badge--success');
    expect(renderStatusBadge('live')).toContain('wo-badge--success');
    expect(renderStatusBadge('quote-sent')).toContain('wo-badge--info');
    expect(renderStatusBadge('draft')).toContain('wo-badge--info');
    expect(renderStatusBadge('lead')).toContain('wo-badge--warning');
    expect(renderStatusBadge('unpaid')).toContain('wo-badge--warning');
    expect(renderStatusBadge('overdue')).toContain('wo-badge--danger');
    expect(renderStatusBadge('rejected')).toContain('wo-badge--danger');
    expect(renderStatusBadge('unknown-custom')).toContain('wo-badge--neutral');
  });

  // ==========================================================================
  // 5. TABS & TABPANEL PRIMITIVES & CONTROLLER
  // ==========================================================================
  it('K. verifies renderTabPanel active and inactive markup', () => {
    const activePanel = renderTabPanel({
      id: 'panel-general',
      tabId: 'tab-general',
      bodyHtml: '<p>General Settings</p>',
      active: true
    });
    expect(activePanel).toContain('role="tabpanel" id="panel-general" aria-labelledby="tab-general" class="wo-tab-panel"');
    expect(activePanel).not.toContain('hidden');
    expect(activePanel).toContain('<p>General Settings</p>');

    const inactivePanel = renderTabPanel({
      id: 'panel-security',
      tabId: 'tab-security',
      bodyHtml: '<p>Security Settings</p>',
      active: false
    });
    expect(inactivePanel).toContain('role="tabpanel" id="panel-security" aria-labelledby="tab-security" class="wo-tab-panel" hidden');
  });

  it('L. verifies renderTabs deterministic initial selection & disabled normalization', () => {
    // 1. If explicit active is provided on enabled tab -> first enabled active selected
    const t1 = renderTabs({
      tabs: [
        { id: 'tab-a', label: 'Tab A', panelId: 'p-a', active: true },
        { id: 'tab-b', label: 'Tab B', panelId: 'p-b', active: true }
      ]
    });
    expect(t1).toContain('id="tab-a" class="wo-tab" aria-selected="true" tabindex="0"');
    expect(t1).toContain('id="tab-b" class="wo-tab" aria-selected="false" tabindex="-1"');

    // 2. If no active provided -> first enabled selected
    const t2 = renderTabs({
      tabs: [
        { id: 'tab-a', label: 'Tab A', panelId: 'p-a' },
        { id: 'tab-b', label: 'Tab B', panelId: 'p-b' }
      ]
    });
    expect(t2).toContain('id="tab-a" class="wo-tab" aria-selected="true" tabindex="0"');
    expect(t2).toContain('id="tab-b" class="wo-tab" aria-selected="false" tabindex="-1"');

    // 3. If active provided on disabled tab -> disabled tab ignored, first enabled tab selected
    const t3 = renderTabs({
      tabs: [
        { id: 'tab-a', label: 'Tab A', panelId: 'p-a', disabled: true, active: true },
        { id: 'tab-b', label: 'Tab B', panelId: 'p-b' }
      ]
    });
    expect(t3).toContain('id="tab-a" class="wo-tab" aria-selected="false" tabindex="-1" aria-controls="p-a" disabled aria-disabled="true"');
    expect(t3).toContain('id="tab-b" class="wo-tab" aria-selected="true" tabindex="0"');

    // 4. If all tabs disabled -> none selected, all tabindex -1
    const t4 = renderTabs({
      tabs: [
        { id: 'tab-a', label: 'Tab A', panelId: 'p-a', disabled: true },
        { id: 'tab-b', label: 'Tab B', panelId: 'p-b', disabled: true }
      ]
    });
    expect(t4).toContain('id="tab-a" class="wo-tab" aria-selected="false" tabindex="-1" aria-controls="p-a" disabled aria-disabled="true"');
    expect(t4).toContain('id="tab-b" class="wo-tab" aria-selected="false" tabindex="-1" aria-controls="p-b" disabled aria-disabled="true"');
  });

  it('M. verifies initTabs initial DOM normalization, keyboard navigation, and click activation', () => {
    const tablist = new MockElement('div') as any;
    tablist.setAttribute('role', 'tablist');

    const tab1 = new MockElement('button') as any;
    tab1.setAttribute('id', 'tab-1');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-controls', 'panel-1');

    const tab2 = new MockElement('button') as any;
    tab2.setAttribute('id', 'tab-2');
    tab2.setAttribute('role', 'tab');
    tab2.setAttribute('aria-controls', 'panel-2');

    const tab3 = new MockElement('button') as any;
    tab3.setAttribute('id', 'tab-3');
    tab3.setAttribute('role', 'tab');
    tab3.setAttribute('aria-controls', 'panel-3');
    tab3.disabled = true;

    tablist.appendChild(tab1);
    tablist.appendChild(tab2);
    tablist.appendChild(tab3);

    const panel1 = new MockElement('div') as any;
    panel1.id = 'panel-1';

    const panel2 = new MockElement('div') as any;
    panel2.id = 'panel-2';

    const elementRegistry = new Map<string, any>([
      ['panel-1', panel1],
      ['panel-2', panel2]
    ]);

    (globalThis as any).document = {
      activeElement: tab1,
      getElementById: (id: string) => elementRegistry.get(id) || null
    };

    const changeSpy = vi.fn();
    const controller = initTabs(tablist, { onTabChange: changeSpy });

    // Initial DOM normalization: tab1 selected, panel1 visible, panel2 hidden
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    expect(tab1.getAttribute('tabindex')).toBe('0');
    expect(tab2.getAttribute('aria-selected')).toBe('false');
    expect(tab2.getAttribute('tabindex')).toBe('-1');
    expect(panel1.hidden).toBe(false);
    expect(panel2.hidden).toBe(true);
    expect(changeSpy).not.toHaveBeenCalled(); // No change event on initial sync

    // ArrowRight -> activates tab2, shows panel2, hides panel1
    tab1.focus();
    tablist.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');
    expect(panel1.hidden).toBe(true);
    expect(panel2.hidden).toBe(false);
    expect(changeSpy).toHaveBeenCalledWith('tab-2');

    // ArrowRight from tab2 -> skips disabled tab3, wraps to tab1
    tab2.focus();
    tablist.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    expect(panel1.hidden).toBe(false);
    expect(panel2.hidden).toBe(true);

    // End key -> moves to last enabled tab (tab2)
    tab1.focus();
    tablist.dispatchEvent({ type: 'keydown', key: 'End' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');

    // Home key -> moves to first enabled tab (tab1)
    tab2.focus();
    tablist.dispatchEvent({ type: 'keydown', key: 'Home' });
    expect(tab1.getAttribute('aria-selected')).toBe('true');

    // Click activation
    tab2.dispatchEvent({ type: 'click' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');
    expect(panel2.hidden).toBe(false);

    // Click on disabled tab is ignored
    tab3.dispatchEvent({ type: 'click' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');

    controller.destroy();
  });

  // ==========================================================================
  // 6. TABLE PRIMITIVE & XSS SECURITY
  // ==========================================================================
  it('N. verifies table primitive escapes data safe-by-default against XSS', () => {
    const cols = [
      { key: 'name', label: 'Customer Name' },
      { key: 'comment', label: 'Comment' }
    ];

    const rows = [
      {
        name: 'Alice <script>alert(1)</script>',
        comment: '<img src=x onerror="window.__xss = true">'
      }
    ];

    const tableHtml = renderTable({ columns: cols, rows });

    // Plain data must be escaped, NEVER rendered as executable markup
    expect(tableHtml).not.toContain('<script>alert(1)</script>');
    expect(tableHtml).not.toContain('<img src=x onerror="window.__xss = true">');
    expect(tableHtml).toContain('Alice &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(tableHtml).toContain('&lt;img src=x onerror=&quot;window.__xss = true&quot;&gt;');

    // Empty table uses tokenized empty cell
    const emptyHtml = renderTable({ columns: cols, rows: [], emptyMessage: '<b>No data</b>' });
    expect(emptyHtml).toContain('class="wo-table-empty-cell"');
    expect(emptyHtml).toContain('&lt;b&gt;No data&lt;/b&gt;');
  });

  // ==========================================================================
  // 7. DIALOG PRIMITIVE & LIFECYCLE / INERT / FOCUS / RESTORE
  // ==========================================================================
  it('O. verifies dialog intrinsic close, background inert, focus trap, and restoration', () => {
    const rootBody = new MockElement('body') as any;

    // Sibling application content
    const appSibling = new MockElement('div') as any;
    appSibling.setAttribute('id', 'app-root');
    const backgroundBtn = new MockElement('button') as any;
    appSibling.appendChild(backgroundBtn);

    // Dialog container subtree
    const dialogContainer = new MockElement('div') as any;
    const triggerBtn = new MockElement('button') as any;
    triggerBtn.setAttribute('id', 'open-modal-trigger');
    triggerBtn.focus();

    const backdrop = new MockElement('div') as any;
    backdrop.setAttribute('id', 'test-dialog-backdrop');
    backdrop.setAttribute('role', 'dialog');

    const closeBtn = new MockElement('button') as any;
    closeBtn.setAttribute('id', 'modal-close-btn');
    closeBtn.setAttribute('data-dialog-close', 'true');

    const submitBtn = new MockElement('button') as any;
    submitBtn.setAttribute('id', 'modal-submit-btn');

    backdrop.appendChild(closeBtn);
    backdrop.appendChild(submitBtn);

    dialogContainer.appendChild(triggerBtn);
    dialogContainer.appendChild(backdrop);

    rootBody.appendChild(appSibling);
    rootBody.appendChild(dialogContainer);

    (globalThis as any).document = {
      body: rootBody,
      activeElement: triggerBtn
    };

    const closeSpy = vi.fn();
    const controller = initDialog(backdrop, { onClose: closeSpy });

    // 1. Initial state: backdrop is visible (not hidden)
    expect(backdrop.hidden).toBe(false);

    // 2. Background sibling subtree is inert and aria-hidden
    expect(appSibling.inert).toBe(true);
    expect(appSibling.getAttribute('aria-hidden')).toBe('true');

    // 3. Initial focus moved to first focusable element inside dialog
    expect((globalThis as any).document.activeElement).toBe(closeBtn);

    // 4. Focus trapping Tab and Shift+Tab
    submitBtn.focus();
    backdrop.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: false });
    expect((globalThis as any).document.activeElement).toBe(closeBtn);

    closeBtn.focus();
    backdrop.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: true });
    expect((globalThis as any).document.activeElement).toBe(submitBtn);

    // 5. Escape closes intrinsically and sets backdrop.hidden = true
    backdrop.dispatchEvent({ type: 'keydown', key: 'Escape' });
    expect(backdrop.hidden).toBe(true);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // 6. Background sibling inert state restored
    expect(appSibling.inert).toBe(false);
    expect(appSibling.getAttribute('aria-hidden')).toBe(null);

    // 7. Focus restored to opening trigger element
    expect((globalThis as any).document.activeElement).toBe(triggerBtn);

    // 8. Idempotent close does not repeat or throw
    controller.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('P. verifies dialog intrinsically closes with [data-dialog-close] when no onClose callback supplied', () => {
    const rootBody = new MockElement('body') as any;
    const dialogContainer = new MockElement('div') as any;

    const trigger = new MockElement('button') as any;
    trigger.focus();

    const backdrop = new MockElement('div') as any;
    const closeBtn = new MockElement('button') as any;
    closeBtn.setAttribute('data-dialog-close', 'true');
    backdrop.appendChild(closeBtn);

    dialogContainer.appendChild(trigger);
    dialogContainer.appendChild(backdrop);
    rootBody.appendChild(dialogContainer);

    (globalThis as any).document = {
      body: rootBody,
      activeElement: trigger
    };

    // No onClose callback supplied
    const controller = initDialog(backdrop);
    expect(backdrop.hidden).toBe(false);

    // Click close control
    closeBtn.dispatchEvent({ type: 'click' });

    // Must intrinsically hide the backdrop and restore focus
    expect(backdrop.hidden).toBe(true);
    expect((globalThis as any).document.activeElement).toBe(trigger);

    controller.destroy();
  });

  it('Q. verifies dialog preserves pre-existing inert and aria-hidden states upon close', () => {
    const rootBody = new MockElement('body') as any;

    // Pre-existing inert/hidden sibling
    const preExistingHiddenSibling = new MockElement('aside') as any;
    preExistingHiddenSibling.inert = true;
    preExistingHiddenSibling.setAttribute('aria-hidden', 'true');

    const dialogContainer = new MockElement('div') as any;
    const backdrop = new MockElement('div') as any;
    const closeBtn = new MockElement('button') as any;
    closeBtn.setAttribute('data-dialog-close', 'true');
    backdrop.appendChild(closeBtn);
    dialogContainer.appendChild(backdrop);

    rootBody.appendChild(preExistingHiddenSibling);
    rootBody.appendChild(dialogContainer);

    (globalThis as any).document = {
      body: rootBody,
      activeElement: null
    };

    const controller = initDialog(backdrop);
    controller.close();

    // Pre-existing inert and aria-hidden must NOT be stripped
    expect(preExistingHiddenSibling.inert).toBe(true);
    expect(preExistingHiddenSibling.getAttribute('aria-hidden')).toBe('true');
  });

  // ==========================================================================
  // 8. SECURITY REGRESSION: HTML SPECIAL CHARACTERS ESCAPING
  // ==========================================================================
  it('R. verifies strict HTML escaping across all text-accepting primitives', () => {
    const dangerousString = '"><script>alert(1)</script>&test\'';

    // Button label
    const btn = renderButton({ label: dangerousString });
    expect(btn).not.toContain('<script>');
    expect(btn).toContain('&quot;&gt;&lt;script&gt;');

    // Badge label
    const badge = renderBadge({ label: dangerousString });
    expect(badge).not.toContain('<script>');
    expect(badge).toContain('&quot;&gt;&lt;script&gt;');

    // Field helper & error
    const field = renderField({
      id: 'test-field',
      label: dangerousString,
      helperText: dangerousString,
      errorMessage: dangerousString,
      controlHtml: '<input id="test-field" />'
    });
    expect(field).not.toContain('<script>');
    expect(field).toContain('&quot;&gt;&lt;script&gt;');

    // Select options
    const select = renderSelect({
      id: 'test-select',
      options: [{ value: dangerousString, label: dangerousString }]
    });
    expect(select).not.toContain('<script>');
    expect(select).toContain('&quot;&gt;&lt;script&gt;');

    // Textarea value
    const textarea = renderTextarea({
      id: 'test-ta',
      value: dangerousString
    });
    expect(textarea).not.toContain('<script>');
    expect(textarea).toContain('&quot;&gt;&lt;script&gt;');

    // Alert message
    const alert = renderAlert({ message: dangerousString });
    expect(alert).not.toContain('<script>');
    expect(alert).toContain('&quot;&gt;&lt;script&gt;');

    // Empty & Error states
    const empty = renderEmptyState({ title: dangerousString, description: dangerousString });
    expect(empty).not.toContain('<script>');
    expect(empty).toContain('&quot;&gt;&lt;script&gt;');

    const err = renderErrorState({ message: dangerousString });
    expect(err).not.toContain('<script>');
    expect(err).toContain('&quot;&gt;&lt;script&gt;');
  });
});
