
import { getContacts } from './contacts_api';
import { getContactApi, getContactTimelineApi, createLeadApi } from './crm_api';
import { sendMessageApi } from './messages_api';
import { handleInboundCallApi, endCallApi } from './calls_api';
import { createSessionToken } from './session_utils';

async function runVerification() {
    console.log("=== R8.17 API Boundary Verification ===");

    // Generate a valid token for the internal system user
    const token = createSessionToken({ id: 'system', email: 'system@internal.crm' });
    const mockCookies = { session: token };
    
    // Self-test decoding
    const { decodeSessionToken } = await import('./session_utils');
    const decoded = decodeSessionToken(token);
    console.log("[DEBUG] Test Token Decoded:", decoded);

    const mockUserReq: any = { 
        method: 'GET', 
        url: '/api/contacts', 
        cookies: mockCookies
    };

    // 1. Contacts List
    console.log("\n[TEST] GET /api/contacts");
    const contactsRes: any = await getContacts(mockUserReq);
    console.log("Status:", contactsRes.status);
    console.log("Contacts count:", contactsRes.data?.length || 0);

    // 2. Contact Detail
    console.log("\n[TEST] GET /api/contacts/c2");
    const contactReq = { ...mockUserReq, url: '/api/contacts/c2' };
    const contactRes: any = await getContactApi(contactReq, 'c2');
    console.log("Status:", contactRes.status);
    console.log("Name:", contactRes.data?.name);

    // 3. Contact Timeline
    console.log("\n[TEST] GET /api/contacts/c2/timeline");
    const timelineReq = { ...mockUserReq, url: '/api/contacts/c2/timeline' };
    const timelineRes: any = await getContactTimelineApi(timelineReq, 'c2');
    console.log("Status:", timelineRes.status);
    console.log("Events count:", timelineRes.data?.length || 0);

    // 4. Lead Creation
    console.log("\n[TEST] POST /api/leads");
    const leadRes: any = await createLeadApi({
        method: 'POST',
        url: '/api/leads',
        cookies: mockCookies,
        body: {
            name: 'API Test Lead',
            phone: '+15550001234',
            email: 'api-test@example.com',
            source: 'website'
        }
    } as any);
    console.log("Status:", leadRes.status);
    console.log("Created Contact ID:", leadRes.data?.contactId);

    // 5. Inbound Call
    console.log("\n[TEST] POST /api/calls/inbound");
    const callRes: any = await handleInboundCallApi({
        method: 'POST',
        url: '/api/calls/inbound',
        cookies: mockCookies,
        body: { phone: '+15550100000' }
    } as any);
    console.log("Status:", callRes.status);
    console.log("Call ID:", callRes.data?.callId);

    // 6. Manual Text
    const contactId = leadRes.data?.contactId || 'c2';
    console.log(`\n[TEST] POST /api/messages/send (Target: ${contactId})`);
    const messageRes: any = await sendMessageApi({
        method: 'POST',
        url: '/api/messages/send',
        cookies: mockCookies,
        body: {
            contact_id: contactId,
            message: 'Hello from API Boundary Test',
            source: 'manual'
        }
    } as any);
    console.log("Status:", messageRes.status);
    console.log("Success:", messageRes.data?.success);

    console.log("\n=== Verification Complete ===");
}

runVerification().catch(err => {
    console.error("Verification Failed:", err);
    process.exit(1);
});
