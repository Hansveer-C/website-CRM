/**
 * Diagnostic coverage for browser-facing persistence keys.
 *
 * This verifier focuses on the runtime contracts that the real browser UI uses:
 * - settings save/restore uses mock_settings_${userId}:${websiteId}
 * - section save/restore uses mock_sections_${userId}:${pageId}
 * - partial settings saves merge rather than replacing existing fields
 */

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const localStorageStore: Record<string, string> = {};

(global as any).window = {
  localStorage: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { delete localStorageStore[key]; },
  },
};
(global as any).localStorage = (global as any).window.localStorage;

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function run(): Promise<void> {
  const { persistWebsiteSettings, getWebsiteSettings } = await import('./src/website_settings_repo');
  const { SectionsRepo } = await import('./src/sections_repo_supabase');

  const userId = 'system';
  const websiteId = 'ws-1';
  const settingsKey = `mock_settings_${userId}:${websiteId}`;

  await persistWebsiteSettings(userId, websiteId, {
    business_name: 'Browser Persist Test Co',
    phone: '604-111-2222',
    sms_number: '604-333-4444',
    email: 'browser@testco.com',
    logo_url: 'https://example.com/browser-logo.png',
    primary_color: '#dc2626',
  });

  assert('settings are saved under browser runtime key', !!localStorageStore[settingsKey], settingsKey);
  const storedSettings = JSON.parse(localStorageStore[settingsKey]);
  assert('business_name stored', storedSettings.business_name === 'Browser Persist Test Co', storedSettings.business_name);
  assert('phone stored', storedSettings.phone === '604-111-2222', storedSettings.phone);
  assert('sms_number stored', storedSettings.sms_number === '604-333-4444', storedSettings.sms_number);
  assert('email stored', storedSettings.email === 'browser@testco.com', storedSettings.email);
  assert('logo_url stored', storedSettings.logo_url === 'https://example.com/browser-logo.png', storedSettings.logo_url);
  assert('primary_color stored', storedSettings.primary_color === '#dc2626', storedSettings.primary_color);

  await persistWebsiteSettings(userId, websiteId, { primary_color: '#16a34a' });
  const mergedSettings = await getWebsiteSettings(userId, websiteId);
  assert('partial save keeps business_name', mergedSettings.data?.business_name === 'Browser Persist Test Co', mergedSettings.data?.business_name);
  assert('partial save keeps logo_url', mergedSettings.data?.logo_url === 'https://example.com/browser-logo.png', mergedSettings.data?.logo_url);
  assert('partial save updates primary_color', mergedSettings.data?.primary_color === '#16a34a', mergedSettings.data?.primary_color);

  const pageId = 'browser-page-1';
  const sectionKey = `mock_sections_${userId}:${pageId}`;
  await SectionsRepo.persistSection({
    id: 'browser-section-1',
    page_id: pageId,
    type: 'hero',
    content: { heading: 'Browser Persist Headline' },
    order: 1,
    styles: {},
  } as any, userId);

  assert('sections are saved under browser runtime key', !!localStorageStore[sectionKey], sectionKey);
  const restored = await SectionsRepo.getSectionsForPage(pageId, userId);
  assert('section restore succeeds', restored.success);
  assert('edited headline restores', restored.data?.[0]?.content?.heading === 'Browser Persist Headline', restored.data?.[0]?.content?.heading);
  assert('section restore avoids duplicates', restored.data?.length === 1, String(restored.data?.length));

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
