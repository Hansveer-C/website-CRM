import { saveMessage, getConversation } from './messages';
import { mockContacts, mockActivities, mockMessages } from './db';

// Setup
const contactId = 'c1';
mockMessages.length = 0;
mockActivities.length = 0;

// 1. Log a call
mockActivities.push({
    id: 'a1',
    contact_id: contactId,
    type: 'call',
    description: 'Initial discovery call',
    due_date: new Date().toISOString(),
    completed: true
});

// 2. Save a message
saveMessage({
    contact_id: contactId,
    content: 'Sending you the quote via SMS!',
    created_at: new Date().toISOString(),
    direction: 'outbound'
});

// Simulation of the timeline logic in main.ts
const messages = getConversation(contactId);
const activities = mockActivities.filter(a => a.contact_id === contactId);

const combinedTimeline = [
  ...activities.map(a => ({ 
    id: a.id, 
    created_at: a.due_date, 
    type: 'activity', 
    activityType: a.type, 
    description: a.description, 
    completed: a.completed 
  })),
  ...messages.map(m => ({ 
    id: m.id, 
    created_at: m.created_at, 
    type: 'message', 
    direction: m.direction, 
    content: m.content 
  }))
].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

console.log('--- TEST: Timeline Integration ---');
combinedTimeline.forEach((item, index) => {
    console.log(`${index + 1}. [${item.created_at}] ${item.type.toUpperCase()}: ${item.type === 'message' ? (item as any).content : (item as any).description}`);
});

const isCorrect = combinedTimeline.length === 2 && 
                  combinedTimeline[0].type === 'activity' && 
                  combinedTimeline[1].type === 'message';

if (isCorrect) {
    console.log('PASSED: Messages and activities are merged and sorted correctly.');
} else {
    console.error('FAILED: Incorrect ordering or missing items.');
    process.exit(1);
}
