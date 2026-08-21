/**
 * WashOps Design System — Framework-Neutral UI Primitives (Phase 1C / Task 7A.2)
 *
 * Provides typed HTML string builders, safe-by-default output escaping,
 * and accessible DOM interaction controllers for all canonical WashOps UI primitives.
 */

import { escapeHtmlText } from '../crm_html_output';

// ============================================================================
// 1. BUTTON PRIMITIVE
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: string; // Plain text / emoji glyph (escaped)
  iconHtml?: string; // Developer-owned trusted SVG/markup
  iconOnly?: boolean;
  ariaLabel?: string;
  attributes?: Record<string, string>;
}

export function renderButton(opts: ButtonOptions): string {
  const variant = opts.variant ?? 'secondary';
  const size = opts.size ?? 'md';
  const type = opts.type ?? 'button';
  const accessibleName = opts.ariaLabel ?? opts.label;

  const classes = [
    'wo-button',
    `wo-button--${variant}`,
    `wo-button--${size}`,
    opts.iconOnly ? 'wo-button--icon' : '',
    opts.loading ? 'wo-button--loading' : '',
    opts.className ?? ''
  ].filter(Boolean).join(' ');

  const attrs: string[] = [
    `type="${type}"`,
    `class="${classes}"`
  ];

  if (opts.id) attrs.push(`id="${opts.id}"`);
  // Prevent double-activation or keyboard triggers while loading by applying native disabled
  if (opts.disabled || opts.loading) attrs.push('disabled');
  if (opts.loading) attrs.push('aria-busy="true"');
  if (accessibleName) attrs.push(`aria-label="${escapeHtmlText(accessibleName)}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  let iconContent = '';
  if (opts.iconHtml) {
    iconContent = opts.iconHtml;
  } else if (opts.icon) {
    iconContent = escapeHtmlText(opts.icon);
  }

  const iconHtml = iconContent ? `<span class="wo-button-icon" aria-hidden="true">${iconContent}</span>` : '';
  const labelHtml = opts.iconOnly
    ? `<span class="wo-sr-only">${escapeHtmlText(accessibleName)}</span>`
    : `<span>${escapeHtmlText(opts.label)}</span>`;
  const spinnerHtml = opts.loading ? '<span class="wo-spinner" aria-hidden="true"></span>' : '';

  return `<button ${attrs.join(' ')}>${spinnerHtml}${iconHtml}${labelHtml}</button>`;
}

// ============================================================================
// 2. FORM CONTROL PRIMITIVES
// ============================================================================

export interface FieldAccessibilityProps {
  helperId?: string;
  errorId?: string;
  describedBy?: string;
  invalid?: boolean;
}

export function getFieldAccessibilityProps(
  fieldId: string,
  opts: { hasHelper?: boolean; hasError?: boolean }
): FieldAccessibilityProps {
  const helperId = opts.hasHelper ? `${fieldId}-helper` : undefined;
  const errorId = opts.hasError ? `${fieldId}-error` : undefined;
  const describedByParts = [helperId, errorId].filter(Boolean);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  return {
    helperId,
    errorId,
    describedBy,
    invalid: Boolean(opts.hasError)
  };
}

export interface FieldOptions {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  errorMessage?: string;
  className?: string;
  controlHtml: string;
}

export function renderField(opts: FieldOptions): string {
  const a11y = getFieldAccessibilityProps(opts.id, {
    hasHelper: Boolean(opts.helperText),
    hasError: Boolean(opts.errorMessage)
  });

  const requiredMarker = opts.required ? '<span class="wo-required-marker" aria-hidden="true">*</span>' : '';
  const labelHtml = `<label for="${opts.id}" class="wo-label">${escapeHtmlText(opts.label)}${requiredMarker}</label>`;
  const helperHtml = opts.helperText ? `<div id="${a11y.helperId}" class="wo-field-helper">${escapeHtmlText(opts.helperText)}</div>` : '';
  const errorHtml = opts.errorMessage ? `<div id="${a11y.errorId}" class="wo-field-error" role="alert">${escapeHtmlText(opts.errorMessage)}</div>` : '';

  return `
    <div class="wo-field ${opts.className ?? ''}">
      ${labelHtml}
      ${opts.controlHtml}
      ${helperHtml}
      ${errorHtml}
    </div>
  `.trim();
}

export interface InputOptions {
  id: string;
  name?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'search' | 'url';
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  attributes?: Record<string, string>;
}

export function renderInput(opts: InputOptions): string {
  const type = opts.type ?? 'text';
  const classes = ['wo-input', opts.className ?? ''].filter(Boolean).join(' ');

  const attrs: string[] = [
    `type="${type}"`,
    `id="${opts.id}"`,
    `class="${classes}"`
  ];

  if (opts.name) attrs.push(`name="${opts.name}"`);
  if (opts.value !== undefined) attrs.push(`value="${escapeHtmlText(opts.value)}"`);
  if (opts.placeholder) attrs.push(`placeholder="${escapeHtmlText(opts.placeholder)}"`);
  if (opts.disabled) attrs.push('disabled');
  if (opts.readonly) attrs.push('readonly');
  if (opts.required) attrs.push('required');
  if (opts.invalid) attrs.push('aria-invalid="true"');
  if (opts.describedBy) attrs.push(`aria-describedby="${opts.describedBy}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  return `<input ${attrs.join(' ')} />`;
}

export interface SelectOption {
  value: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface SelectOptions {
  id: string;
  name?: string;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  attributes?: Record<string, string>;
}

export function renderSelect(opts: SelectOptions): string {
  const classes = ['wo-select', opts.className ?? ''].filter(Boolean).join(' ');
  const attrs: string[] = [
    `id="${opts.id}"`,
    `class="${classes}"`
  ];

  if (opts.name) attrs.push(`name="${opts.name}"`);
  if (opts.disabled) attrs.push('disabled');
  if (opts.required) attrs.push('required');
  if (opts.invalid) attrs.push('aria-invalid="true"');
  if (opts.describedBy) attrs.push(`aria-describedby="${opts.describedBy}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  const optionsHtml = opts.options.map(o => {
    const selected = o.selected ? ' selected' : '';
    const disabled = o.disabled ? ' disabled' : '';
    return `<option value="${escapeHtmlText(o.value)}"${selected}${disabled}>${escapeHtmlText(o.label)}</option>`;
  }).join('');

  return `<select ${attrs.join(' ')}>${optionsHtml}</select>`;
}

export interface TextareaOptions {
  id: string;
  name?: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function renderTextarea(opts: TextareaOptions): string {
  const classes = ['wo-textarea', opts.className ?? ''].filter(Boolean).join(' ');
  const attrs: string[] = [
    `id="${opts.id}"`,
    `class="${classes}"`
  ];

  if (opts.name) attrs.push(`name="${opts.name}"`);
  if (opts.rows) attrs.push(`rows="${opts.rows}"`);
  if (opts.placeholder) attrs.push(`placeholder="${escapeHtmlText(opts.placeholder)}"`);
  if (opts.disabled) attrs.push('disabled');
  if (opts.readonly) attrs.push('readonly');
  if (opts.required) attrs.push('required');
  if (opts.invalid) attrs.push('aria-invalid="true"');
  if (opts.describedBy) attrs.push(`aria-describedby="${opts.describedBy}"`);

  return `<textarea ${attrs.join(' ')}>${opts.value ? escapeHtmlText(opts.value) : ''}</textarea>`;
}

export interface CheckboxOptions {
  id: string;
  name?: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  attributes?: Record<string, string>;
}

export function renderCheckbox(opts: CheckboxOptions): string {
  const attrs: string[] = [
    'type="checkbox"',
    `id="${opts.id}"`,
    'class="wo-checkbox"'
  ];

  if (opts.name) attrs.push(`name="${opts.name}"`);
  if (opts.checked) attrs.push('checked');
  if (opts.disabled) attrs.push('disabled');
  if (opts.required) attrs.push('required');
  if (opts.invalid) attrs.push('aria-invalid="true"');
  if (opts.describedBy) attrs.push(`aria-describedby="${opts.describedBy}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  const labelClasses = ['wo-checkbox-label', opts.className ?? ''].filter(Boolean).join(' ');

  return `
    <label class="${labelClasses}" for="${opts.id}">
      <input ${attrs.join(' ')} />
      <span>${escapeHtmlText(opts.label)}</span>
    </label>
  `.trim();
}

export interface SwitchOptions {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
  attributes?: Record<string, string>;
}

export function renderSwitch(opts: SwitchOptions): string {
  const isChecked = Boolean(opts.checked);
  const attrs: string[] = [
    'type="button"',
    'role="switch"',
    `id="${opts.id}"`,
    `aria-checked="${isChecked ? 'true' : 'false'}"`,
    'class="wo-switch"'
  ];

  if (opts.disabled) {
    attrs.push('disabled');
    attrs.push('aria-disabled="true"');
  }
  if (opts.describedBy) attrs.push(`aria-describedby="${opts.describedBy}"`);
  attrs.push(`aria-label="${escapeHtmlText(opts.label)}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  const labelClasses = ['wo-switch-label', opts.className ?? ''].filter(Boolean).join(' ');

  return `
    <label class="${labelClasses}" for="${opts.id}">
      <button ${attrs.join(' ')}>
        <span class="wo-switch-thumb" aria-hidden="true"></span>
      </button>
      <span>${escapeHtmlText(opts.label)}</span>
    </label>
  `.trim();
}

export function initSwitch(buttonEl: HTMLButtonElement, onToggle?: (checked: boolean) => void): () => void {
  const toggle = () => {
    if (buttonEl.disabled || buttonEl.getAttribute('aria-disabled') === 'true') return;
    const current = buttonEl.getAttribute('aria-checked') === 'true';
    const next = !current;
    buttonEl.setAttribute('aria-checked', next ? 'true' : 'false');
    onToggle?.(next);
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    toggle();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };

  buttonEl.addEventListener('click', handleClick);
  buttonEl.addEventListener('keydown', handleKeyDown);

  return () => {
    buttonEl.removeEventListener('click', handleClick);
    buttonEl.removeEventListener('keydown', handleKeyDown);
  };
}

// ============================================================================
// 3. CARD / SURFACE PRIMITIVE
// ============================================================================

export interface CardOptions {
  title?: string;
  headerHtml?: string;
  bodyHtml: string;
  footerHtml?: string;
  elevated?: boolean;
  interactive?: boolean;
  className?: string;
  id?: string;
}

export function renderCard(opts: CardOptions): string {
  const classes = [
    'wo-card',
    opts.elevated ? 'wo-card--elevated' : '',
    opts.interactive ? 'wo-card--interactive' : '',
    opts.className ?? ''
  ].filter(Boolean).join(' ');

  let headerSection = '';
  if (opts.headerHtml) {
    headerSection = `<div class="wo-card-header">${opts.headerHtml}</div>`;
  } else if (opts.title) {
    headerSection = `
      <div class="wo-card-header">
        <h3 class="wo-card-title">${escapeHtmlText(opts.title)}</h3>
      </div>
    `;
  }

  const footerSection = opts.footerHtml ? `<div class="wo-card-footer">${opts.footerHtml}</div>` : '';
  const idAttr = opts.id ? ` id="${opts.id}"` : '';

  return `
    <div${idAttr} class="${classes}">
      ${headerSection}
      <div class="wo-card-body">${opts.bodyHtml}</div>
      ${footerSection}
    </div>
  `.trim();
}

// ============================================================================
// 4. BADGE / STATUS PRIMITIVE
// ============================================================================

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
  icon?: string; // plain text / emoji glyph (escaped)
  iconHtml?: string; // developer-owned trusted SVG/markup
  className?: string;
}

export function renderBadge(opts: BadgeOptions): string {
  const variant = opts.variant ?? 'neutral';
  const classes = ['wo-badge', `wo-badge--${variant}`, opts.className ?? ''].filter(Boolean).join(' ');

  let iconContent = '';
  if (opts.iconHtml) {
    iconContent = opts.iconHtml;
  } else if (opts.icon) {
    iconContent = escapeHtmlText(opts.icon);
  }

  const iconHtml = iconContent ? `<span class="wo-badge-icon" aria-hidden="true">${iconContent}</span>` : '';

  return `<span class="${classes}">${iconHtml}${escapeHtmlText(opts.label)}</span>`;
}

export function renderStatusBadge(status: string): string {
  const normalized = status.toLowerCase().trim();
  let variant: BadgeVariant = 'neutral';

  switch (normalized) {
    case 'completed':
    case 'paid':
    case 'approved':
    case 'published':
    case 'live':
      variant = 'success';
      break;
    case 'job-scheduled':
    case 'sent':
    case 'quote-sent':
    case 'info':
    case 'draft':
      variant = 'info';
      break;
    case 'unpaid':
    case 'lead':
    case 'pending':
    case 'warning':
      variant = 'warning';
      break;
    case 'rejected':
    case 'overdue':
    case 'error':
    case 'danger':
      variant = 'danger';
      break;
    default:
      variant = 'neutral';
  }

  return renderBadge({ label: status, variant });
}

// ============================================================================
// 5. TABS & TABPANEL PRIMITIVES
// ============================================================================

export interface TabItem {
  id: string;
  label: string;
  panelId: string;
  active?: boolean;
  disabled?: boolean;
}

export interface TabsOptions {
  tabs: TabItem[];
  ariaLabel?: string;
  className?: string;
}

export function renderTabs(opts: TabsOptions): string {
  const ariaLabel = opts.ariaLabel ? ` aria-label="${escapeHtmlText(opts.ariaLabel)}"` : '';
  const classes = ['wo-tabs', opts.className ?? ''].filter(Boolean).join(' ');

  // Identify active enabled tab deterministically
  const enabledTabs = opts.tabs.filter(t => !t.disabled);
  const explicitActiveEnabled = enabledTabs.find(t => t.active);
  const selectedTab = explicitActiveEnabled ?? enabledTabs[0];

  const tabsHtml = opts.tabs.map(t => {
    const isDisabled = Boolean(t.disabled);
    const isSelected = !isDisabled && t === selectedTab;
    const tabIndex = isSelected ? '0' : '-1';
    const disabledAttr = isDisabled ? ' disabled aria-disabled="true"' : '';

    return `
      <button type="button" role="tab" id="${t.id}" class="wo-tab" aria-selected="${isSelected ? 'true' : 'false'}" tabindex="${tabIndex}" aria-controls="${t.panelId}"${disabledAttr}>
        ${escapeHtmlText(t.label)}
      </button>
    `.trim();
  }).join('');

  return `<div role="tablist"${ariaLabel} class="${classes}">${tabsHtml}</div>`;
}

export interface TabPanelOptions {
  id: string;
  tabId: string;
  bodyHtml: string;
  active?: boolean;
  className?: string;
}

export function renderTabPanel(opts: TabPanelOptions): string {
  const classes = ['wo-tab-panel', opts.className ?? ''].filter(Boolean).join(' ');
  const hiddenAttr = opts.active ? '' : ' hidden';

  return `<div role="tabpanel" id="${opts.id}" aria-labelledby="${opts.tabId}" class="${classes}"${hiddenAttr}>${opts.bodyHtml}</div>`;
}

export interface TabsController {
  destroy: () => void;
  selectTab: (tabId: string) => void;
}

export function initTabs(
  tablistEl: HTMLElement,
  opts: { onTabChange?: (tabId: string) => void } = {}
): TabsController {
  const getTabs = () => Array.from(tablistEl.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  const activateTab = (targetTab: HTMLButtonElement, emitChange: boolean = true) => {
    if (targetTab.disabled || targetTab.getAttribute('aria-disabled') === 'true') return;
    const tabs = getTabs();

    for (const tab of tabs) {
      const isTarget = tab === targetTab;
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      tab.setAttribute('tabindex', isTarget ? '0' : '-1');

      const panelId = tab.getAttribute('aria-controls');
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
          panel.hidden = !isTarget;
        }
      }
    }

    if (emitChange) {
      targetTab.focus();
      opts.onTabChange?.(targetTab.id);
    }
  };

  // Immediate DOM normalization at initialization
  const allTabs = getTabs();
  const enabledTabs = allTabs.filter(t => !t.disabled && t.getAttribute('aria-disabled') !== 'true');
  const explicitlySelected = enabledTabs.find(t => t.getAttribute('aria-selected') === 'true');
  const initialSelected = explicitlySelected ?? enabledTabs[0];

  if (initialSelected) {
    activateTab(initialSelected, false);
  } else {
    // All tabs disabled: normalize all to aria-selected=false, tabindex=-1
    for (const tab of allTabs) {
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
      const panelId = tab.getAttribute('aria-controls');
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel) panel.hidden = true;
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const tabs = getTabs();
    const enabled = tabs.filter(t => !t.disabled && t.getAttribute('aria-disabled') !== 'true');
    if (enabled.length === 0) return;

    const currentTab = document.activeElement as HTMLButtonElement;
    const currentIndex = enabled.indexOf(currentTab);

    if (currentIndex === -1) return;

    let nextTab: HTMLButtonElement | undefined;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextTab = enabled[(currentIndex + 1) % enabled.length];
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextTab = enabled[(currentIndex - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        e.preventDefault();
        nextTab = enabled[0];
        break;
      case 'End':
        e.preventDefault();
        nextTab = enabled[enabled.length - 1];
        break;
    }

    if (nextTab) {
      activateTab(nextTab, true);
    }
  };

  const handleClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    if (target && tablistEl.contains(target)) {
      e.preventDefault();
      activateTab(target, true);
    }
  };

  tablistEl.addEventListener('keydown', handleKeyDown);
  tablistEl.addEventListener('click', handleClick);

  const destroy = () => {
    tablistEl.removeEventListener('keydown', handleKeyDown);
    tablistEl.removeEventListener('click', handleClick);
  };

  const selectTab = (tabId: string) => {
    const target = allTabs.find(t => t.id === tabId);
    if (target) activateTab(target, true);
  };

  return { destroy, selectTab };
}

// ============================================================================
// 6. TABLE PRIMITIVE
// ============================================================================

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface TableOptions {
  columns: TableColumn[];
  rows: TableRow[];
  emptyMessage?: string;
  className?: string;
}

export function renderTable(opts: TableOptions): string {
  const tableClasses = ['wo-table', opts.className ?? ''].filter(Boolean).join(' ');
  const headerHtml = opts.columns.map(col => {
    const alignStyle = col.align ? ` style="text-align: ${col.align};"` : '';
    const classAttr = col.className ? ` class="${col.className}"` : '';
    return `<th${alignStyle}${classAttr}>${escapeHtmlText(col.label)}</th>`;
  }).join('');

  if (opts.rows.length === 0) {
    const emptyMsg = opts.emptyMessage ?? 'No records available.';
    return `
      <div class="wo-table-container">
        <table class="${tableClasses}">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>
            <tr>
              <td colspan="${opts.columns.length}" class="wo-table-empty-cell">
                <div class="wo-empty-state-description">${escapeHtmlText(emptyMsg)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `.trim();
  }

  const rowsHtml = opts.rows.map(row => {
    const cellsHtml = opts.columns.map(col => {
      const alignStyle = col.align ? ` style="text-align: ${col.align};"` : '';
      const cellVal = row[col.key];
      // Safe-by-default: ordinary data values are strictly HTML-escaped before interpolation
      const content = cellVal !== undefined && cellVal !== null ? escapeHtmlText(String(cellVal)) : '';
      return `<td${alignStyle}>${content}</td>`;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  }).join('');

  return `
    <div class="wo-table-container">
      <table class="${tableClasses}">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `.trim();
}

// ============================================================================
// 7. DIALOG / MODAL PRIMITIVE
// ============================================================================

export interface DialogOptions {
  id: string;
  title: string;
  bodyHtml: string;
  footerHtml?: string;
  className?: string;
}

export function renderDialog(opts: DialogOptions): string {
  const titleId = `${opts.id}-title`;
  const footerSection = opts.footerHtml ? `<footer class="wo-dialog-footer">${opts.footerHtml}</footer>` : '';

  return `
    <div id="${opts.id}" class="wo-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="wo-dialog ${opts.className ?? ''}">
        <header class="wo-dialog-header">
          <h2 id="${titleId}" class="wo-dialog-title">${escapeHtmlText(opts.title)}</h2>
          <button type="button" class="wo-button wo-button--ghost wo-button--sm wo-button--icon" data-dialog-close aria-label="Close dialog">✕</button>
        </header>
        <div class="wo-dialog-body">${opts.bodyHtml}</div>
        ${footerSection}
      </div>
    </div>
  `.trim();
}

interface InertEntry {
  element: HTMLElement;
  prevInert: boolean;
  prevAriaHidden: string | null;
}

function applyInertToBackground(dialogEl: HTMLElement): () => void {
  const entries: InertEntry[] = [];
  let current: HTMLElement | null = dialogEl;

  // Walk ancestor levels from the dialog up to document.body
  while (current && current !== document.body && current.parentElement) {
    const parent: HTMLElement = current.parentElement;
    const siblings = Array.from(parent.children) as HTMLElement[];

    for (const sibling of siblings) {
      if (sibling !== current && sibling.nodeType === 1 && !sibling.contains(dialogEl)) {
        entries.push({
          element: sibling,
          prevInert: (sibling as any).inert === true,
          prevAriaHidden: sibling.getAttribute('aria-hidden')
        });

        (sibling as any).inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      }
    }
    current = parent;
  }

  return () => {
    for (const entry of entries) {
      (entry.element as any).inert = entry.prevInert;

      if (entry.prevAriaHidden !== null) {
        entry.element.setAttribute('aria-hidden', entry.prevAriaHidden);
      } else {
        entry.element.removeAttribute('aria-hidden');
      }
    }
  };
}

export interface DialogController {
  close: () => void;
  destroy: () => void;
}

export function initDialog(
  backdropEl: HTMLElement,
  opts: { onClose?: () => void; nonDismissible?: boolean } = {}
): DialogController {
  let isClosed = false;
  const previouslyFocused = document.activeElement as HTMLElement | null;

  // Ensure backdrop is visible upon initialization
  backdropEl.hidden = false;

  // Apply inert boundary to background element subtrees
  const restoreInert = applyInertToBackground(backdropEl);

  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const getFocusableElements = (): HTMLElement[] => {
    return Array.from(backdropEl.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      el => el.offsetParent !== null || el === document.activeElement || el.tagName.toLowerCase() === 'button'
    );
  };

  // Move initial focus inside dialog
  const focusables = getFocusableElements();
  if (focusables.length > 0) {
    focusables[0].focus();
  } else {
    backdropEl.setAttribute('tabindex', '-1');
    backdropEl.focus();
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isClosed) return;

    if (e.key === 'Escape' && !opts.nonDismissible) {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === 'Tab') {
      const items = getFocusableElements();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !backdropEl.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !backdropEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (isClosed) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-dialog-close]')) {
      e.preventDefault();
      close();
    }
  };

  backdropEl.addEventListener('keydown', handleKeyDown);
  backdropEl.addEventListener('click', handleClick);

  const removeListeners = () => {
    backdropEl.removeEventListener('keydown', handleKeyDown);
    backdropEl.removeEventListener('click', handleClick);
  };

  const close = () => {
    if (isClosed) return;
    isClosed = true;

    // 1. Intrinsically hide the dialog backdrop
    backdropEl.hidden = true;

    // 2. Remove listeners
    removeListeners();

    // 3. Restore inert states on background siblings
    restoreInert();

    // 4. Invoke lifecycle callback
    opts.onClose?.();

    // 5. Restore focus to opener trigger
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };

  const destroy = () => {
    if (isClosed) return;
    isClosed = true;

    removeListeners();
    restoreInert();
  };

  return { close, destroy };
}

// ============================================================================
// 8. ALERT PRIMITIVE
// ============================================================================

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertOptions {
  variant?: AlertVariant;
  title?: string;
  message: string;
  className?: string;
}

export function renderAlert(opts: AlertOptions): string {
  const variant = opts.variant ?? 'info';
  const titleHtml = opts.title ? `<div class="wo-alert-title">${escapeHtmlText(opts.title)}</div>` : '';

  return `
    <div class="wo-alert wo-alert--${variant} ${opts.className ?? ''}" role="status">
      <div class="wo-alert-content">
        ${titleHtml}
        <div class="wo-alert-message">${escapeHtmlText(opts.message)}</div>
      </div>
    </div>
  `.trim();
}

// ============================================================================
// 9. LOADING PRIMITIVE
// ============================================================================

export interface SpinnerOptions {
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  className?: string;
}

export function renderSpinner(opts: SpinnerOptions = {}): string {
  const size = opts.size ?? 'md';
  const sizeClass = size !== 'md' ? ` wo-spinner--${size}` : '';
  const label = opts.ariaLabel ?? 'Loading...';

  return `<span class="wo-spinner${sizeClass} ${opts.className ?? ''}" role="status" aria-busy="true"><span class="wo-sr-only">${escapeHtmlText(label)}</span></span>`;
}

// ============================================================================
// 10. EMPTY & ERROR STATE PRIMITIVES
// ============================================================================

export interface EmptyStateOptions {
  title: string;
  description?: string;
  actionHtml?: string;
  icon?: string; // plain text glyph (escaped)
  iconHtml?: string; // developer-owned trusted SVG/markup
  className?: string;
}

export function renderEmptyState(opts: EmptyStateOptions): string {
  let iconContent = '';
  if (opts.iconHtml) {
    iconContent = opts.iconHtml;
  } else if (opts.icon) {
    iconContent = escapeHtmlText(opts.icon);
  }

  const iconHtml = iconContent ? `<div class="wo-empty-state-icon" aria-hidden="true">${iconContent}</div>` : '';
  const descHtml = opts.description ? `<p class="wo-empty-state-description">${escapeHtmlText(opts.description)}</p>` : '';
  const actionHtml = opts.actionHtml ? `<div class="wo-empty-state-action">${opts.actionHtml}</div>` : '';

  return `
    <div class="wo-empty-state ${opts.className ?? ''}">
      ${iconHtml}
      <h3 class="wo-empty-state-title">${escapeHtmlText(opts.title)}</h3>
      ${descHtml}
      ${actionHtml}
    </div>
  `.trim();
}

export interface ErrorStateOptions {
  title?: string;
  message: string;
  retryActionHtml?: string;
  className?: string;
}

export function renderErrorState(opts: ErrorStateOptions): string {
  const title = opts.title ?? 'An error occurred';
  const retryHtml = opts.retryActionHtml ? `<div class="wo-error-state-action">${opts.retryActionHtml}</div>` : '';

  return `
    <div class="wo-error-state ${opts.className ?? ''}" role="alert">
      <h3 class="wo-error-state-title">${escapeHtmlText(title)}</h3>
      <p class="wo-error-state-description">${escapeHtmlText(opts.message)}</p>
      ${retryHtml}
    </div>
  `.trim();
}
