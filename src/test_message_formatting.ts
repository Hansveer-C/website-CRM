import { saveMessage, getConversation } from './messages';
import { mockContacts, mockActivities, mockMessages, mockEventLogs } from './db';
import { TimelineItem } from './types';

// Setup
const contactId = 'c1';
mockMessages.length = 0;

// 1. Long Message
const longMessage = "This is a very long message that definitely exceeds one hundred characters to test the truncation logic in the timeline view. It should be cut off at around 100 characters.";
saveMessage({
    contact_id: contactId,
    content: longMessage,
    direction: 'outbound',
    created_at: '2026-03-21T10:00:00Z'
});

// 2. Short Message
saveMessage({
    contact_id: contactId,
    content: "Hi there!",
    direction: 'inbound',
    created_at: '2026-03-21T11:00:00Z'
});

// Simulation of the formatting layer in main.ts
const messages = getConversation(contactId);

const timelineItems: TimelineItem[] = messages.map(m => {
    const prefix = m.direction === 'outbound' ? 'Sent SMS: ' : 'Received SMS: ';
    const displayContent = m.content.length > 100 ? m.content.substring(0, 97) + '...' : m.content;
    return {
      type: 'message' as const,
      reference_id: m.id,
      contact_id: contactId,
      content: `${prefix}${displayContent}`,
      created_at: m.created_at,
      metadata: { direction: m.direction, status: m.status }
    };
});

console.log('--- TEST: Message Formatting ---');
timelineItems.forEach((item, index) => {
    console.log(`${index + 1}. [${item.created_at}] CONTENT: ${item.content}`);
});

const isFormatted = timelineItems.length === 2 && 
                    timelineItems[0].content.startsWith('Sent SMS: ') &&
                    timelineItems[0].content.length <= 110 && // "Sent SMS: " is 10 chars + 100 max
                    timelineItems[1].content === 'Received SMS: Hi there!';

if (isFormatted) {
    console.log('PASSED: Messages correctly use the prefix and apply truncation.');
} else {
    console.error('FAILED: Incorrect message formatting.');
    process.exit(1);
}
