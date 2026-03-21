import { saveMessage, getConversation } from './messages';
import { mockContacts, mockOpportunities, mockMessages } from './db';

// Setup
const contactId = 'c1';
const oppId = 'o-123';

mockMessages.length = 0;
mockOpportunities.length = 0;

// 1. Create Opportunity
mockOpportunities.push({
    id: oppId,
    contact_id: contactId,
    pipeline_stage: 'New Lead',
    value: 500,
    assigned_to: 'Hansveer',
    status: 'open',
    created_at: '2026-03-21T08:00:00Z'
});

// 2. Save Message
saveMessage({
    contact_id: contactId,
    content: 'Howdy! Just checking in on your project.',
    direction: 'outbound'
});

// 3. Verify
const messages = getConversation(contactId);
const linkedMessage = messages[0];

console.log('--- TEST: Opportunity Linking ---');
console.log('Message Content:', linkedMessage.content);
console.log('Attached Opportunity ID:', linkedMessage.opportunity_id);

const isLinked = linkedMessage.opportunity_id === oppId;

if (isLinked) {
    console.log('PASSED: Message was automatically linked to the active opportunity.');
} else {
    console.error('FAILED: Message was NOT linked.');
    process.exit(1);
}
