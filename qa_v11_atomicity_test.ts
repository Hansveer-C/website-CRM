
import { createUserSafe } from './src/users_service';
import { createLead } from './src/leads_logic';
import { ContactsRepo } from './src/contacts_repo_supabase';
import { OpportunitiesRepo } from './src/opportunities_repo';
import { ApiRequest } from './src/types';
import { createSessionToken } from './src/session_utils';
import { saveMessage } from './src/messages';
import { MessagesRepo } from './src/messages_repo';

async function runAtomicityTest() {
    console.log("=== R11.1 Atomicity & Orphan Record Verification ===");

    // Setup User
    const userEmail = `atomicity_test_${Date.now()}@test.com`;
    const setup = await createUserSafe(userEmail, 'strong-password-123');
    const user = setup.user!;
    const token = createSessionToken(user);
    const req: ApiRequest = { user, cookies: { session: token } };

    // --- CASE 1: Orphaned Contact Detection (Simulation) ---
    console.log("\n[TEST] Case 1: Failure during Opportunity creation (Mid-Flow)...");
    
    // Monkey-patch OpportunitiesRepo to simulate failure
    const originalPersistOpp = OpportunitiesRepo.createOpportunity;
    OpportunitiesRepo.createOpportunity = async () => {
        console.log("   [SIMULATION] Mocking DB failure during opportunity persistence...");
        return { success: false, error: 'SIMULATED_FAILURE' };
    };

    const leadData = {
        name: 'Orphan Tester',
        phone: '555-999-0000',
        email: 'orphan@test.com',
        source: 'atomicity-test'
    };

    try {
        console.log("Calling createLead...");
        await createLead(leadData, req);
        console.error("❌ FAIL: createLead should have thrown an error but didn't.");
    } catch (err: any) {
        console.log(`✅ PASS: createLead correctly threw error: ${err.message}`);
    }

    // Restore original method
    OpportunitiesRepo.createOpportunity = originalPersistOpp;

    // Check for "Orphaned" Contact
    console.log("Verifying if contact was left orphaned in DB...");
    const contacts = await ContactsRepo.getAllContacts(user);
    const orphanedContact = contacts.find(c => c.name === leadData.name);

    if (orphanedContact) {
        console.warn("⚠️ OBSERVED: Contact was created despite downstream failure. This record is currently ORPHANED (no opportunity).");
        console.log("Contact ID:", orphanedContact.id);
        
        // Verify no opportunity exists for this contact
        const oppsRes = await OpportunitiesRepo.getOpportunitiesByContact(orphanedContact.id, user);
        if (oppsRes.success && (!oppsRes.data || oppsRes.data.length === 0)) {
            console.log("✅ CONFIRMED: No associated opportunity found. Record is an orphan.");
        } else {
            console.error("❌ ERROR: Unexpected data state. Some opportunities found?", oppsRes.data);
        }
    } else {
        console.log("✅ PASS: No orphaned contact found (Rollback logic likely working or contact never saved).");
    }

    // --- CASE 2: Message without Contact ---
    console.log("\n[TEST] Case 2: Attempting to create message for non-existent contact...");
    const fakeContactId = `missing-${Date.now()}`;
    const messageRes = await saveMessage({
        contact_id: fakeContactId,
        content: "Hello from nowhere",
        user_id: user.id
    });

    if (messageRes === false) {
        console.log("✅ PASS: saveMessage correctly rejected message for missing contact.");
    } else {
        console.error("❌ FAIL: saveMessage allowed creation for unknown contact!");
    }

    // Verify no message was actually saved
    const messages = await MessagesRepo.getAllMessagesOrdered(user);
    const orphanMsg = messages.data?.find(m => m.contact_id === fakeContactId);
    if (orphanMsg) {
        console.error("❌ FAIL: Found message record for missing contact ID:", fakeContactId);
    } else {
        console.log("✅ PASS: No orphaned message record found in DB.");
    }

    console.log("\n=== Atomicity Test Complete ===");
}

runAtomicityTest().catch(console.error);
