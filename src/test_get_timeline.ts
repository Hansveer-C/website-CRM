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

  console.log('--- Step 1: Submit Form, Send SMS, and Trigger System Event (Mixed) ---');
  
  // Submit Form - T1
  await emitEvent('form_submitted', {
    contact_id: testContactId,
    opportunity_id: 'opp-123',
    source: 'website',
  });
  // Adjust timestamp manually as emitEvent uses Date.now()
  mockEventLogs[mockEventLogs.length-1].created_at = t1;

  // Send SMS - T3
  await sendMessageToContact(testContactId, 'Hello (later)', 'test-env');
  mockMessages[mockMessages.length-1].created_at = t3;

  // Another System Event - T2
  await emitEvent('status_updated', {
    contact_id: testContactId,
    old_status: 'lead',
    new_status: 'customer'
  });
  mockEventLogs[mockEventLogs.length-1].created_at = t2;

  console.log('--- Step 2: Call helper ---');
  const timeline = getContactTimeline(testContactId);

  console.log('--- Step 3: Confirm chronological order (ASC) ---');
  timeline.forEach((item, index) => {
    console.log(`${index + 1}. [${item.created_at}] TYPE: ${item.type} | CONTENT: ${item.content}`);
  });

  const isSorted = timeline.every((item, i, arr) => {
    if (i === 0) return true;
    return new Date(item.created_at).getTime() >= new Date(arr[i-1].created_at).getTime();
  });

  if (isSorted && timeline.length === 3) {
    console.log('✅ SUCCESS: Timeline is correctly sorted chronologically (Oldest to Newest).');
  } else {
    console.error('❌ FAILURE: Incorrect ordering detected.');
    process.exit(1);
  }
}

testTimeline().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
