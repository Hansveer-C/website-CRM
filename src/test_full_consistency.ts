import { saveMessage, getConversation, getConversationSummary } from './messages';
import { mockMessages } from './db';

const contactId = 'c1';

// Reset mockMessages
mockMessages.length = 0;

console.log('--- TEST: Full Conversation Consistency ---');

// 1. Initial State
console.log('Initial Summary:', getConversationSummary(contactId));

// 2. Add Message #1
saveMessage({ contact_id: contactId, content: 'First!', created_at: '2026-03-21T08:00:00Z' });

// 3. Confirm retrieval
const conv1 = getConversation(contactId);
const sum1 = getConversationSummary(contactId);
console.log('After Msg #1 - Conv Length:', conv1.length, '| Summary:', sum1?.last_message_content);

// 4. Add Message #2 (later)
saveMessage({ contact_id: contactId, content: 'Second (latest)!', created_at: '2026-03-21T09:00:00Z' });

// 5. Confirm retrieval and update
const conv2 = getConversation(contactId);
const sum2 = getConversationSummary(contactId);
console.log('After Msg #2 - Conv Length:', conv2.length, '| Summary:', sum2?.last_message_content);

// Verification
const isConsistent = conv2.length === 2 && 
                     conv2[1].content === 'Second (latest)!' && 
                     sum2?.last_message_content === 'Second (latest)!';

if (isConsistent) {
    console.log('--- ALL CONSISTENCY TESTS PASSED ---');
    console.log('Conversations stay consistent without separate state storage.');
} else {
    console.error('--- CONSISTENCY TESTS FAILED ---');
    process.exit(1);
}
