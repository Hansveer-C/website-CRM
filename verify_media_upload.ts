import { uploadMediaAsset } from './src/utils/media_upload';
import { getWebsiteSettings, persistWebsiteSettings } from './src/website_settings_repo';
import { SectionsRepo } from './src/sections_repo_supabase';
import { PageSection } from './src/types';

async function runTests() {
  console.log('=== STARTING MEDIA UPLOAD & STORAGE MVP TESTS ===');

  const tenantA = 'tenant-user-a';
  const tenantB = 'tenant-user-b';

  console.log('\n[TEST 1] Valid JPEG upload succeeds (mock mode)');
  const res1 = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'avatar.jpg',
    'image/jpeg',
    1024 * 50, // 50KB
    'logo',
    undefined,
    undefined,
    false // Mock mode
  );

  if (!res1.success || !res1.public_url || !res1.storage_path) {
    throw new Error(`Valid JPEG upload failed: ${res1.error}`);
  }
  console.log('Valid JPEG success:', res1);
  if (!res1.public_url.startsWith('data:image/jpeg;base64,')) {
    throw new Error('Mock logo upload did not return a renderable data URL');
  }
  if (!res1.storage_path.startsWith(`${tenantA}/logos/logo-`)) {
    throw new Error(`Storage path did not scope to tenant user correctly: ${res1.storage_path}`);
  }

  console.log('\n[TEST 2] Valid PNG upload succeeds (mock mode)');
  const res2 = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'before.png',
    'image/png',
    1024 * 200, // 200KB
    'gallery_before',
    'item-123',
    undefined,
    false
  );

  if (!res2.success || !res2.storage_path) {
    throw new Error(`Valid PNG upload failed: ${res2.error}`);
  }
  console.log('Valid PNG success:', res2);
  if (!res2.storage_path.startsWith(`${tenantA}/gallery/item-123/before-`)) {
    throw new Error(`Storage path mismatch for gallery purpose: ${res2.storage_path}`);
  }

  console.log('\n[TEST 3] SVG upload is rejected (MVP Security)');
  const resSVG = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'dangerous.svg',
    'image/svg+xml',
    1024 * 5,
    'logo',
    undefined,
    undefined,
    false
  );
  if (resSVG.success) {
    throw new Error('SVG upload should have been rejected');
  }
  console.log('SVG correctly rejected:', resSVG.error);
  if (resSVG.error !== 'INVALID_FILE_TYPE') {
    throw new Error(`Expected INVALID_FILE_TYPE error, got ${resSVG.error}`);
  }

  console.log('\n[TEST 4] Dangerous file type (.exe) is rejected');
  const resExe = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'payload.exe',
    'application/octet-stream',
    1024 * 5,
    'logo',
    undefined,
    undefined,
    false
  );
  if (resExe.success) {
    throw new Error('Executable upload should have been rejected');
  }
  console.log('Executable correctly rejected:', resExe.error);

  console.log('\n[TEST 5] Oversized file is rejected (> 5MB)');
  const resLarge = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'massive.png',
    'image/png',
    5.1 * 1024 * 1024, // 5.1MB
    'logo',
    undefined,
    undefined,
    false
  );
  if (resLarge.success) {
    throw new Error('Oversized file upload should have been rejected');
  }
  console.log('Oversized file correctly rejected:', resLarge.error);
  if (resLarge.error !== 'FILE_TOO_LARGE') {
    throw new Error(`Expected FILE_TOO_LARGE error, got ${resLarge.error}`);
  }

  console.log('\n[TEST 6] Invalid purpose is rejected');
  const resPurpose = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'image.png',
    'image/png',
    1024 * 10,
    'invalid_purpose_string' as any,
    undefined,
    undefined,
    false
  );
  if (resPurpose.success) {
    throw new Error('Invalid purpose should have been rejected');
  }
  console.log('Invalid purpose correctly rejected:', resPurpose.error);

  console.log('\n[TEST 7] Gallery before upload requires gallery_item_id');
  const resGalleryId = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'before.png',
    'image/png',
    1024 * 10,
    'gallery_before',
    undefined, // Missing
    undefined,
    false
  );
  if (resGalleryId.success) {
    throw new Error('Gallery upload without ID should have been rejected');
  }
  console.log('Missing gallery item ID correctly rejected:', resGalleryId.error);

  console.log('\n[TEST 8] Builder image upload requires section_id');
  const resSectionId = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'bg.webp',
    'image/webp',
    1024 * 10,
    'builder_image',
    undefined,
    undefined, // Missing
    false
  );
  if (resSectionId.success) {
    throw new Error('Builder upload without section ID should have been rejected');
  }
  console.log('Missing section ID correctly rejected:', resSectionId.error);

  console.log('\n[TEST 9] User context scoping prevents tenant cross-over');
  const resTenant = await uploadMediaAsset(
    tenantB, // Tenant B
    'binary-data-placeholder',
    'logo.png',
    'image/png',
    1024 * 10,
    'logo',
    undefined,
    undefined,
    false
  );
  if (!resTenant.success || !resTenant.storage_path) {
    throw new Error('Tenant B upload failed');
  }
  if (!resTenant.storage_path.startsWith(`${tenantB}/`)) {
    throw new Error('Upload path leaked to another tenant');
  }
  console.log('Scoping correctly scoped to Tenant B path:', resTenant.storage_path);

  console.log('\n[TEST 10] Uploaded logo updates WebsiteSettings logo_url');
  const settingsRes = await getWebsiteSettings();
  if (!settingsRes.success || !settingsRes.data) {
    throw new Error('Failed to load settings');
  }

  const initialSettings = settingsRes.data;
  const newLogoUrl = res1.public_url!;
  
  const updatedSettings = {
    ...initialSettings,
    logo_url: newLogoUrl
  };

  const persistRes = await persistWebsiteSettings('system', 'ws-1', updatedSettings);
  if (!persistRes.success || !persistRes.data) {
    throw new Error('Failed to save settings');
  }
  if (persistRes.data.logo_url !== newLogoUrl) {
    throw new Error('logo_url was not updated to uploaded logo URL');
  }
  console.log('Website settings correctly updated with uploaded logo:', persistRes.data.logo_url.slice(0, 64) + '...');

  console.log('\n[TEST 11] Uploaded builder image updates section image URL');
  const testSection: PageSection = {
    id: 'sec-test-upload',
    page_id: 'p1',
    type: 'hero',
    content: {
      heading: 'Clean Surfaces',
      background_image: 'https://images.unsplash.com/photo-placeholder'
    },
    order: 1,
    styles: {}
  };

  const uploadRes = await uploadMediaAsset(
    tenantA,
    'binary-data-placeholder',
    'hero-bg.webp',
    'image/webp',
    1024 * 120,
    'builder_image',
    undefined,
    'sec-test-upload',
    false
  );

  testSection.content.background_image = uploadRes.public_url!;

  const persistSecRes = await SectionsRepo.persistSection(testSection, tenantA);
  if (!persistSecRes.success || !persistSecRes.data) {
    throw new Error('Failed to save page section');
  }
  if (persistSecRes.data.content.background_image !== uploadRes.public_url!) {
    throw new Error('Section background image URL was not updated to CDN URL');
  }
  if (persistSecRes.data.content.background_image.startsWith('data:image')) {
    throw new Error('Section background image stored base64! Must store CDN URL.');
  }
  console.log('Page section correctly updated with uploaded CDN URL:', persistSecRes.data.content.background_image);

  console.log('\n[TEST 12] Regression: existing external URL fallback still works');
  const externalUrl = 'https://images.unsplash.com/photo-1541604193435-22077a288934';
  const updatedExternalSettings = {
    ...persistRes.data,
    logo_url: externalUrl
  };

  const persistExternalRes = await persistWebsiteSettings('system', 'ws-1', updatedExternalSettings);
  if (!persistExternalRes.success || !persistExternalRes.data) {
    throw new Error('Failed to persist external fallback settings');
  }
  if (persistExternalRes.data.logo_url !== externalUrl) {
    throw new Error('External URL fallback setting was overwritten/broken');
  }
  console.log('External URL settings fallback verified successfully.');

  console.log('\n✅ ALL MEDIA UPLOAD & STORAGE TESTS PASSED SUCCESSFULLY');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
