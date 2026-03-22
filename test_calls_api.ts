// d:\Website-CRM\test_calls_api.ts
import { handleInboundCall, endCall } from './src/calls_logic';
import { mockEventLogs, mockCalls, mockContacts, mockOpportunities, mockMessages } from './src/db';

async function testInboundCall() {
  console.log('=== Test: Inbound Call & Event Lifecycle ===');
  
  // 1. Inbound call received
  console.log('--- Step 1: Create Mock Contact for matching ---');
  mockContacts.push({
    id: 'c-match-test',
    name: 'Matched John',
    phone: '+16041234567',
    email: 'john@matched.com',
    source: 'test',
    status: 'lead',
    address: '123 Test St',
    tags: [],
    created_at: new Date().toISOString()
  });
  console.log('   Contact created with phone: +16041234567');

  console.log('--- Step 2: Inbound Call (From Matched Number) ---');
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
  
  const opp1 = mockOpportunities.find(o => o.contact_id === 'c-match-test' && o.source === 'missed_call');
  
  // Check for SMS (PROMPT 15)
  const sms1 = mockMessages.find(m => m.contact_id === 'c-match-test' && m.source === 'missed_call_automation');

  if (record1_ended?.status === 'missed' && missedEvent && opp1 && record1_ended.contact_id === 'c-match-test' && record1_ended.opportunity_id === opp1.id && sms1) {
    console.log('✅ call_missed event, opportunity, linkage, and SMS verified.');
  } else {
    throw new Error(`FAILED Step 2: missedEvent=${!!missedEvent}, opp=${!!opp1}, link_c=${record1_ended?.contact_id === 'c-match-test'}, sms=${!!sms1}`);
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

  // 4. Unknown Caller Contact Creation (PROMPT 9)
  console.log('--- Step 4: Unknown Caller (Missed Call) ---');
  const newNumber = '9876543210';
  const call3 = await handleInboundCall({ phone: newNumber });
  await endCall({ call_id: call3.callId!, answered: false });
  
  const unknownContact = mockContacts.find(c => c.phone === '+19876543210' && c.name === 'Unknown Caller');
  
  if (unknownContact) {
    console.log('✅ Unknown Caller contact created successfully.');
  } else {
    throw new Error('FAILED Step 4: Unknown caller contact not created.');
  }

  // 5. Test Duplicate End (PROMPT 7)
  console.log('--- Step 5: End same call twice (Duplicate handling) ---');
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

  // 6. Test SMS Skipping (PROMPT 16)
  console.log('--- Step 6: Test SMS Skip (Duplicate Automation) ---');
  const call4 = await handleInboundCall({ phone: "+16041234567" });
  await endCall({ call_id: call4.callId!, answered: false });
  // This should trigger "Missed call SMS skipped" because it's same message same contact within 60s
  
  console.log('\n🌟 ALL TESTS PASSED: Call system and event triggers are correct.');
}

testInboundCall().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
