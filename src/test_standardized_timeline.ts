import { saveMessage, getConversation } from './messages';
import { mockContacts, mockActivities, mockMessages, mockEventLogs } from './db';
import { TimelineItem } from './types';

// Setup
const contactId = 'c1';
mockMessages.length = 0;
mockActivities.length = 0;
mockEventLogs.length = 0;

// 1. Log a call
mockActivities.push({
    id: 'a1',
    contact_id: contactId,
    type: 'call',
    description: 'Initial discovery call',
    due_date: '2026-03-21T09:00:00Z',
    completed: true
});

// 2. Save a message
saveMessage({
    contact_id: contactId,
    content: 'Sending you the quote via SMS!',
    created_at: '2026-03-21T10:00:00Z',
    direction: 'outbound'
});

// 3. System Event
mockEventLogs.push({
    id: 'e1',
    event_name: 'form_submitted',
    payload: { contact_id: contactId, source: 'website' },
    status: 'processed',
    created_at: '2026-03-21T08:00:00Z'
});

// Validation Logic (Mapping from main.ts)
const messages = getConversation(contactId);
const activities = mockActivities.filter(a => a.contact_id === contactId);
const relevantEvents = mockEventLogs.filter((log: any) => log.payload.contact_id === contactId);

const unifiedTimeline: TimelineItem[] = [
  ...activities.map(a => ({
    type: 'activity' as const,
    reference_id: a.id,
    contact_id: contactId,
    content: `${a.type.toUpperCase()}: ${a.description}`,
    created_at: a.due_date,
    metadata: { completed: a.completed, activityType: a.type }
  })),
  ...messages.map(m => ({
    type: 'message' as const,
    reference_id: m.id,
    contact_id: contactId,
    content: `SMS (${m.direction.toUpperCase()}): ${m.content}`,
    created_at: m.created_at,
    metadata: { direction: m.direction, status: m.status }
  })),
  ...relevantEvents.map((e: any) => ({
    type: e.event_name === 'form_submitted' ? 'form_submission' as const : 'event' as const,
    reference_id: e.id,
    contact_id: contactId,
    content: `System Event: ${e.event_name.replace('_', ' ').toUpperCase()}`,
    created_at: e.created_at,
    metadata: { ...e.payload }
  }))
].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

console.log('--- TEST: Standardized Timeline ---');
unifiedTimeline.forEach((item, index) => {
    console.log(`${index + 1}. [${item.created_at}] TYPE: ${item.type} | CONTENT: ${item.content}`);
});

const isStandardized = unifiedTimeline.every(item => 
    item.type && item.reference_id && item.contact_id && item.content && item.created_at
);

if (isStandardized && unifiedTimeline.length === 3) {
    console.log('PASSED: All timeline items follow the consistent structure and include system events.');
} else {
    console.error('FAILED: Items are not standardized or missing.');
    process.exit(1);
}
