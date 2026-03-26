import { createUser, getUserByEmail } from './src/users_repo';
import { createSessionToken } from './src/session_utils';
import { createLeadApi, getContactApi, getContactTimelineApi } from './src/crm_api';
import { sendMessageApi, retryMessageApi } from './src/messages_api';
import { MessagesRepo } from './src/messages_repo';
import { supabase } from './src/utils/db/supabase';

async function runIsolationBreakTest() {
    console.log("=== Multi-Tenant Isolation Breakage Attempt ===");

    // 1. Setup Users
    const uniqueSuffix = Date.now().toString().slice(-4);
    const emailA = `user_a_isolation_${uniqueSuffix}@test.com`;
    const emailB = `user_b_isolation_${uniqueSuffix}@test.com`;
    const password = 'Password123!';

    console.log(`[SETUP] Creating/Fetching User A: ${emailA}`);
    let userA = await createUser(emailA, password);
    
    console.log(`[SETUP] Creating/Fetching User B: ${emailB}`);
    let userB = await createUser(emailB, password);

    const tokenA = createSessionToken(userA);
    const tokenB = createSessionToken(userB);

    const reqA: any = { method: 'POST', cookies: { session: tokenA }, body: {}, user: userA };
    const reqB: any = { method: 'GET', cookies: { session: tokenB }, body: {}, user: userB };

    // 2. User A creates data
    console.log("\n[SETUP] User A creating contact & opportunity...");
    const leadRes: any = await createLeadApi({
        ...reqA,
        url: '/api/leads',
        body: {
            name: `Target Contact A ${uniqueSuffix}`,
            phone: `+1555000${uniqueSuffix}`, 
            email: `target_${uniqueSuffix}@a.com`,
            source: 'isolation-test'
        }
    });

    if (leadRes.status !== 201) {
        console.error("❌ Setup Failed: Could not create lead for User A.", leadRes);
        process.exit(1);
    }

    const contactId = leadRes.data?.contactId;
    const opportunityId = leadRes.data?.opportunityId;
    console.log(`[SETUP] IDs created: Contact: ${contactId}, Opportunity: ${opportunityId}`);

    // Verify contact ownership
    const contactRes = await getContactApi({...reqA, url: `/api/contacts/${contactId}`}, contactId);
    console.log(`[SETUP] Contact Owner ID from API: ${contactRes.data?.user_id}`);
    console.log(`[SETUP] User A ID: ${userA.id}`);

    console.log("\n[SETUP] User A attempt to send a message...");
    const msgApiRes: any = await sendMessageApi({
        ...reqA,
        url: '/api/messages/send',
        body: {
            contact_id: contactId,
            message: 'Hello secure world!',
            source: 'test'
        }
    });
    console.log(`[SETUP] sendMessageApi Status: ${msgApiRes.status}`);

    // Small delay for DB consistency (Supabase is usually fast, but just in case)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch the message ID as User A (legitimately)
    console.log(`[SETUP] Fetching messages for contact ${contactId} as User A (${userA.id})...`);
    const msgsRes = await MessagesRepo.getMessagesByContact(contactId, userA);
    if (!msgsRes.success) {
        console.error(`❌ Setup Failed: Could not retrieve messages for contact: ${msgsRes.error}`);
        process.exit(1);
    }

    const messageId = msgsRes.data && msgsRes.data.length > 0 ? msgsRes.data[0].id : null;
    
    if (!messageId) {
        console.error("❌ Setup Failed: Could not find any messages for contact in DB.", msgsRes.data);
        // Try searching without contact ID to see if it even exist for user
        const allMsgs = await MessagesRepo.getAllMessagesOrdered(userA);
        console.log("[DEBUG] All messages for User A:", allMsgs.data);
        process.exit(1);
    }
    console.log(`[SETUP] Message ID found in DB: ${messageId}`);

    // 3. User B attempts access
    console.log("\n--- ATTACK PHASE (Logged in as User B) ---");

    // Attack 1: Fetch Contact A by ID
    console.log(`[ATTACK 1] Attempting to fetch Contact A (${contactId}) as User B...`);
    const attack1: any = await getContactApi({ ...reqB, url: `/api/contacts/${contactId}` }, contactId);
    if (attack1.status === 200) {
        console.error("❌ FAIL: User B accessed User A's contact record!");
    } else {
        console.log(`✅ PASS: Access denied. (Status: ${attack1.status}, Error: ${attack1.error})`);
    }

    // Attack 2: Attempt to update message status (using retryMessageApi as User B)
    console.log(`[ATTACK 2] Attempting to update/retry Message A (${messageId}) as User B...`);
    // Note: retryMessageApi checks getMessage(id, user_id)
    const attack2: any = await retryMessageApi({ ...reqB, method: 'POST', url: `/api/messages/${messageId}/retry` }, messageId);
    if (attack2.status === 200) {
        console.error("❌ FAIL: User B successfully triggered a retry on User A's message!");
    } else {
        console.log(`✅ PASS: Access denied. (Status: ${attack2.status}, Error: ${attack2.error})`);
    }

    // Attack 3: Fetch Timeline of Contact A as User B
    console.log(`[ATTACK 3] Attempting to fetch timeline of Contact A (${contactId}) as User B...`);
    const attack3: any = await getContactTimelineApi({ ...reqB, url: `/api/contacts/${contactId}/timeline` }, contactId);
    if (attack3.status === 200) {
        console.error("❌ FAIL: User B accessed User A's contact timeline!");
    } else {
        console.log(`✅ PASS: Access denied. (Status: ${attack3.status}, Error: ${attack3.error})`);
    }

    console.log("\n=== Final Integrity Result ===");
    const allPassed = (attack1.status === 404 || attack1.status === 401) 
                   && (attack2.status === 500 || attack2.status === 404 || attack2.status === 401)
                   && (attack3.status === 404 || attack3.status === 401);
    
    if (allPassed) {
        console.log("✅ ALL ISOLATION CHECKS PASSED. SYSTEM IS SECURE.");
    } else {
        console.error("❌ SECURITY BREACH DETECTED: UNPROTECTED RESOURCE ACCESS.");
        process.exit(1);
    }
}

runIsolationBreakTest().catch(err => {
    console.error("Test Crash:", err.message);
    process.exit(1);
});
