import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4191' ? route.continue() : route.abort());
  // Serve the real recovery router/UI under the canonical root callback using local mocks.
  await page.route('http://127.0.0.1:4191/?**', async route => {
    const response = await route.fetch({ url: 'http://127.0.0.1:4191/tests/fixtures/password-recovery.html' });
    await route.fulfill({ response });
  });
});
test('request is generic, keyboard accessible, and does not update a password', async ({ page }) => {
  await page.goto('/tests/fixtures/password-recovery.html#/forgot-password');
  await page.getByLabel('Email', {exact:true}).fill('synthetic@example.test');
  await page.getByLabel('Email', {exact:true}).press('Enter');
  await expect(page.getByRole('status')).toContainText('If an account can receive recovery email');
  expect(await page.evaluate(() => (window as any).calls)).toEqual(['request']);
});
test('recovery callback is scrubbed; matching passwords update once and return to sign-in', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?auth=recovery#type=recovery&access_token=synthetic&refresh_token=synthetic-refresh');
  await expect(page.getByRole('heading',{name:'Set a new password'})).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4191/#/reset-password');
  await page.getByLabel('New password',{exact:true}).fill('synthetic-test-password');
  await page.getByLabel('Confirm new password',{exact:true}).fill('mismatched-password');
  await page.getByRole('button',{name:'Update password',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('matching passwords');
  expect(await page.getByLabel('New password',{exact:true}).inputValue()).toBe('');
  await page.getByLabel('New password',{exact:true}).fill('synthetic-test-password');
  await page.getByLabel('Confirm new password',{exact:true}).fill('synthetic-test-password');
  await page.getByLabel('Confirm new password',{exact:true}).press('Enter');
  await expect(page.getByRole('status')).toContainText('Password updated');
  expect(await page.evaluate(() => (window as any).calls)).toEqual(['exchange','update','signout']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link',{name:'Back to sign in'}).click();
  await expect(page.getByText('Normal sign-in route')).toBeVisible();
});
test('expired and malformed callbacks cannot update or expose provider errors', async ({ page }) => {
  for (const suffix of [
    '#type=recovery&access_token=expired&refresh_token=synthetic',
    '#error=access_denied&error_description=PRIVATE',
    '#/reset-password'
  ]) {
    await page.goto('/?auth=recovery' + suffix);
    await expect(page.getByRole('status')).toContainText('invalid or expired');
    await expect(page.getByText('PRIVATE')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
    expect(page.url()).toBe('http://127.0.0.1:4191/#/reset-password');
  }
});
test('actual application handles recovery before CRM bootstrap and reload fails closed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.unroute('http://127.0.0.1:4191/?**');
  await page.goto('/?auth=recovery#error=access_denied&error_description=PRIVATE');
  await expect(page.getByRole('status')).toContainText('invalid or expired');
  expect(page.url()).toBe('http://127.0.0.1:4191/#/reset-password');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('invalid or expired');
  await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
  await page.evaluate(() => (window as any).navigateTo('dashboard'));
  await expect(page.getByRole('status')).toContainText('invalid or expired');
  expect(page.url()).toBe('http://127.0.0.1:4191/#/reset-password');
  await page.getByRole('button',{name:'Request a new link'}).click();
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await page.evaluate(() => (window as any).navigateTo('site'));
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4191/#/forgot-password');
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
  expect(errors).toEqual([]);
});
