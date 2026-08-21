/**
 * WashOps Design System — Framework-Neutral UI Primitives (Phase 1C / Task 7A.2)
 *
 * Provides typed HTML string builders and accessible DOM wiring utilities
 * for all canonical WashOps UI primitives.
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
  icon?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
  attributes?: Record<string, string>;
}

export function renderButton(opts: ButtonOptions): string {
  const variant = opts.variant ?? 'secondary';
  const size = opts.size ?? 'md';
  const type = opts.type ?? 'button';

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
  if (opts.disabled) attrs.push('disabled');
  if (opts.loading) attrs.push('aria-busy="true"');
  if (opts.ariaLabel) attrs.push(`aria-label="${escapeHtmlText(opts.ariaLabel)}"`);

  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attrs.push(`${k}="${escapeHtmlText(v)}"`);
    }
  }

  const iconHtml = opts.icon ? `<span class="wo-button-icon" aria-hidden="true">${opts.icon}</span>` : '';
  const labelHtml = opts.iconOnly
    ? (opts.ariaLabel ? `<span class="wo-sr-only">${escapeHtmlText(opts.ariaLabel)}</span>` : '')
    : `<span>${escapeHtmlText(opts.label)}</span>`;
  const spinnerHtml = opts.loading ? '<span class="wo-spinner" aria-hidden="true"></span>' : '';

  return `<button ${attrs.join(' ')}>${spinnerHtml}${iconHtml}${labelHtml}</button>`;
}

// ============================================================================
// 2. FORM CONTROL PRIMITIVES
// ============================================================================

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
  const helperId = opts.helperText ? `${opts.id}-helper` : '';
  const errorId = opts.errorMessage ? `${opts.id}-error` : '';

  const requiredMarker = opts.required ? '<span class="wo-required-marker" aria-hidden="true">*</span>' : '';
  const labelHtml = `<label for="${opts.id}" class="wo-label">${escapeHtmlText(opts.label)}${requiredMarker}</label>`;
  const helperHtml = opts.helperText ? `<div id="${helperId}" class="wo-field-helper">${escapeHtmlText(opts.helperText)}</div>` : '';
  const errorHtml = opts.errorMessage ? `<div id="${errorId}" class="wo-field-error" role="alert">${escapeHtmlText(opts.errorMessage)}</div>` : '';

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
  icon?: string;
  className?: string;
}

export function renderBadge(opts: BadgeOptions): string {
  const variant = opts.variant ?? 'neutral';
  const classes = ['wo-badge', `wo-badge--${variant}`, opts.className ?? ''].filter(Boolean).join(' ');
  const iconHtml = opts.icon ? `<span class="wo-badge-icon" aria-hidden="true">${opts.icon}</span>` : '';

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
// 5. TABS PRIMITIVE
// ============================================================================

export interface TabItem {
  id: string;
  label: string;
  panelId: string;
  active?: boolean;
}

export interface TabsOptions {
  tabs: TabItem[];
  ariaLabel?: string;
  className?: string;
}

export function renderTabs(opts: TabsOptions): string {
  const ariaLabel = opts.ariaLabel ? ` aria-label="${escapeHtmlText(opts.ariaLabel)}"` : '';
  const classes = ['wo-tabs', opts.className ?? ''].filter(Boolean).join(' ');

  const tabsHtml = opts.tabs.map(t => {
    const selected = t.active ? 'true' : 'false';
    return `
      <button type="button" role="tab" id="${t.id}" class="wo-tab" aria-selected="${selected}" aria-controls="${t.panelId}">
        ${escapeHtmlText(t.label)}
      </button>
    `.trim();
  }).join('');

  return `<div role="tablist"${ariaLabel} class="${classes}">${tabsHtml}</div>`;
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
              <td colspan="${opts.columns.length}" style="text-align: center; padding: 32px;">
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
      const content = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
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
  icon?: string;
  className?: string;
}

export function renderEmptyState(opts: EmptyStateOptions): string {
  const iconHtml = opts.icon ? `<div class="wo-empty-state-icon" aria-hidden="true">${opts.icon}</div>` : '';
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
