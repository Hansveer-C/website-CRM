import { mockWebsiteSettings } from './db';
import { getContact } from './contacts_repo';
import { getMessagesByContact } from './messages_repo';
import { getAllEventLogs } from './event_logs_repo';
import { getCallsForContact } from './calls_repo';
import { getActivitiesByContact } from './activities_repo';
import { TimelineItem, TimelineGroup } from './types';

/**
 * Standardized timeline item source.
 * Fully DB-backed.
 */
export function getContactTimeline(contact_id: string): TimelineGroup[] {
  const contact = getContact(contact_id);
  const phone = contact?.phone;

  // 1. Fetch source data from DB repositories
  const messages = getMessagesByContact(contact_id);
  const allEventLogs = getAllEventLogs();
  const activities = getActivitiesByContact(contact_id);
  const calls = getCallsForContact(contact_id, phone);

  // Filter event logs in JS for contact linkage (payload-based)
  const eventLogs = allEventLogs.filter(e => {
    if (!e.payload) return false;
    return e.payload.contact_id === contact_id || (phone && e.payload.phone === phone);
  });

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

  // 4. Map Calls
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

  // 5. Map Activities
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

  // 7. Define Date Boundaries (Recalculated each time)
  const now = new Date();
  const todayStr = formatDateForComparison(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatDateForComparison(yesterday);

  // 8. Grouping Logic
  const todayItems: any[] = [];
  const yesterdayItems: any[] = [];
  const earlierItems: any[] = [];

  allItems.forEach((item, idx) => {
    const itemDate = formatDateForComparison(new Date(item.created_at));
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

  // 9. Final Grouped Structure
  return [
    { label: 'Earlier', items: earlierItems },
    { label: 'Yesterday', items: yesterdayItems },
    { label: 'Today', items: todayItems }
  ];
}

/**
 * Formats a raw timestamp into a human-readable display string.
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
    return timestamp;
  }
}

/**
 * Helper to get YYYY-MM-DD in local time for consistent comparison.
 */
function formatDateForComparison(date: Date): string {
  return date.getFullYear() + '-' + 
         String(date.getMonth() + 1).padStart(2, '0') + '-' + 
         String(date.getDate()).padStart(2, '0');
}

/**
 * Returns the single most recent activity for a contact.
 */
export function getLatestActivity(contact_id: string): any | null {
    const groups = getContactTimeline(contact_id);
    const reversedGroups = [...groups].reverse();
    for (const group of reversedGroups) {
        if (group.items.length > 0) {
            return group.items[group.items.length - 1];
        }
    }
    return null;
}
