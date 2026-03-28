import 'dotenv/config';
import { WebsiteGeneratorService } from './website_generator_service';
import { WebsitesRepo } from './websites_repo_supabase';
import { SectionsRepo } from './sections_repo_supabase';

async function testSeoFunnelGeneration() {
    console.log('--- Testing High-Intent SEO Funnel Generation (PROMPT W3.3) ---');

    const userId = 'system';
    const testService = 'Roof Cleaning';
    const testCity = 'Maple Ridge';

    try {
        // 1. Get or create website
        let website = await WebsitesRepo.getWebsiteByUser(userId);
        if (!website) {
            website = await WebsitesRepo.createWebsite(userId, 'SEO Funnel Test');
        }

        // 2. Generate SEO Funnel
        console.log(`[TEST] Creating SEO funnel for ${testService} in ${testCity}...`);
        const result = await WebsiteGeneratorService.generateSeoFunnel(userId, website.id, testService, testCity);

        console.log('✅ Funnel generated:', result.funnel_id);
        console.log('✅ Route created:', result.path);

        // 3. Verify content hydration
        if (!result.page_id) throw new Error('NO_PAGE_ID_IN_RESULT');
        
        const sectionsRes = await SectionsRepo.getSectionsForPage(result.page_id, userId);
        const sections: any[] = (sectionsRes as any).data || [];

        console.log(`[TEST] Verifying ${sections.length} sections...`);

        // Check Hero
        const hero = sections.find(s => s.type === 'hero');
        if (!hero) throw new Error('HERO_SECTION_NOT_FOUND');
        
        const expectedHeadline = `${testService} in ${testCity}`;
        if (hero.content.headline !== expectedHeadline) {
            throw new Error(`HERO_HYDRATION_FAILED: Expected "${expectedHeadline}", Got "${hero.content.headline}"`);
        }
        console.log('✅ Hero hydration correct.');

        // Check Subtext
        const expectedSubtext = `Professional ${testService} with fast turnaround`;
        if (hero.content.subtext !== expectedSubtext) {
             throw new Error(`SUBTEXT_HYDRATION_FAILED: Expected "${expectedSubtext}", Got "${hero.content.subtext}"`);
        }
        console.log('✅ Subtext hydration correct.');

        // Check FAQ
        const faq = sections.find(s => s.type === 'faq');
        if (!faq) throw new Error('FAQ_SECTION_NOT_FOUND');
        const firstQuestion = faq.content.items[0].question;
        if (!firstQuestion.includes(testService) || !firstQuestion.includes(testCity)) {
            throw new Error(`FAQ_HYDRATION_FAILED: Got "${firstQuestion}"`);
        }
        console.log('✅ FAQ hydration correct.');

        console.log('\n✨ SEO Funnel generation test PASSED.');

    } catch (e: any) {
        console.error('❌ [TEST FAILED]:', e.message);
        process.exit(1);
    }
}

testSeoFunnelGeneration();
