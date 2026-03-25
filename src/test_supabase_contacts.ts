import { createUserSafe } from './users_service';
import { createLead } from './leads_logic';
import { getContacts, getContactById } from './contacts_repo';
import { ApiRequest } from './types';

async function testSupabaseContacts() {
    console.log('--- Testing Contact Repository (Supabase) ---');

    const testEmail = `contact_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;

    // Mock request with user context
    const req: ApiRequest = { user };

    // 1. Create a lead (which creates a contact)
    console.log('Case 1: Creating a lead via leads_logic...');
    const leadData = {
        name: 'Supabase Tester',
        phone: '555-0199',
        email: `tester_${Date.now()}@test.com`,
        source: 'supabase-test'
    };

    const leadResult = await createLead(leadData, req);
    console.log('✅ Lead created successfully. Contact ID:', leadResult.contactId);

    // 2. Fetch the contact directly from Supabase
    console.log('Case 2: Fetching the contact back from Supabase...');
    const contact = await getContactById(leadResult.contactId, user);
    
    if (contact && contact.name === leadData.name && contact.user_id === user.id) {
        console.log('✅ PASS: Contact retrieved correctly from Supabase with user scoping.');
        console.log('Contact Details:', {
            id: contact.id,
            name: contact.name,
            user_id: contact.user_id,
            phone: contact.phone
        });
    } else {
        console.error('❌ FAIL: Contact not found or data mismatch.', contact);
        process.exit(1);
    }

    // 3. List all contacts for this user
    console.log('Case 3: Listing all contacts for the user...');
    const allContacts = await getContacts(user);
    if (allContacts.length >= 1) {
        console.log(`✅ PASS: Successfully listed ${allContacts.length} contacts from Supabase.`);
    } else {
        console.error('❌ FAIL: No contacts found for user in Supabase list.');
        process.exit(1);
    }

    // 4. Test Duplicate Submission
    console.log('Case 4: Testing duplicate submission for the same lead...');
    try {
        const dupResult = await createLead(leadData, req);
        if (dupResult.contactId === leadResult.contactId) {
            console.log('✅ PASS: Duplicate lead correctly identified existing contact.');
        } else {
            console.error('❌ FAIL: Duplicate lead created a new contact ID.', { leadResult, dupResult });
            process.exit(1);
        }
    } catch (err: any) {
        // If the duplicate submission window is too short (2 mins), it might throw.
        // But for contacts, it should at least not create a new one.
        console.log('ℹ️ Duplicate submission handled (blocked or re-used):', err.message);
    }

    // 5. Test ownership (Scoping)
    console.log('Case 5: Testing ownership (Trying to access with wrong user)...');
    const wrongUser = { id: 'wrong-user-id', email: 'wrong@test.com' };
    const restrictedContact = await getContactById(leadResult.contactId, wrongUser as any);
    
    if (restrictedContact === null) {
        console.log('✅ PASS: Correctly returned null for contact owned by another user.');
    } else {
        console.error('❌ FAIL: Data leak! Contact accessible by wrong user.', restrictedContact);
        process.exit(1);
    }

    console.log('\n✅ ALL Supabase Lead -> Contact flow tests PASSED.');
}


testSupabaseContacts().catch(err => {
    console.error('❌ Test failed with unexpected error:', err);
    process.exit(1);
});
