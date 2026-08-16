import { expect, test } from '@playwright/test';

const graph = (key: string) => ({ success: true, data: {
  website: { id: 'site-1', user_id: 'system', name: 'Acme Wash', domain: null, subdomain: 'acme-wash-system', homepage_funnel_id: 'funnel-1', created_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  settings: { id: 'settings-1', user_id: 'system', website_id: 'site-1', business_name: 'Acme Wash', phone: '(555) 123-4567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: '2026-07-30T00:00:00Z' },
  route: { id: 'route-1', website_id: 'site-1', path: '/', funnel_id: 'funnel-1', created_at: '2026-07-30T00:00:00Z' },
  funnel: { id: 'funnel-1', user_id: 'system', name: 'Acme Wash Website', status: 'draft', created_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  page: { id: 'page-1', user_id: 'system', name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme Wash', seo_description: 'Austin washing', seo_keywords: ['Wash'], created_at: '2026-07-30T00:00:00Z', funnel_id: 'funnel-1', step_type: 'landing', step_order: 0 },
  sections: [
    {
      id: 'section-hero', page_id: 'page-1', type: 'hero', order: 0,
      content: { heading: 'Acme Wash', subheading: 'Trusted service in Austin', button_text: 'Get a Free Quote', background_image: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80' },
      styles: { padding: '100px 20px', text_alignment: 'center', background: '#ffffff', visible: true }
    },
    {
      id: 'section-offer', page_id: 'page-1', type: 'offer', order: 1,
      content: { headline: 'Our Services', description: 'House Washing in Austin.', button_text: 'Request a Quote', expiry: '' },
      styles: { padding: '80px 20px', background: '#4f46e5', color: '#ffffff', visible: true }
    },
    {
      id: 'section-form', page_id: 'page-1', type: 'form', order: 2,
      content: { title: 'Get My Free Quote', fields: ['name', 'phone'], pipeline_id: 'funnel-1' },
      styles: { padding: '60px 20px', background: '#f8fafc', visible: true }
    }
  ],
  created: true, idempotency_key: key
} });

async function openForm(page: import('@playwright/test').Page) {
  await page.goto('/#/website-dashboard');
  await expect(page.getByRole('heading', { name: 'Create your first website.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create your website' }).click();
  await page.getByRole('button', { name: 'House Washing' }).click();
  await page.locator('#ob-business-name').fill('Acme Wash');
  await page.locator('#ob-city').fill('Austin');
  await page.locator('#ob-phone').fill('(555) 123-4567');
  await expect(page.locator('#ob-phone')).toHaveValue('(555) 123-4567');
}

test('zero-website user creates once and refreshes into the exact site', async ({ page }, testInfo) => {
  let requests = 0;
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.route('**/api/websites/generate', async route => {
    requests += 1;
    const key = route.request().headers()['idempotency-key'];
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(graph(key)) });
  });
  await openForm(page);
  const startedAt = Date.now();
  await page.locator('#onboarding-submit').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator('#onboarding-submit')).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Your website is live!' })).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Edit Homepage' }).click();
  await expect(page).toHaveURL(/#\/builder\?websiteId=site-1&pageId=page-1&action=edit$/);
  await expect(page.locator('.pb-canvas-area')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Acme Wash' })).toBeVisible();
  await expect(page.getByText('Our Services', { exact: true })).toBeVisible();
  await expect(page.getByText('Get My Free Quote', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Layers' }).click();
  for (const label of ['Hero', 'Offer', 'Form']) {
    await page.getByRole('button', { name: `Select ${label} section` }).click();
    await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: label })).toBeVisible();
  }
  for (const [id, label] of [['section-hero', 'Hero'], ['section-offer', 'Offer'], ['section-form', 'Form']] as const) {
    await page.locator(`#sec-preview-${id}`).evaluate((section: HTMLElement) => section.click());
    await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: label })).toBeVisible();
    await expect(page.locator(`#sec-preview-${id}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: `Select ${label} section` })).toHaveAttribute('aria-current', 'true');
  }
  await page.locator('#sec-preview-section-hero h1 .pb-inline-text').click();
  await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: 'Hero' })).toBeVisible();
  await expect(page.locator('#sec-preview-section-hero')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#sec-preview-section-offer h2 .pb-inline-text').click();
  await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: 'Offer' })).toBeVisible();
  await expect(page.locator('#sec-preview-section-offer')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#sec-preview-section-form label').filter({ hasText: 'Full Name' }).click();
  await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: 'Form' })).toBeVisible();
  const canvasNameInput = page.locator('#pf-name-section-form');
  await canvasNameInput.fill('Canvas interaction retained');
  await expect(canvasNameInput).toHaveValue('Canvas interaction retained');
  await expect(page.locator('#sec-preview-section-form')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#sec-preview-section-form').press('Enter');
  await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: 'Form' })).toBeVisible();
  await page.evaluate(() => {
    const fixtureFetch = window.fetch;
    (window as any).__builderObservedSectionRequests = [];
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      (window as any).__builderObservedSectionRequests.push({ url, method: init?.method ?? (input instanceof Request ? input.method : 'GET') });
      return fixtureFetch(input, init);
    };
  });
  const missingPageStatus = await page.evaluate(async () => (await window.fetch('/api/page-sections', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generation: 1, expected_revision: 0, sections: [] })
  })).status);
  expect(missingPageStatus).toBe(400);
  await page.evaluate(() => { (window as any).__builderFixtureSaveFailureCount = 1; });
  await page.getByRole('button', { name: 'Select Hero section' }).click();
  const failedSaveHeading = page.locator('.pb-inspector-field').filter({ hasText: 'Heading' }).locator('input');
  await failedSaveHeading.fill('Preserved through retry');
  await failedSaveHeading.blur();
  await expect(page.locator('#pb-autosave-indicator')).toContainText('Save failed', { timeout: 10_000 });
  await expect(page.locator('.pb-inspector-field').filter({ hasText: 'Heading' }).locator('input')).toHaveValue('Preserved through retry');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#pb-autosave-indicator')).toContainText('Saved', { timeout: 10_000 });
  const observedSectionRequests = await page.evaluate(() => (window as any).__builderObservedSectionRequests);
  expect(observedSectionRequests).toEqual(expect.arrayContaining([
    expect.objectContaining({ url: '/api/page-section-save-revision?pageId=page-1', method: 'GET' }),
    expect.objectContaining({ url: '/api/page-sections?pageId=page-1', method: 'PUT' })
  ]));
  const edits = [
    ['Hero', 'Verified Hero'],
    ['Offer', 'Verified Offer'],
    ['Form', 'Verified Form']
  ] as const;
  for (const [label, text] of edits) {
    await page.getByRole('button', { name: `Select ${label} section` }).click();
    await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: label })).toBeVisible();
    const heading = page.locator('.pb-inspector-field').filter({ hasText: 'Heading' }).locator('input');
    await heading.fill(text);
    await heading.blur();
  }
  await expect(page.locator('#pb-autosave-indicator')).toContainText('Saved', { timeout: 10_000 });
  await page.reload();
  await expect(page).toHaveURL(/#\/builder\?websiteId=site-1&pageId=page-1&action=edit$/);
  await expect(page.locator('.pb-canvas-area')).toBeVisible();
  await page.getByRole('tab', { name: 'Layers' }).click();
  for (const [label, text] of edits) {
    await page.getByRole('button', { name: `Select ${label} section` }).click();
    await expect(page.locator('.pb-inspector-header').getByRole('heading', { name: label })).toBeVisible();
    const heading = page.locator('.pb-inspector-field').filter({ hasText: 'Heading' }).locator('input');
    await expect(heading).toHaveValue(text);
  }
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByText(/LEGACY SECTION|Legacy Section Type/)).toHaveCount(0);
  for (const [id, , text] of [
    ['section-hero', 'Hero', 'Verified Hero'],
    ['section-offer', 'Offer', 'Verified Offer'],
    ['section-form', 'Form', 'Verified Form']
  ] as const) {
    await expect(page.locator(`#sec-preview-${id}`)).toContainText(text);
  }
  await page.evaluate(() => window.navigateTo('website-dashboard'));
  await expect(page.getByRole('heading', { name: 'Acme Wash' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Acme Wash' })).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Acme Wash' })).toBeVisible();
  await testInfo.attach('creation-measurement.json', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ requestCount: requests, elapsedMs: Date.now() - startedAt })) });
  expect(browserErrors).toEqual([]);
});

test('retry preserves inputs and reuses the idempotency key', async ({ page }) => {
  const keys: string[] = [];
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  let attempt = 0;
  await page.route('**/api/websites/generate', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    attempt += 1;
    if (attempt === 1) return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Website creation is temporarily unavailable. Try again.' } })
    });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(graph(keys[0])) });
  });
  await openForm(page);
  await page.getByRole('button', { name: 'Generate My Website' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.getByLabel('Business Name')).toHaveValue('Acme Wash');
  await page.getByRole('button', { name: 'Generate My Website' }).click();
  await expect(page.getByRole('heading', { name: 'Your website is live!' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(browserErrors).toEqual(['Failed to load resource: the server responded with a status of 503 (Service Unavailable)']);
});
