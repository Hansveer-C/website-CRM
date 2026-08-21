import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  renderButton,
  renderField,
  renderInput,
  renderSelect,
  renderTextarea,
  renderCard,
  renderBadge,
  renderStatusBadge,
  renderTabs,
  renderTable,
  renderDialog,
  renderAlert,
  renderSpinner,
  renderEmptyState,
  renderErrorState
} from './primitives';

describe('WashOps Canonical UI Primitives (Phase 1C / Task 7A.2)', () => {
  const cssPath = path.resolve(__dirname, 'primitives.css');
  const stylePath = path.resolve(__dirname, '../style.css');

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
      '.wo-switch',
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
      '.wo-table-container',
      '.wo-table',
      '.wo-dialog-backdrop',
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

    // Confirm tokens are heavily utilized
    expect(css).toContain('var(--wo-color-interactive)');
    expect(css).toContain('var(--wo-color-surface)');
    expect(css).toContain('var(--wo-color-border)');
    expect(css).toContain('var(--wo-space-2)');
    expect(css).toContain('var(--wo-space-4)');
    expect(css).toContain('var(--wo-radius-md)');
    expect(css).toContain('var(--wo-radius-lg)');
    expect(css).toContain('var(--wo-shadow-xs)');
    expect(css).toContain('var(--wo-shadow-xl)');
    expect(css).toContain('var(--wo-z-modal)');
    expect(css).toContain('var(--wo-focus-ring-outline)');
  });

  it('D. verifies renderButton variant, size, loading, and disabled contracts', () => {
    // Primary Button
    const primaryHtml = renderButton({ label: 'Save', variant: 'primary', size: 'md' });
    expect(primaryHtml).toContain('class="wo-button wo-button--primary wo-button--md"');
    expect(primaryHtml).toContain('<span>Save</span>');

    // Loading Button with accessible attributes
    const loadingHtml = renderButton({ label: 'Processing', variant: 'primary', loading: true });
    expect(loadingHtml).toContain('wo-button--loading');
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('wo-spinner');

    // Disabled Button
    const disabledHtml = renderButton({ label: 'Delete', variant: 'danger', disabled: true });
    expect(disabledHtml).toContain('wo-button--danger');
    expect(disabledHtml).toContain('disabled');

    // Icon-only Button with accessible aria-label
    const iconBtnHtml = renderButton({ label: 'Close', icon: '✕', iconOnly: true, ariaLabel: 'Close Dialog' });
    expect(iconBtnHtml).toContain('wo-button--icon');
    expect(iconBtnHtml).toContain('aria-label="Close Dialog"');
    expect(iconBtnHtml).toContain('<span class="wo-sr-only">Close Dialog</span>');
  });

  it('E. verifies renderField semantic label, helper, and error linkage', () => {
    const fieldHtml = renderField({
      id: 'user-email',
      label: 'Email Address',
      required: true,
      helperText: 'We will never share your email.',
      errorMessage: 'Please enter a valid email address.',
      controlHtml: renderInput({ id: 'user-email', type: 'email', invalid: true, describedBy: 'user-email-helper user-email-error' })
    });

    expect(fieldHtml).toContain('for="user-email"');
    expect(fieldHtml).toContain('class="wo-required-marker"');
    expect(fieldHtml).toContain('id="user-email-helper"');
    expect(fieldHtml).toContain('id="user-email-error"');
    expect(fieldHtml).toContain('role="alert"');
    expect(fieldHtml).toContain('aria-invalid="true"');
    expect(fieldHtml).toContain('aria-describedby="user-email-helper user-email-error"');
  });

  it('F. verifies form controls: select, textarea, and inputs', () => {
    const selectHtml = renderSelect({
      id: 'site-selector',
      options: [
        { value: '', label: 'Select site' },
        { value: 'site-1', label: 'WashOps HQ', selected: true }
      ]
    });
    expect(selectHtml).toContain('id="site-selector"');
    expect(selectHtml).toContain('<option value="site-1" selected>WashOps HQ</option>');

    const textareaHtml = renderTextarea({
      id: 'feedback-msg',
      value: 'Great service!',
      rows: 4
    });
    expect(textareaHtml).toContain('id="feedback-msg"');
    expect(textareaHtml).toContain('rows="4"');
    expect(textareaHtml).toContain('>Great service!</textarea>');
  });

  it('G. verifies card and surface primitive rendering', () => {
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

  it('H. verifies badge semantic variants and renderStatusBadge domain mapping', () => {
    expect(renderBadge({ label: 'Active', variant: 'success' })).toContain('wo-badge wo-badge--success');
    expect(renderBadge({ label: 'Pending', variant: 'warning' })).toContain('wo-badge wo-badge--warning');

    // Domain status mapping
    expect(renderStatusBadge('completed')).toContain('wo-badge--success');
    expect(renderStatusBadge('paid')).toContain('wo-badge--success');
    expect(renderStatusBadge('approved')).toContain('wo-badge--success');
    expect(renderStatusBadge('quote-sent')).toContain('wo-badge--info');
    expect(renderStatusBadge('lead')).toContain('wo-badge--warning');
    expect(renderStatusBadge('overdue')).toContain('wo-badge--danger');
    expect(renderStatusBadge('rejected')).toContain('wo-badge--danger');
    expect(renderStatusBadge('unknown-custom')).toContain('wo-badge--neutral');
  });

  it('I. verifies tabs ARIA roles and semantics', () => {
    const tabsHtml = renderTabs({
      ariaLabel: 'Settings Sections',
      tabs: [
        { id: 'tab-general', label: 'General', panelId: 'panel-general', active: true },
        { id: 'tab-security', label: 'Security', panelId: 'panel-security' }
      ]
    });

    expect(tabsHtml).toContain('role="tablist"');
    expect(tabsHtml).toContain('aria-label="Settings Sections"');
    expect(tabsHtml).toContain('role="tab" id="tab-general" class="wo-tab" aria-selected="true" aria-controls="panel-general"');
    expect(tabsHtml).toContain('role="tab" id="tab-security" class="wo-tab" aria-selected="false" aria-controls="panel-security"');
  });

  it('J. verifies table primitive rendering and empty state', () => {
    const cols = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' }
    ];

    // Populated table
    const tableHtml = renderTable({
      columns: cols,
      rows: [
        { name: 'John Doe', status: 'Active' }
      ]
    });
    expect(tableHtml).toContain('<div class="wo-table-container">');
    expect(tableHtml).toContain('<th>Name</th>');
    expect(tableHtml).toContain('<td>John Doe</td>');

    // Empty table
    const emptyTableHtml = renderTable({
      columns: cols,
      rows: [],
      emptyMessage: 'No clients found.'
    });
    expect(emptyTableHtml).toContain('colspan="2"');
    expect(emptyTableHtml).toContain('No clients found.');
  });

  it('K. verifies dialog accessibility structure', () => {
    const dialogHtml = renderDialog({
      id: 'confirm-delete-modal',
      title: 'Confirm Deletion',
      bodyHtml: '<p>Are you sure you want to delete this client?</p>',
      footerHtml: renderButton({ label: 'Cancel', variant: 'ghost' }) + renderButton({ label: 'Delete', variant: 'danger' })
    });

    expect(dialogHtml).toContain('role="dialog"');
    expect(dialogHtml).toContain('aria-modal="true"');
    expect(dialogHtml).toContain('aria-labelledby="confirm-delete-modal-title"');
    expect(dialogHtml).toContain('id="confirm-delete-modal-title" class="wo-dialog-title"');
    expect(dialogHtml).toContain('data-dialog-close');
    expect(dialogHtml).toContain('<footer class="wo-dialog-footer">');
  });

  it('L. verifies alert, spinner, empty, and error state primitives', () => {
    const alertHtml = renderAlert({ variant: 'warning', title: 'Attention', message: 'Quota limit approaching.' });
    expect(alertHtml).toContain('wo-alert wo-alert--warning');
    expect(alertHtml).toContain('role="status"');
    expect(alertHtml).toContain('Attention');

    const spinnerHtml = renderSpinner({ size: 'lg', ariaLabel: 'Loading data' });
    expect(spinnerHtml).toContain('wo-spinner wo-spinner--lg');
    expect(spinnerHtml).toContain('aria-busy="true"');
    expect(spinnerHtml).toContain('Loading data');

    const emptyHtml = renderEmptyState({ title: 'No Invoices', description: 'Create an invoice to get started.' });
    expect(emptyHtml).toContain('wo-empty-state');
    expect(emptyHtml).toContain('No Invoices');

    const errorHtml = renderErrorState({ message: 'Unable to connect to service.' });
    expect(errorHtml).toContain('wo-error-state');
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('Unable to connect to service.');
  });
});
