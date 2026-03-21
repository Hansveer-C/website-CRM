import { mockMessages, mockEventLogs, mockActivities } from './db';
import { TimelineItem } from './types';

/**
 * Standardized timeline item source.
 * Follows strict mapping:
 * - Messages -> "message"
 * - Form Submission -> "form_submission"
 * - Everything Else (Events, Activities) -> "event"
 */
export function getContactTimeline(contact_id: string): TimelineItem[] {
  // 1. Fetch source data
  const messages = mockMessages.filter(m => m.contact_id === contact_id);
  const eventLogs = mockEventLogs.filter(e => e.payload && e.payload.contact_id === contact_id);
  const activities = mockActivities.filter(a => a.contact_id === contact_id);

  // 2. Map Messages
  const messageItems = messages.map(m => ({
    type: 'message' as const,
    content: `SMS (${m.direction.toUpperCase()}): ${m.content}`,
    created_at: m.created_at,
    reference_id: m.id,
    contact_id: m.contact_id,
    metadata: { direction: m.direction, status: m.status }
  }));

  // 3. Map EventLogs
  const eventItems = eventLogs.map(e => {
    let type: 'form_submission' | 'event' = 'event';
    let content = '';

    if (e.event_name === 'form_submitted' || e.event_name === 'form_submission') {
      type = 'form_submission';
      content = 'Form submitted via website';
    } else {
      type = 'event';
      content = e.event_name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    return {
      type,
      content,
      created_at: e.created_at,
      reference_id: e.id,
      contact_id: contact_id,
      metadata: { ...e.payload }
    };
  });

  // 4. Map Activities (mapped to "event" as per prompt's "system events -> event" instruction)
  const activityItems = activities.map(a => ({
    type: 'event' as const,
    content: `${a.type.toUpperCase()}: ${a.description}`,
    created_at: a.due_date,
    reference_id: a.id,
    contact_id: a.contact_id,
    metadata: { completed: a.completed, activityType: a.type }
  }));

  // 5. Combine and Sort (Temporal Order - Oldest First)
  return [...messageItems, ...eventItems, ...activityItems].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
