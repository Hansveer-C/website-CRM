
import { getContacts } from './contacts_api';
import { getContactApi, getContactTimelineApi, createLeadApi } from './crm_api';
import { createSessionToken } from './session_utils';

async function runIsolationTest() {
    console.log("=== R8.19 Multi-User Isolation Validation ===");

    // Identities (Using real IDs from DB for session resolution)
    const userA = { id: 'a33f624e-8744-4262-9694-26d287506144', email: 'user_a@test.com' };
    const userB = { id: 'd09e05eb-e06d-46d1-a927-f2744f9870ac', email: 'user_b@test.com' };

    const tokenA = createSessionToken(userA);
    const tokenB = createSessionToken(userB);

    const reqA: any = { method: 'POST', cookies: { session: tokenA } };
    const reqB: any = { method: 'GET', cookies: { session: tokenB } };

    // 1. User A creates a lead
    console.log("\n[ACTION] User A creates a lead...");
    const leadRes: any = await createLeadApi({
        ...reqA,
        url: '/api/leads',
        body: {
            name: 'Isolation Test Lead',
            phone: '+15559998888',
            email: 'isolation@example.com',
            source: 'test'
        }
    });
    
    const contactId = leadRes.data?.contactId;
    console.log("Created Contact ID (User A):", contactId);

    // 2. User B lists contacts
    console.log("\n[VERIFY] User B lists contacts...");
    const contactsRes: any = await getContacts({ ...reqB, url: '/api/contacts' });
    const found = contactsRes.data?.find((c: any) => c.id === contactId);
    if (found) {
        console.error("❌ FAILURE: User B can see User A's contact in the list!");
    } else {
        console.log("✅ SUCCESS: User A's contact is hidden from User B's list.");
    }

    // 3. User B attempts direct access to ID
    console.log(`\n[VERIFY] User B attempts direct access to ID: ${contactId}...`);
    const directRes: any = await getContactApi({ ...reqB, url: `/api/contacts/${contactId}` }, contactId);
    if (directRes.status === 200) {
        console.error("❌ FAILURE: User B accessed User A's contact record!");
    } else {
        console.log(`✅ SUCCESS: Access denied (Status: ${directRes.status}). Message: ${directRes.error}`);
    }

    // 4. User B attempts timeline access
    console.log(`\n[VERIFY] User B attempts timeline access for: ${contactId}...`);
    const timelineRes: any = await getContactTimelineApi({ ...reqB, url: `/api/contacts/${contactId}/timeline` }, contactId);
    if (timelineRes.status === 200) {
        console.error("❌ FAILURE: User B accessed User A's timeline!");
    } else {
        console.log(`✅ SUCCESS: Access denied (Status: ${timelineRes.status}). Message: ${timelineRes.error}`);
    }

    console.log("\n=== Isolation Validation Complete ===");
}

runIsolationTest().catch(err => {
    console.error("Isolation Test Failed:", err);
    process.exit(1);
});
