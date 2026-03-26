
import { createUserSafe } from './src/users_service';
import { createLeadApi, getContactApi } from './src/crm_api';
import { handleInboundCallApi, endCallApi } from './src/calls_api';
import { retryMessageApi } from './src/messages_api';
import { createSessionToken } from './src/session_utils';
import { ApiRequest, User } from './src/types';
import { ContactsRepo } from './src/contacts_repo_supabase';
import { MessagesRepo } from './src/messages_repo';
import { CallsRepo } from './src/calls_repo';

async function runIsolationUpdateTest() {
    console.log("=== R10.1 Multi-Tenant Isolation - Update/Delete Paths ===");

    // 1. Setup - Create User A and User B
    const userAEmail = `user_a_update_${Date.now()}@test.com`;
    const userBEmail = `user_b_update_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up User A (${userAEmail})...`);
    const setupA = await createUserSafe(userAEmail, password);
    const userA = setupA.user!;
    const tokenA = createSessionToken(userA);

    console.log(`Setting up User B (${userBEmail})...`);
    const setupB = await createUserSafe(userBEmail, password);
    const userB = setupB.user!;
    const tokenB = createSessionToken(userB);

    // 2. User A Data - Create Contact and Call
    console.log("\n[SETUP] User A creates data...");
    const leadRes: any = await createLeadApi({
        method: 'POST',
        url: '/api/leads',
        cookies: { session: tokenA },
        body: { name: "User A Contact", phone: "+15550000001", source: "A-Source" }
    } as any);
    const contactIdA = leadRes.data.contactId;

    const callRes: any = await handleInboundCallApi({
        method: 'POST',
        url: '/api/calls/inbound',
        cookies: { session: tokenA },
        body: { phone: "+15550000001" }
    } as any);
    const callIdA = callRes.data.callId;

    console.log(`User A Contact ID: ${contactIdA}`);
    console.log(`User A Call ID: ${callIdA}`);

    // --- CASE 1: Attempt to Update Call as User B (VULNERABLE PATH - endCallApi) ---
    console.log("\n[ATTACK] Case 1: User B calls endCallApi on User A's call...");
    const attack1: any = await endCallApi({
        method: 'POST',
        url: '/api/calls/end',
        cookies: { session: tokenB },
        body: { call_id: callIdA, answered: true }
    } as any);

    console.log("Result Status:", attack1.status);
    if (attack1.status === 200 || attack1.status === 'updated') {
        console.error("❌ FAIL: User B successfully updated User A's call status via endCallApi!");
    } else {
        console.log("✅ PASS: Operation rejected.");
    }

    // --- CASE 2: Attempt to Retry Message as User B (PROTECTED PATH - retryMessageApi) ---
    // First, let's find a message ID for User A. 
    // Usually messages are created on leads or via manual send. 
    // There is a message created on lead creation (auto SMS).
    const timelineResA: any = await getContactApi({ cookies: { session: tokenA } } as any, contactIdA);
    // Let's grab all messages for A's contact
    const messagesA = await MessagesRepo.getMessagesByContact(contactIdA, userA);
    const messageIdA = messagesA.data?.[0]?.id || 'unknown';

    console.log(`\n[ATTACK] Case 2: User B calls retryMessageApi on User A's message (${messageIdA})...`);
    const attack2: any = await retryMessageApi({
        method: 'POST',
        cookies: { session: tokenB }
    } as any, messageIdA);

    console.log("Result Status:", attack2.status);
    if (attack2.status === 200) {
        console.error("❌ FAIL: User B successfuly retried User A's message via retryMessageApi!");
    } else {
        console.log("✅ PASS: Access denied.");
    }

    // --- CASE 3: Attempt to Update Contact via Upsert as User B (MISSING ENDPOINT but in REPO) ---
    console.log("\n[ATTACK] Case 3: User B attempts to overwrite User A's contact using Repo Upsert...");
    // Simulating what a hypothetical UpdateContactApi would do if it didn't check user_id
    const attackPayload = {
        id: contactIdA,
        user_id: userB.id,
        name: "HACKED BY USER B",
        status: "lost" as any
    };

    try {
        console.log("Calling ContactsRepo.persistContact (as User B)...");
        // This simulates a common vulnerability where the repo layer assumes the pass-in user_id context 
        // is enough for the SAFE_DB_CALL, but doesn't check the record ownership on update.
        await ContactsRepo.persistContact(attackPayload as any);
        
        // Verify if it changed for User A
        const verifyA = await ContactsRepo.getContact(contactIdA, userA);
        if (verifyA && verifyA.name === attackPayload.name) {
            console.error("❌ FAIL: Repo allowed overwriting another user's record via upsert!");
        } else {
            console.log("✅ PASS: Logic check - Repo did not overwrite (or we need to check how it failed).");
        }
    } catch (err: any) {
        console.log("✅ PASS: Operation blocked at repo level:", err.message);
    }

    console.log("\n=== Test Complete ===");
}

runIsolationUpdateTest().catch(console.error);
