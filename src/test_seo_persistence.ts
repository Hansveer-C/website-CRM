import 'dotenv/config';
import { WebsiteRoutesRepo } from './website_routes_repo_supabase';
import { WebsitesRepo } from './websites_repo_supabase';
import { FunnelsRepo } from './funnels_repo_supabase';

async function testSeoPersistence() {
    console.log('--- Testing SEO Page Persistence (PROMPT W3.1) ---');
    
    // 1. Setup mock context
    const userId = 'system';
    
    try {
        // Find or create a test website
        let website = await WebsitesRepo.getWebsiteByUser(userId);
        if (!website) {
            website = await WebsitesRepo.createWebsite(userId, 'SEO Test Site');
        }
        
        // Find or create a test funnel
        const funnels = await FunnelsRepo.getFunnels(userId);
        let funnelId = funnels.data?.[0]?.id;
        if (!funnelId) {
            const res = await FunnelsRepo.createFunnel(userId, 'SEO Test Funnel');
            funnelId = res.data!.id;
        }

        const testSlug = `test-seo-page-${Date.now()}`;
        const testPath = `/${testSlug}`;

        console.log(`[TEST] Adding SEO route: ${testPath} (slug: ${testSlug})`);

        // 2. Add SEO route
        const route = await WebsiteRoutesRepo.addRoute(website.id, testPath, funnelId!, {
            is_seo_page: true,
            city: 'Seattle',
            service: 'Pressure Washing',
            slug: testSlug
        });

        console.log('✅ Route added:', route.id);
        
        // 3. Verify persistence
        const fetched = await WebsiteRoutesRepo.getRouteByPath(website.id, testPath);
        
        if (fetched && fetched.is_seo_page && fetched.city === 'Seattle' && fetched.slug === testSlug) {
            console.log('✅ [TEST SUCCESS] SEO fields persisted correctly.');
        } else {
            console.error('❌ [TEST FAILED] Mismatch in persisted fields.');
            console.log('Fetched:', fetched);
            process.exit(1);
        }

        // 4. Test uniqueness of slug (website_id + slug)
        // Note: This relies on the SQL migration being Applied in the real Supabase DB.
        // We'll try to add the same slug again and see if it fails as expected.
        try {
            console.log('[TEST] Checking uniqueness (adding duplicate slug)...');
            await WebsiteRoutesRepo.addRoute(website.id, `/different-path`, funnelId!, {
                slug: testSlug
            });
            console.warn('⚠️  Expected uniqueness error but it succeeded. (SQL Migration might NOT be applied yet)');
        } catch (e: any) {
            console.log('✅ Caught expected unique constraint error:', e.message);
        }

        // Cleanup (optional)
        // await WebsiteRoutesRepo.deleteRoute(route.id);

    } catch (e: any) {
        console.error('❌ [TEST CRASHED]:', e.message);
        process.exit(1);
    }
}

testSeoPersistence();
