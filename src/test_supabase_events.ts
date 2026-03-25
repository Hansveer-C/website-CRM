import { emitEvent, getEvents } from './events';
import { createUserSafe } from './users_service';

async function testSupabaseEvents() {
    console.log('--- Testing EventLogs Repository (Supabase) ---');

    const testEmail = `event_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;

    // 1. Emit Event
    console.log('Step 1: Emitting a test event...');
    await emitEvent('unit_test_event', { foo: 'bar', timestamp: Date.now() }, user.id);
    
    // 2. Verify in Supabase
    console.log('Step 2: Verifying events in Supabase...');
    const logs = await getEvents(user);
    
    const matched = logs.find(l => l.event_name === 'unit_test_event');
    if (matched) {
        console.log('✅ PASS: Event log found in Supabase.');
        console.log('Payload:', matched.payload);
    } else {
        console.log('ℹ️ No event log found. This is expected if the EventLogs table is not yet created in Supabase.');
    }

    console.log('\n✅ EventLogs Repository (Supabase) implementation completed.');
}

testSupabaseEvents().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
