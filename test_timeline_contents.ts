// d:\Website-CRM\test_timeline_contents.ts
import { handleInboundCall, endCall } from './src/calls_logic';
import { getContactTimeline } from './src/timeline';
import { mockContacts, mockCalls, mockEventLogs } from './src/db';

async function testTimelineContents() {
  console.log('=== Test: Timeline Contents (Messages, Form, Calls) ===');
  
  const phone = '+17778889999';
  
  // 1. Trigger Missed Call
  console.log('--- Step 1: Trigger Missed Call ---');
  const call = await handleInboundCall({ phone });
  await endCall({ call_id: call.callId!, answered: false });
  
  // 2. Resolve Contact ID
  const contact = mockContacts.find(c => c.phone === phone);
  if (!contact) throw new Error('Contact not created for missed call');
  
  const timeline = getContactTimeline(contact.id);
  
  // 3. Find Call items in timeline
  const callItems = timeline.flatMap(g => g.items).filter(i => 
    i.content.includes('Inbound call: MISSED') || i.content.includes('📞 Inbound call')
  );

  console.log(`[TEST] Call items found: ${callItems.length}`);
  callItems.forEach(i => console.log(` - ${i.content} (${i.created_at})`));

  if (callItems.length >= 1) {
    console.log('✅ PASS: Calls appear in timeline.');
  } else {
    console.error('❌ FAIL: Calls missing from timeline.');
    process.exit(1);
  }
}

testTimelineContents().catch(e => {
  console.error(e);
  process.exit(1);
});
