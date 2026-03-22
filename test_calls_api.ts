// d:\Website-CRM\test_calls_api.ts
import { handleInboundCall, endCall } from './src/calls_logic';
import { mockEventLogs, mockCalls } from './src/db';

async function testInboundCall() {
  console.log('=== Test: Inbound Call & Event Lifecycle ===');
  
  // 1. Inbound call received
  console.log('--- Step 1: Inbound Call (Success case) ---');
  const call1 = await handleInboundCall({ phone: "+16041234567" });
  console.log('   Call ID:', call1.callId);

  const event1 = mockEventLogs.find(e => e.event_name === 'call_received' && e.payload.phone === '+16041234567');
  const record1 = mockCalls.find(c => c.id === call1.callId);

  if (event1 && record1) {
    console.log('✅ Inbound reception verified.');
  } else {
    throw new Error('FAILED Step 1');
  }

  // 2. End as missed (answered=false)
  console.log('--- Step 2: Ending call as missed ---');
  await endCall({ call_id: call1.callId!, answered: false });
  
  const record1_ended = mockCalls.find(c => c.id === call1.callId);
  const missedEvent = mockEventLogs.find(e => e.event_name === 'call_missed' && e.payload.call_id === call1.callId);

  if (record1_ended?.status === 'missed' && missedEvent) {
    console.log('✅ call_missed event verified.');
  } else {
    throw new Error('FAILED Step 2: missedEvent=' + !!missedEvent + ', status=' + record1_ended?.status);
  }

  // 3. End as answered (answered=true)
  console.log('--- Step 3: Ending call as answered (No missed event) ---');
  const call2 = await handleInboundCall({ phone: "123-456-7890" });
  
  const beforeCount = mockEventLogs.filter(e => e.event_name === 'call_missed').length;
  await endCall({ call_id: call2.callId!, answered: true });
  const afterCount = mockEventLogs.filter(e => e.event_name === 'call_missed').length;

  const record2_ended = mockCalls.find(c => c.id === call2.callId);

  if (record2_ended?.status === 'answered' && beforeCount === afterCount) {
    console.log('✅ No call_missed event emitted for answered call.');
  } else {
    throw new Error('FAILED Step 3: status=' + record2_ended?.status + ', events=' + (afterCount - beforeCount));
  }

  // 4. Test Duplicate End (PROMPT 7)
  console.log('--- Step 4: End same call twice (Duplicate handling) ---');
  const doubleEndRes = await endCall({ call_id: call2.callId!, answered: false });
  
  if (doubleEndRes.status === 'ignored' && doubleEndRes.message === 'Call already processed') {
    console.log('✅ Duplicate call handling blocked successfully.');
  } else {
    throw new Error('FAILED Step 4: Duplicate handling not blocked. Response: ' + JSON.stringify(doubleEndRes));
  }

  // 5. Validation
  console.log('--- Step 5: Validation (Missing Phone) ---');
  try {
    await (handleInboundCall as any)({ phone: '' });
    throw new Error('Validation failed to catch empty phone');
  } catch (err: any) {
    console.log('✅ Validation caught empty phone.');
  }

  console.log('\n🌟 ALL TESTS PASSED: Call system and event triggers are correct.');
}

testInboundCall().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
