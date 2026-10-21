import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/tests/fixtures/quote-service-location.html'); await expect(page.getByLabel('Customer service location')).toBeVisible(); });
test('selection, cancel, repeated click and saved selection', async ({ page }) => {
  await page.getByLabel('Customer service location').selectOption('p1'); await page.getByRole('button', { name: 'Cancel selection' }).click();
  await expect(page.getByLabel('Customer service location')).toHaveValue('');
  await page.evaluate(() => (window as any).locationFixture.reset({ delay: 250 }));
  await page.getByLabel('Customer service location').selectOption('p1'); await page.getByRole('button', { name: 'Save service location', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save service location', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).locationFixture.state().saves)).toBe(1);
  await expect(page.getByLabel('Customer service location')).toHaveValue('p1');
});
test('uncertain retry preserves request; stale conflict requires refresh', async ({ page }) => {
  await page.evaluate(() => (window as any).locationFixture.reset({ mode: 'timeout' }));
  await page.getByLabel('Customer service location').selectOption('p1'); await page.getByRole('button', { name: 'Save service location', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be confirmed'); await expect(page.getByLabel('Customer service location')).toBeDisabled();
  await page.evaluate(() => (window as any).locationFixture.recover()); await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByLabel('Customer service location')).toBeEnabled();
  const keys = await page.evaluate(() => (window as any).locationFixture.state().keys); expect(keys[0]).toBe(keys[1]);
  await page.evaluate(() => (window as any).locationFixture.reset({ mode: 'conflict' }));
  await page.getByLabel('Customer service location').selectOption('p1'); await page.getByRole('button', { name: 'Save service location', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('estimate changed'); await expect(page.locator('select')).toHaveCount(0);
  await page.evaluate(() => (window as any).locationFixture.recover()); await page.getByRole('button', { name: 'Refresh service location' }).click(); await expect(page.getByLabel('Customer service location')).toBeVisible();
});
test('load failure, empty state, accepted legacy and unassigned states', async ({ page }) => {
  await page.evaluate(() => (window as any).locationFixture.reset({ mode: 'load-error' })); await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await page.evaluate(() => (window as any).locationFixture.recover()); await page.getByRole('button', { name: 'Refresh service location' }).click();
  await expect(page.getByLabel('Customer service location')).toBeVisible();
  await page.evaluate(() => (window as any).locationFixture.reset({ empty: true })); await expect(page.getByText('No service locations are available', { exact: false })).toBeVisible();
  await page.evaluate(() => (window as any).locationFixture.reset({ quote: { status: 'approved' }, snapshot: {} })); await expect(page.getByText('This older acceptance', { exact: false })).toBeVisible();
  await page.evaluate(() => (window as any).locationFixture.reset({ quote: { status: 'approved' }, snapshot: { service_location_status: 'unassigned', service_location: null } })); await expect(page.getByText('No service location was assigned', { exact: false })).toBeVisible();
});
test('navigation discards late save and accepted snapshot is immutable at mobile width', async ({ page }) => {
  await page.evaluate(() => (window as any).locationFixture.reset({ delay: 200 })); await page.getByLabel('Customer service location').selectOption('p1'); await page.getByRole('button', { name: 'Save service location', exact: true }).click();
  await page.evaluate(() => (window as any).locationFixture.leave()); await expect(page.getByText('Another estimate')).toBeVisible(); await page.waitForTimeout(250); await expect(page.getByText('Another estimate')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => (window as any).locationFixture.reset({ quote: { status: 'approved' }, snapshot: { service_location_status: 'recorded', service_location: { schema_version: 1, property_id: 'aa200000-0000-4000-8000-000000000001', label: 'Original driveway', service_address_line1: 'Frozen service address', service_address_line2: null, locality: 'Town', administrative_area: null, postal_code: null, country_code: 'CA' } } }));
  await expect(page.getByText('Original driveway, Frozen service address, Town, CA')).toBeVisible(); await expect(page.locator('select')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('accepted-location-mobile.png'), fullPage: true });
});
