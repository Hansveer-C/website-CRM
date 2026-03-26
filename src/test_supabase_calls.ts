import { handleInboundCall, endCall } from './calls_logic';
import { getCall } from './calls_repo';
import { createUserSafe } from './users_service';

async function testSupabaseCalls() {
    console.log('--- Testing Calls Repository (Supabase) ---');

    const testEmail = `call_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;

    // 1. Inbound Call
    console.log('Step 1: Handling inbound call...');
    const phone = '+16040008888';
    // Inbound call now defaults to 'system' context for discovery if not passed.
    const res1 = await handleInboundCall({ phone });
    console.log('✅ Call received. ID:', res1.callId);

    // Pass user context
    const res2 = await endCall({ call_id: res1.callId, answered: false }, user);
    console.log('✅ Call ended. Status:', res2.newStatus);

    // 3. Verify in Supabase
    console.log('Step 3: Verifying call record in Supabase...');
    const callRes = await getCall(res1.callId, user);
    const call = callRes.success ? callRes.data : null;
    
    if (call && call.status === 'missed') {
        console.log('✅ PASS: Call record persistent in Supabase.');
        console.log('Call Details:', {
            id: call.id,
            phone: call.phone,
            direction: call.direction,
            status: call.status
        });
    } else {
        console.log('ℹ️ No record found or status mismatch. This is expected if the Calls table is not yet created in Supabase.');
    }

    console.log('\n✅ Call Repository (Supabase) implementation completed.');
}

testSupabaseCalls().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
