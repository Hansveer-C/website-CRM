import { mockMessages, mockEventLogs, mockActivities, mockCalls, mockContacts } from './db';
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
  const contact = mockContacts.find(c => c.id === contact_id);
  const phone = contact?.phone;

  // 1. Fetch source data
  const messages = mockMessages.filter(m => m.contact_id === contact_id);
  const eventLogs = mockEventLogs.filter(e => {
    if (!e.payload) return false;
    return e.payload.contact_id === contact_id || (phone && e.payload.phone === phone);
  });
  const activities = mockActivities.filter(a => a.contact_id === contact_id);
  const calls = mockCalls.filter(c => c.contact_id === contact_id || (phone && c.phone === phone));

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
    let type: 'form_submission' | 'event' | 'call_missed' = 'event';
    let content = '';

    if (e.event_name === 'form_submitted' || e.event_name === 'form_submission') {
      type = 'form_submission';
      content = 'Form submitted via website';
    } else if (e.event_name === 'call_received') {
      type = 'event';
      content = '📞 Inbound call: STARTED';
    } else if (e.event_name === 'call_missed') {
      type = 'call_missed';
      content = `[MISSED CALL] Incoming call from ${e.payload.phone || 'Unknown'}`;
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

  // 4. Map Calls (Phase 2.1.3)
  const callItems = calls.map(c => {
    const direction = c.direction === 'inbound' ? 'Inbound call' : 'Outbound call';
    const isMissed = c.status === 'missed';
    let content = isMissed 
        ? `[MISSED CALL] Incoming call from ${c.phone}` 
        : `📞 ${direction}: ${c.status.toUpperCase()}`;
    
    if (c.duration && c.duration > 0) {
      content += ` (${c.duration}s)`;
    }
    
    return {
      type: (isMissed ? 'call_missed' : 'event') as any,
      content,
      created_at: c.created_at,
      reference_id: c.id,
      contact_id: contact_id,
      metadata: { status: c.status, direction: c.direction, duration: c.duration || 0 }
    };
  });

  // 5. Map Activities (mapped to "event" as per prompt's "system events -> event" instruction)
  const activityItems = activities.map(a => ({
    type: 'event' as const,
    content: `Event: ${a.type.toUpperCase()}`,
    created_at: a.due_date,
    reference_id: a.id,
    contact_id: a.contact_id,
    metadata: { completed: a.completed, activityType: a.type, description: a.description }
  }));

  // 6. Combine and Sort (Oldest First within groups)
  const allItems = [...messageItems, ...eventItems, ...callItems, ...activityItems].sort((a, b) => 
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

/**
 * Returns the single most recent activity for a contact across all groups.
 */
export function getLatestActivity(contact_id: string): TimelineItem | null {
    const groups = getContactTimeline(contact_id);
    
    // Reverse priority (Today -> Yesterday -> Earlier)
    const reversedGroups = [...groups].reverse();
    
    for (const group of reversedGroups) {
        if (group.items.length > 0) {
            // Within group, items are sorted oldest first (ASC)
            // So last item is latest
            return group.items[group.items.length - 1];
        }
    }
    
    return null;
}
