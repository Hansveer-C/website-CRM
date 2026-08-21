import { describe, it, expect } from 'vitest';
import {
  renderCard,
  renderField,
  renderSelect,
  getFieldAccessibilityProps
} from './primitives';

describe('Website Selector Pilot Accessibility Linkage', () => {
  const mockWebsites = [
    { id: 'site-1', name: 'WashOps Main', domain: 'washops.com' },
    { id: 'site-2', name: 'WashOps Express', domain: 'express.washops.com' }
  ];

  function renderTestWebsiteSelector(id: string, label: string, websites: typeof mockWebsites, invalid = false) {
    const fieldA11y = getFieldAccessibilityProps(id, { hasError: invalid });

    const selectHtml = renderSelect({
      id,
      className: 'wo-select',
      invalid: fieldA11y.invalid,
      describedBy: fieldA11y.describedBy,
      options: [
        { value: '', label: 'Select a website' },
        ...websites.map(site => ({
          value: site.id,
          label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}`
        }))
      ]
    });

    const fieldHtml = renderField({
      id,
      label,
      controlHtml: selectHtml,
      errorMessage: invalid ? 'That website is not available for this account. Choose an owned website.' : undefined
    });

    return renderCard({
      title: 'Choose a website',
      bodyHtml: `
        <p style="margin-bottom: var(--wo-space-4); color: var(--wo-color-text-secondary);">${invalid ? 'That website is not available for this account. Choose an owned website.' : 'Select the website whose settings you want to manage.'}</p>
        ${fieldHtml}
      `,
      className: 'website-settings-selection'
    });
  }

  it('verifies valid Website Settings selector output has proper semantic markup without error attributes', () => {
    const output = renderTestWebsiteSelector('settings-website-select', 'Website', mockWebsites, false);

    expect(output).toContain('<label for="settings-website-select" class="wo-label">Website</label>');
    expect(output).toContain('id="settings-website-select"');
    expect(output).not.toContain('aria-invalid="true"');
    expect(output).not.toContain('aria-describedby');
    expect(output).not.toContain('id="settings-website-select-error"');
    expect(output).not.toContain('wo-card--invalid');
    expect(output).toContain('class="wo-card website-settings-selection"');
  });

  it('verifies invalid Website Settings selector output links select to error message via aria-invalid and aria-describedby', () => {
    const output = renderTestWebsiteSelector('settings-website-select', 'Website', mockWebsites, true);

    // Label linkage
    expect(output).toContain('<label for="settings-website-select" class="wo-label">Website</label>');

    // Select invalid & describedby linkage
    expect(output).toContain('id="settings-website-select"');
    expect(output).toContain('aria-invalid="true"');
    expect(output).toContain('aria-describedby="settings-website-select-error"');

    // Error message semantic role and ID
    expect(output).toContain('id="settings-website-select-error"');
    expect(output).toContain('class="wo-field-error" role="alert"');
    expect(output).toContain('That website is not available for this account. Choose an owned website.');

    // Dead class removed
    expect(output).not.toContain('wo-card--invalid');
  });

  it('verifies management selector invalid output links correctly', () => {
    const output = renderTestWebsiteSelector('management-website-select', 'Website', mockWebsites, true);

    expect(output).toContain('<label for="management-website-select" class="wo-label">Website</label>');
    expect(output).toContain('id="management-website-select"');
    expect(output).toContain('aria-invalid="true"');
    expect(output).toContain('aria-describedby="management-website-select-error"');
    expect(output).toContain('id="management-website-select-error" class="wo-field-error" role="alert"');
  });
});
