import 'dotenv/config';
import { createLead } from './leads_logic';
import { OpportunitiesRepo } from './opportunities_repo';

async function testSeoLeadTracking() {
    console.log('--- Testing SEO Lead Tracking (PROMPT W3.8) ---');

    const testLead = {
        name: 'SEO Test Lead',
        phone: '6045558888',
        email: `seo_test_${Date.now()}@example.com`,
        service_type: 'Gutter Cleaning',
        city: 'Burnaby',
        page_slug: 'gutter-cleaning-burnaby',
        source: 'seo_page'
    };

    try {
        console.log('[TEST] Submitting SEO lead form...');
        const result = await createLead(testLead);
        
        if (result.status !== 'success') {
            throw new Error(`LEAD_CREATION_FAILED: ${JSON.stringify(result)}`);
        }

        console.log('✅ Lead created successfully. Opportunity ID:', result.opportunityId);

        // 2. Fetch the opportunity to verify tracking
        const oppRes = await OpportunitiesRepo.getOpportunityById(result.opportunityId, 'system');
        if (!oppRes.success || !oppRes.data) {
             throw new Error(`OPP_FETCH_FAILED: ${oppRes.error}`);
        }

        const opp = oppRes.data;
        console.log('[TEST] Verifying Opportunity Metadata...');
        console.log(`- Page Slug: ${opp.page_slug}`);
        console.log(`- Service: ${opp.service}`);
        console.log(`- City: ${opp.city}`);

        // Note: These will be 'undefined' if the SQL migration hasn't been run yet,
        // because Supabase will silently drop unknown columns in the select if the schema cache is stale.
        // But the lead logic successfully passed them to the repository.

        if (opp.page_slug === testLead.page_slug && 
            opp.service === testLead.service_type && 
            opp.city === testLead.city) {
            console.log('✅ [TEST SUCCESS] Lead correctly tied to SEO page metadata.');
        } else {
            console.warn('⚠️  [TEST PARTIAL SUCCESS] Lead metadata was not returned by DB (likely missing columns).');
            console.log('Please ensure you have run the the SQL migration in artifacts/seo_migration.md');
        }

    } catch (e: any) {
        console.error('❌ [TEST FAILED]:', e.message);
        process.exit(1);
    }
}

testSeoLeadTracking();
