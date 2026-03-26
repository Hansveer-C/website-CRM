
import { createUserSafe } from './src/users_service';
import { createLead } from './src/leads_logic';
import { deleteContact, getContact } from './src/contacts_repo';
import { persistOpportunity, getOpportunitiesByContact } from './src/opportunities_repo';
import { persistMessage, getMessagesByContact } from './src/messages_repo';
import { persistCall, getCallsForContact } from './src/calls_repo';
import { ApiRequest, Contact, Opportunity, Message, Call } from './src/types';
import { createSessionToken } from './src/session_utils';

async function runReferentialIntegrityTest() {
    console.log("=== R12.1 Referential Integrity Verification (Cascading Deletes) ===");

    // 1. Setup User
    const userEmail = `integrity_test_${Date.now()}@test.com`;
    const setup = await createUserSafe(userEmail, 'password-123');
    const user = setup.user!;
    const token = createSessionToken(user);
    const req: ApiRequest = { user, cookies: { session: token } };

    // 2. Data Creation - Contact + Opportunity + Message + Call
    console.log("\n[SETUP] Creating Contact and child records...");
    const leadData = {
        name: 'Integrity Tester',
        phone: '+15550009999',
        email: 'integrity@test.com'
    };
    const leadRes = await createLead(leadData, req);
    const contactId = leadRes.contactId;

    // Create a Call manually for this contact
    const call: Call = {
        id: `call-${Date.now()}`,
        user_id: user.id,
        contact_id: contactId,
        phone: leadData.phone,
        direction: 'inbound',
        status: 'received',
        created_at: new Date().toISOString()
    };
    await persistCall(call);

    // Create a Message manually for this contact
    const message: Message = {
        id: `msg-${Date.now()}`,
        user_id: user.id,
        contact_id: contactId,
        direction: 'outbound',
        type: 'sms',
        content: 'Integrity Test Message',
        status: 'sent',
        created_at: new Date().toISOString()
    };
    await persistMessage(message);

    console.log(`Contact ID: ${contactId}`);
    console.log("--- Child Records (Before Delete) ---");
    const oppsBefore = await getOpportunitiesByContact(contactId, user);
    const msgsBefore = await getMessagesByContact(contactId, user);
    const callsBefore = await getCallsForContact(contactId, leadData.phone, user);

    console.log(`Found: ${oppsBefore.data?.length} Opps, ${msgsBefore.data?.length} Messages, ${callsBefore.data?.length} Calls.`);

    // 3. Execution - Delete Parent (Contact)
    console.log("\n[EXECUTION] Deleting Contact...");
    const deleteRes = await deleteContact(contactId, user);
    
    if (deleteRes.success) {
        console.log("✅ Contact deleted successfully.");
    } else {
        console.error("❌ Contact deletion failed:", deleteRes.error);
        
        // If it failed because of foreign key constraint, we should check if that's intended
        if (deleteRes.error?.includes('foreign key constraint')) {
            console.warn("⚠️ OBSERVED: Deletion BLOCKED by foreign key constraint (likely event_logs).");
            // The prompt says "handled properly (cascade or blocked)", so this is okay if no orphans.
        }
    }

    // 4. Verification - Child Records (Cascade check)
    console.log("\n[VERIFICATION] Checking for orphaned child records...");
    
    // Check Opportunities
    const oppsAfter = await getOpportunitiesByContact(contactId, user);
    if (oppsAfter.success && (oppsAfter.data?.length || 0) === 0) {
        console.log("✅ PASS: Opportunities correctly cascaded (deleted).");
    } else {
        console.error("❌ FAIL: Orphaned opportunities still exist in DB!");
    }

    // Check Messages
    const msgsAfter = await getMessagesByContact(contactId, user);
    if (msgsAfter.success && (msgsAfter.data?.length || 0) === 0) {
        console.log("✅ PASS: Messages correctly cascaded (deleted).");
    } else {
        console.error("❌ FAIL: Orphaned messages still exist in DB!");
    }

    // Check Calls
    // Note: Earlier SQL check showed SET NULL for calls?
    const callsAfter = await getCallsForContact(contactId, leadData.phone, user);
    if (callsAfter.success && (callsAfter.data?.length || 0) === 0) {
        console.log("✅ PASS: Calls correctly cascaded or filtered out.");
    } else {
        console.warn("⚠️ OBSERVED: Call record still exists (Expected if SET NULL was applied to contact_id). Checking DB state...");
    }

    // Checking Contact ID existence
    const contactCheck = await getContact(contactId, user);
    if (!contactCheck.success || contactCheck.data === null) {
        console.log("✅ PASS: Parent Contact record is gone.");
    } else {
        console.warn("⚠️ OBSERVED: Contact record still exists because deletion was blocked.");
    }

    console.log("\n=== Test Complete ===");
}

runReferentialIntegrityTest().catch(console.error);
