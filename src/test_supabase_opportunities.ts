import { createUserSafe } from './users_service';
import { createContact } from './contacts_repo';
import { createOpportunity, getOpportunitiesByContact, getOpportunityById } from './opportunities_repo';
import { Contact, Opportunity } from './types';

async function testSupabaseOpportunities() {
    console.log('--- Testing Opportunity Repository (Supabase) ---');

    const testEmail = `opp_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;

    // 1. Create a dependent Contact first
    console.log('Step 1: Creating a contact in Supabase...');
    const contact: Contact = {
        id: `c-opp-${Date.now()}`,
        user_id: user.id,
        name: 'Opportunity Tester',
        phone: '555-9999',
        email: 'opp@tester.com',
        address: '123 Opp St',
        tags: [],
        source: 'test',
        status: 'lead',
        created_at: new Date().toISOString()
    };
    await createContact(contact);

    // 2. Create Opportunity
    console.log('Step 2: Creating an opportunity for the contact...');
    const opp: Opportunity = {
        id: `opp-${Date.now()}`,
        user_id: user.id,
        contact_id: contact.id,
        pipeline_stage: 'New Lead',
        status: 'open',
        value: 1500.00,
        source: 'web',
        notes: 'Initial high-value lead',
        created_at: new Date().toISOString()
    };

    const savedOpp = await createOpportunity(opp);
    console.log('✅ Opportunity created in Supabase. ID:', savedOpp.id);

    // 3. Fetch back
    console.log('Step 3: Fetching opportunities for the contact...');
    const opps = await getOpportunitiesByContact(contact.id, user);
    
    if (opps.length === 1 && opps[0].id === opp.id) {
        console.log('✅ PASS: Opportunity retrieved correctly from Supabase.');
        console.log('Opportunity Details:', {
            id: opps[0].id,
            stage: opps[0].pipeline_stage,
            value: opps[0].value
        });
    } else {
        console.error('❌ FAIL: Opportunity not found or mismatch.', opps);
        process.exit(1);
    }

    // 4. Test ownership
    console.log('Step 4: Testing ownership scoping...');
    const wrongUser = { id: 'wrong-user', email: 'wrong@test.com' };
    const restricted = await getOpportunityById(opp.id, wrongUser as any);
    
    if (restricted === null) {
        console.log('✅ PASS: Correctly blocked access for wrong user.');
    } else {
        console.error('❌ FAIL: Security Leak! Opportunity accessible by wrong user.');
        process.exit(1);
    }

    console.log('\n✅ ALL Supabase Opportunity tests PASSED.');
}

testSupabaseOpportunities().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
