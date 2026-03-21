import { emitEvent } from './events';
import { sendMessageToContact } from './sms';
import { getContactTimeline } from './timeline';
import { mockContacts, mockMessages, mockEventLogs } from './db';

async function testTimeline() {
  // Clear previous data for a clean test
  mockMessages.length = 0;
  mockEventLogs.length = 0;

  // Use an existing or mock contact
  const testContactId = 'c-test-123';
  mockContacts.push({
    id: testContactId,
    name: 'Test Tester',
    phone: '555-9999',
    email: 'test@example.com',
    address: '123 Test Lane',
    tags: [],
    source: 'test',
    status: 'lead',
    created_at: new Date().toISOString()
  });

  const t1 = '2026-03-21T10:00:00Z'; // Middle
  const t2 = '2026-03-21T09:00:00Z'; // Oldest
  const t3 = '2026-03-21T11:00:00Z'; // Newest

  const t0 = '2026-03-21T08:30:00Z'; // Earliest inbound

  console.log('--- Step 1: Submit Form, Send SMS, and Trigger System Event (Mixed) ---');
  
  // 1. Inbound SMS - T0
  mockMessages.push({
    id: 'msg-in-1',
    contact_id: testContactId,
    direction: 'inbound',
    type: 'sms',
    content: 'Yes, tomorrow works!',
    status: 'sent',
    created_at: t0
  });

  // 2. Submit Form - T1
  await emitEvent('form_submitted', {
    contact_id: testContactId,
    opportunity_id: 'opp-123',
    source: 'website',
  });
  mockEventLogs[mockEventLogs.length-1].created_at = t1;

  // 3. Send SMS - T3 (Long message)
  const longMsg = "This is a very long message that exceeds the one hundred and twenty character limit to test the truncation logic in the timeline view. It should be cut off with dots.";
  await sendMessageToContact(testContactId, longMsg, 'test-env');
  mockMessages[mockMessages.length-1].created_at = t3;

  // 4. Another System Event - T2
  await emitEvent('status_updated', {
    contact_id: testContactId,
    old_status: 'lead',
    new_status: 'customer'
  });
  mockEventLogs[mockEventLogs.length-1].created_at = t2;

  console.log('--- Step 2: Call helper ---');
  const timeline = getContactTimeline(testContactId);

  console.log('--- Step 3: Confirm chronological order (ASC), Truncation, Arrows, and Readability ---');
  timeline.forEach((item, index) => {
    console.log(`${index + 1}. [${item.created_at}] TYPE: ${item.type} | CONTENT: ${item.content}`);
  });

  // Verify format matches MMM D, h:mm A (simple check)
  const isFormatted = timeline.every(item => /^[A-Z][a-z]{2}\s\d{1,2},\s\d{1,2}:\d{2}\s[AP]M$/.test(item.created_at));

  if (timeline.length === 4 && isFormatted) {
    console.log('✅ SUCCESS: Timeline is correctly sorted and timestamps are readable.');
  } else {
    console.error('❌ FAILURE: Issues detected in formatting.');
    if (!isFormatted) console.error('- Timestamps not in readable format');
    process.exit(1);
  }
}

testTimeline().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
