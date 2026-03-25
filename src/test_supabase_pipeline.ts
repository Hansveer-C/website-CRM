import { createUserSafe } from './users_service';
import { createLeadApi } from './crm_api';
import { getOpportunitiesApi } from './opportunities_api';
import { ApiRequest } from './types';
import { createSessionToken } from './session_utils';

async function testSupabasePipeline() {
    console.log('--- Testing Pipeline Flow (Supabase) ---');

    const testEmail = `pipeline_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;
    const sessionToken = createSessionToken(user);

    // Mock request with session cookie
    const req: ApiRequest = { 
        cookies: { 'session': sessionToken },

        body: {
            name: 'Pipeline Lead',
            phone: '555-7777',
            email: 'lead@pipeline.com',
            source: 'test-pipeline'
        }
    };



    // 1. Submit Lead
    console.log('Step 1: Submitting lead via createLeadApi...');
    const leadRes = await createLeadApi(req) as any;
    
    if (leadRes.status === 201) {
        console.log('✅ Lead submission SUCCEEDED.');
        console.log('Lead Result:', leadRes.data);
    } else {
        console.error('❌ Lead submission FAILED:', leadRes.error);
        process.exit(1);
    }

    // 2. Fetch Pipeline (Opportunities)
    console.log('Step 2: Fetching pipeline via getOpportunitiesApi...');
    const pipelineRes = await getOpportunitiesApi({ user } as any) as any;
    
    if (pipelineRes.status === 200) {
        const opps = pipelineRes.data;
        const newOpp = opps.find((o: any) => o.id === leadRes.data.opportunityId);
        
        if (newOpp) {
            console.log('✅ PASS: Opportunity visible in pipeline.');
            console.log('Verification Details:', {
                id: newOpp.id,
                contact_id: newOpp.contact_id,
                stage: newOpp.pipeline_stage,
                status: newOpp.status
            });

            if (newOpp.pipeline_stage === 'New Lead') {
                console.log('✅ PASS: Correct initial stage (New Lead).');
            } else {
                console.error('❌ FAIL: Incorrect pipeline stage.', newOpp.pipeline_stage);
                process.exit(1);
            }

            if (newOpp.contact_id === leadRes.data.contactId) {
                console.log('✅ PASS: Correct contact linkage.');
            } else {
                console.error('❌ FAIL: Contact linkage mismatch.');
                process.exit(1);
            }
        } else {
            console.error('❌ FAIL: Opportunity not found in pipeline list.');
            process.exit(1);
        }
    } else {
        console.error('❌ Pipeline fetch FAILED:', pipelineRes.error);
        process.exit(1);
    }

    console.log('\n✅ ALL Pipeline tests PASSED.');
}

testSupabasePipeline().catch(err => {
    console.error('❌ Pipeline test crashed:', err);
    process.exit(1);
});
