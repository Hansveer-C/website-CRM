import { saveMessage, getConversationSummary } from './messages';
import { mockMessages } from './db';

// Reset mockMessages
mockMessages.length = 0;

console.log('--- TEST: Conversation Summary ---');

const contactId = 'c1';

// 1. Add multiple messages
saveMessage({ contact_id: contactId, content: 'First message', created_at: '2026-03-21T08:00:00Z', direction: 'inbound' });
saveMessage({ contact_id: contactId, content: 'Middle message', created_at: '2026-03-21T09:00:00Z', direction: 'outbound' });
saveMessage({ contact_id: contactId, content: 'Latest message!', created_at: '2026-03-21T10:00:00Z', direction: 'outbound' });

// 2. Fetch summary
const summary = getConversationSummary(contactId);

console.log('Summary Result:', summary);

// 3. Confirm summary shows MAX created_at
if (summary && 
    summary.last_message_content === 'Latest message!' && 
    summary.last_message_direction === 'outbound') {
    console.log('PASSED: Conversation summary accurately reflects the latest activity.');
} else {
    console.error('FAILED: Summary is incorrect or missing.');
    process.exit(1);
}
