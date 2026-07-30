import { expect, test } from '@playwright/test';

const graph = (key: string) => ({ success: true, data: {
  website: { id: 'site-1', user_id: 'system', name: 'Acme Wash', domain: null, subdomain: 'acme-wash-system', homepage_funnel_id: 'funnel-1', created_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  settings: { id: 'settings-1', user_id: 'system', website_id: 'site-1', business_name: 'Acme Wash', phone: '(555) 123-4567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: '2026-07-30T00:00:00Z' },
  route: { id: 'route-1', website_id: 'site-1', path: '/', funnel_id: 'funnel-1', created_at: '2026-07-30T00:00:00Z' },
  funnel: { id: 'funnel-1', user_id: 'system', name: 'Acme Wash Website', status: 'draft', created_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  page: { id: 'page-1', user_id: 'system', name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme Wash', seo_description: 'Austin washing', seo_keywords: ['Wash'], created_at: '2026-07-30T00:00:00Z', funnel_id: 'funnel-1', step_type: 'landing', step_order: 0 },
  sections: [{ id: 'section-1', page_id: 'page-1', type: 'hero', content: { heading: 'Acme Wash' }, order: 0, styles: {} }],
  created: true, idempotency_key: key
} });

async function openForm(page: import('@playwright/test').Page) {
  await page.goto('/#/website-dashboard');
  await expect(page.getByRole('heading', { name: 'Create your first website.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create your website' }).click();
  await page.getByLabel('Business Name').fill('Acme Wash');
  await page.getByLabel('Service City').fill('Austin');
  await page.getByLabel('Phone Number').fill('(555) 123-4567');
  await page.getByRole('button', { name: 'House Washing' }).click();
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
  await page.reload();
  await expect(page).toHaveURL(/#\/builder\?websiteId=site-1&pageId=page-1&action=edit$/);
  await expect(page.locator('.pb-canvas-area')).toBeVisible();
  await page.evaluate(() => window.navigateTo('website-dashboard'));
  await expect(page.getByRole('heading', { name: 'Acme Wash' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
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
