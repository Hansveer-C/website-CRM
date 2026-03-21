import { mockMessages, mockEventLogs, mockActivities } from './db';
import { TimelineItem } from './types';

export interface TimelineGroup {
    label: string;
    items: TimelineItem[];
}

/**
 * Standardized timeline item source.
 * Follows strict mapping:
 * - Messages -> "message"
 * - Form Submission -> "form_submission"
 * - Everything Else (Events, Activities) -> "event"
 */
export function getContactTimeline(contact_id: string): TimelineGroup[] {
  // 1. Fetch source data
  const messages = mockMessages.filter(m => m.contact_id === contact_id);
  const eventLogs = mockEventLogs.filter(e => e.payload && e.payload.contact_id === contact_id);
  const activities = mockActivities.filter(a => a.contact_id === contact_id);

  // 2. Map Messages
  const messageItems = messages.map(m => {
    const isOutbound = m.direction === 'outbound';
    const arrow = isOutbound ? '→' : '←';
    const prefix = isOutbound ? 'Sent SMS' : 'Received SMS';
    const displayContent = m.content.length > 120 ? m.content.substring(0, 117) + '...' : m.content;
    return {
      type: 'message' as const,
      content: `${arrow} ${prefix}: ${displayContent}`,
      created_at: m.created_at,
      reference_id: m.id,
      contact_id: m.contact_id,
      metadata: { direction: m.direction, status: m.status }
    };
  });

  // 3. Map EventLogs
  const eventItems = eventLogs.map(e => {
    let type: 'form_submission' | 'event' = 'event';
    let content = '';

    if (e.event_name === 'form_submitted' || e.event_name === 'form_submission') {
      type = 'form_submission';
      content = 'Form submitted via website';
    } else {
      type = 'event';
      content = `Event: ${e.event_name}`;
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
    content: `Event: ${a.type.toUpperCase()}`,
    created_at: a.due_date,
    reference_id: a.id,
    contact_id: a.contact_id,
    metadata: { completed: a.completed, activityType: a.type, description: a.description }
  }));

  // 5. Combine and Sort (Oldest First within groups)
  const allItems = [...messageItems, ...eventItems, ...activityItems].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // 6. Define Date Boundaries (based on 2026-03-21)
  const now = new Date('2026-03-21T14:45:50-07:00');
  const todayStr = '2026-03-21';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 7. Grouping Logic
  const todayItems: any[] = [];
  const yesterdayItems: any[] = [];
  const earlierItems: any[] = [];

  allItems.forEach((item, idx) => {
    const itemDate = item.created_at.split('T')[0];
    const isLatest = idx === allItems.length - 1;
    const displayItem = {
        ...item,
        is_latest: isLatest,
        created_at: formatTimelineTime(item.created_at)
    };

    if (itemDate === todayStr) {
      todayItems.push(displayItem);
    } else if (itemDate === yesterdayStr) {
      yesterdayItems.push(displayItem);
    } else {
      earlierItems.push(displayItem);
    }
  });

  // 8. Final Grouped Structure
  return [
    { label: 'Earlier', items: earlierItems },
    { label: 'Yesterday', items: yesterdayItems },
    { label: 'Today', items: todayItems }
  ];
}

/**
 * Formats a raw timestamp into a human-readable display string.
 * Example: "Mar 21, 2:45 PM"
 */
function formatTimelineTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    return timestamp; // Fallback to raw if invalid
  }
}
