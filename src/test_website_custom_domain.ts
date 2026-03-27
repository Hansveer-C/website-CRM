import 'dotenv/config';
import { WebsitesRepo } from './websites_repo_supabase';
import { Website } from './types';

async function testWebsiteCustomDomain() {
  console.log('--- Testing Custom Domain Resolution (Phase W1.7) ---');

  // 1. Create a test website with a subdomain
  const userId = `test-user-${Date.now()}`;
  const websiteName = 'Domain Test Site';
  const website = await WebsitesRepo.createWebsite(userId, websiteName);
  const subdomain = website.subdomain;
  const customDomain = `test-custom-domain-${Date.now()}.com`;

  console.log(`Step 1: Website created with subdomain: ${subdomain}`);

  // 2. Add a custom domain to this website
  console.log(`Step 2: Updating website with custom domain: ${customDomain}`);
  await WebsitesRepo.updateWebsite({
    id: website.id,
    domain: customDomain
  });

  // 3. Test resolution via subdomain
  console.log(`Step 3: Resolving via subdomain "${subdomain}"...`);
  const resolvedBySubdomain = await WebsitesRepo.lookupWebsite(subdomain);
  if (resolvedBySubdomain && resolvedBySubdomain.id === website.id) {
    console.log('✅ PASS: Resolved correctly via subdomain.');
  } else {
    console.error('❌ FAIL: Subdomain resolution failed.');
    process.exit(1);
  }

  // 4. Test resolution via custom domain
  console.log(`Step 4: Resolving via custom domain "${customDomain}"...`);
  const resolvedByDomain = await WebsitesRepo.lookupWebsite(customDomain);
  if (resolvedByDomain && resolvedByDomain.id === website.id) {
    console.log('✅ PASS: Resolved correctly via custom domain.');
  } else {
    console.error('❌ FAIL: Custom domain resolution failed.');
    process.exit(1);
  }

  // 5. Test prioritization if we had an overlap (simulated)
  // We can't easily create an overlap here as subdomain is unique and domain is nullable,
  // but the logic check in Step 1/2 of lookupWebsite ensures the order.
  
  console.log('\n✅ Website Custom Domain Resolution tests PASSED.');
}

testWebsiteCustomDomain().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
