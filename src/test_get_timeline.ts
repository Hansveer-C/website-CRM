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

  const t_today = '2026-03-21T10:00:00Z';
  const t_yesterday = '2026-03-20T10:00:00Z';
  const t_earlier = '2026-03-15T10:00:00Z';

  const t0 = t_earlier; 
  const t1 = t_today;
  const t2 = t_yesterday;
  const t3 = t_today;

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
  const groupedTimeline = getContactTimeline(testContactId);

  console.log('--- Step 3: Confirm content and highlighting ---');
  groupedTimeline.forEach(group => {
    console.log(`SECTION: ${group.label} (${group.items.length} items)`);
    group.items.forEach((item, index) => {
      const latestTag = item.is_latest ? ' [LATEST]' : '';
      console.log(`  ${index + 1}. [${item.created_at}] TYPE: ${item.type} | CONTENT: ${item.content}${latestTag}`);
    });
  });

  const allItems = groupedTimeline.flatMap(g => g.items);
  const latestItem = allItems[allItems.length - 1];

  if (!latestItem || !latestItem.is_latest) {
    console.error('❌ FAILURE: Latest activity not identified correctly.');
    throw new Error('Test failed: missing latest highlight');
  }

  console.log('✅ SUCCESS: Milestone 1 Verification Complete.');
}

testTimeline().catch(err => {
  console.error('Test Error:', err.message);
  process.exit(1);
});
