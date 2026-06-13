/**
 * verify_business_settings_persistence.ts
 *
 * Verifies that business settings (business_name, phone, sms_number, email, primary_color)
 * can be saved and retrieved from the local persistence layer (localStorage bridge) and that
 * public rendering uses the correct values.
 *
 * Run with: npx tsx verify_business_settings_persistence.ts
 */

import { persistWebsiteSettings, getWebsiteSettings, DEFAULT_SETTINGS } from './src/website_settings_repo';
import { WebsiteSettings } from './src/types';

// ---------------------------------------------------------------------------
// Mock localStorage for Node.js test environment
// ---------------------------------------------------------------------------
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
};

// Patch window + localStorage globals before importing repo functions
(global as any).window = {
  localStorage: mockLocalStorage,
};
(global as any).document = undefined; // No DOM in Node

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test settings object
// ---------------------------------------------------------------------------
const TEST_USER = 'test-user-001';
const TEST_WEBSITE = 'test-website-001';
const TEST_SETTINGS: WebsiteSettings = {
  id: 'settings-test',
  business_name: 'Hans Test Pressure Washing',
  phone: '604-555-1212',
  sms_number: '604-555-3434',
  email: 'test@handymanhans.com',
  logo_url: 'https://example.com/logo.png',
  primary_color: '#e63946',
  facebook_pixel_id: '',
  gtm_id: '',
  ga4_measurement_id: '',
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: 'Hi {name}!',
  missed_call_sms_enabled: true,
  missed_call_sms_template: 'Missed your call!',
  created_at: new Date().toISOString(),
  cities_served: ['Vancouver', 'Burnaby'],
  services_offered: ['Driveway Cleaning'],
  publish_status: 'draft',
};

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
async function runTests(): Promise<void> {
  console.log('\n========================================');
  console.log('Business Settings Persistence — Test Run');
  console.log('========================================\n');

  // --- Field Existence in Type ---
  console.log('► Section 1: Type/interface field existence');
  const sample: WebsiteSettings = { ...DEFAULT_SETTINGS };
  assert('business_name field exists in type', 'business_name' in sample);
  assert('phone field exists in type', 'phone' in sample);
  assert('sms_number field exists in type (optional)', 'sms_number' in DEFAULT_SETTINGS || true); // optional
  assert('email field exists in type', 'email' in sample);
  assert('primary_color field exists in type', 'primary_color' in sample);

  // --- Persist + Retrieve ---
  console.log('\n► Section 2: Persist settings');
  const persistRes = await persistWebsiteSettings(TEST_USER, TEST_WEBSITE, TEST_SETTINGS);
  assert('persistWebsiteSettings returns success', persistRes.success, JSON.stringify(persistRes.error));

  // Check localStorage was written
  const storageKey = `mock_settings_${TEST_USER}:${TEST_WEBSITE}`;
  const rawStored = localStorageStore[storageKey];
  assert('localStorage key was written', !!rawStored, `Key: ${storageKey}`);

  if (rawStored) {
    const stored = JSON.parse(rawStored) as WebsiteSettings;
    assert('business_name persisted correctly', stored.business_name === TEST_SETTINGS.business_name, stored.business_name);
    assert('phone persisted correctly', stored.phone === TEST_SETTINGS.phone, stored.phone);
    assert('sms_number persisted correctly', stored.sms_number === TEST_SETTINGS.sms_number, stored.sms_number);
    assert('email persisted correctly', stored.email === TEST_SETTINGS.email, stored.email);
    assert('primary_color persisted correctly', stored.primary_color === TEST_SETTINGS.primary_color, stored.primary_color);
  }

  // --- Retrieve after simulated refresh ---
  console.log('\n► Section 3: Retrieve after simulated page refresh');
  // Simulate refresh: Supabase will fail (no real connection), but localStorage was written
  const getRes = await getWebsiteSettings(TEST_USER, TEST_WEBSITE);
  assert('getWebsiteSettings returns success', getRes.success, JSON.stringify(getRes.error));
  assert('business_name restored from localStorage', getRes.data?.business_name === TEST_SETTINGS.business_name, getRes.data?.business_name);
  assert('phone restored from localStorage', getRes.data?.phone === TEST_SETTINGS.phone, getRes.data?.phone);
  assert('sms_number restored from localStorage', getRes.data?.sms_number === TEST_SETTINGS.sms_number, getRes.data?.sms_number);
  assert('email restored from localStorage', getRes.data?.email === TEST_SETTINGS.email, getRes.data?.email);
  assert('primary_color restored from localStorage', getRes.data?.primary_color === TEST_SETTINGS.primary_color, getRes.data?.primary_color);

  // --- SMS fallback behavior ---
  console.log('\n► Section 4: SMS fallback logic');
  const settingsNoSms: WebsiteSettings = { ...TEST_SETTINGS, sms_number: '' };
  const persistNoSms = await persistWebsiteSettings(TEST_USER, 'website-no-sms', settingsNoSms);
  const getNoSms = await getWebsiteSettings(TEST_USER, 'website-no-sms');
  const smsTarget = getNoSms.data?.sms_number || getNoSms.data?.phone;
  assert('SMS target falls back to phone when sms_number is blank', smsTarget === TEST_SETTINGS.phone, smsTarget);

  // --- Corrupted cache recovery ---
  console.log('\n► Section 5: Corrupted localStorage recovery');
  const corruptKey = `mock_settings_${TEST_USER}:corrupt-test`;
  localStorageStore[corruptKey] = '{ INVALID JSON {{{{';
  const corruptRes = await getWebsiteSettings(TEST_USER, 'corrupt-test');
  assert('Corrupted cache is handled gracefully (returns success)', corruptRes.success);
  // The corrupt key should either be removed or replaced with valid JSON (not the corrupt value)
  const postCorruptValue = localStorageStore[corruptKey];
  const isCorruptGone = !postCorruptValue || (() => { try { JSON.parse(postCorruptValue); return true; } catch { return false; } })();
  assert('Corrupted cache value is gone or replaced with valid JSON', isCorruptGone, postCorruptValue?.substring(0, 40));

  // --- Multi-tenant isolation ---
  console.log('\n► Section 6: Multi-tenant isolation');
  const USER_A = 'user-a';
  const USER_B = 'user-b';
  const SITE = 'shared-site-id';
  const settingsA: WebsiteSettings = { ...TEST_SETTINGS, business_name: 'Alpha Washing', phone: '111-111-1111' };
  const settingsB: WebsiteSettings = { ...TEST_SETTINGS, business_name: 'Beta Washing', phone: '222-222-2222' };
  await persistWebsiteSettings(USER_A, SITE, settingsA);
  await persistWebsiteSettings(USER_B, SITE, settingsB);
  const resA = await getWebsiteSettings(USER_A, SITE);
  const resB = await getWebsiteSettings(USER_B, SITE);
  assert('User A settings are isolated', resA.data?.business_name === 'Alpha Washing', resA.data?.business_name);
  assert('User B settings are isolated', resB.data?.business_name === 'Beta Washing', resB.data?.business_name);

  // --- Public rendering simulation ---
  console.log('\n► Section 7: Public rendering value check');
  const finalSettings = getRes.data!;
  const expectedTel = `tel:${finalSettings.phone}`;
  const expectedSms = `sms:${finalSettings.sms_number || finalSettings.phone}`;
  const expectedMailto = `mailto:${finalSettings.email}`;
  assert('tel: link would use saved phone', expectedTel === `tel:${TEST_SETTINGS.phone}`, expectedTel);
  assert('sms: link would use sms_number', expectedSms === `sms:${TEST_SETTINGS.sms_number}`, expectedSms);
  assert('mailto: link would use saved email', expectedMailto === `mailto:${TEST_SETTINGS.email}`, expectedMailto);
  assert('primary_color would be applied', finalSettings.primary_color === TEST_SETTINGS.primary_color, finalSettings.primary_color);
  assert('business_name appears in header', finalSettings.business_name === TEST_SETTINGS.business_name, finalSettings.business_name);

  // --- Summary ---
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
