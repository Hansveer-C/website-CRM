import { getContact } from './contacts_repo';
import { getMessagesByContact } from './messages_repo';
import { getEventLogsByContact } from './event_logs_repo';
import { getCallsForContact } from './calls_repo';
import { getActivitiesByContact } from './activities_repo';
import { TimelineItem, User, RepoResponse } from './types';

export interface TimelineGroup {
    label: string;
    items: TimelineItem[];
}

/**
 * Standardized timeline item source.
 * Optimized with DB-side filtering, sorting, and indexing.
 */
/**
 * Standardized timeline item source.
 * Optimized with DB-side filtering, sorting, and indexing.
 */
export async function getContactTimeline(contact_id: string, user?: User | string | null, limit = 50): Promise<RepoResponse<TimelineGroup[]>> {
  const contactRes = await getContact(contact_id, user);
  if (!contactRes.success || !contactRes.data) {
    return { success: false, error: contactRes.error || 'CONTACT_NOT_FOUND' };
  }
  const phone = contactRes.data.phone;

  // 1. Fetch source data from DB repositories (Parallel & DB-Filtered)
  const [msgRes, logRes, actRes, callRes] = await Promise.all([
    getMessagesByContact(contact_id, user, limit),
    getEventLogsByContact(contact_id, user, limit),
    getActivitiesByContact(contact_id, user, limit),
    getCallsForContact(contact_id, phone, user, limit)
  ]);

  // Check for failures
  if (!msgRes.success) return { success: false, error: msgRes.error };
  if (!logRes.success) return { success: false, error: logRes.error };
  if (!actRes.success) return { success: false, error: actRes.error };
  if (!callRes.success) return { success: false, error: callRes.error };

  const messages = msgRes.data || [];
  const eventLogs = logRes.data || [];
  const activities = actRes.data || [];
  const calls = callRes.data || [];

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

  // 6. Combine and Sort (Newest First overall, then grouped)
  const allItems = [...messageItems, ...eventItems, ...callItems, ...activityItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  // 7. Define Date Boundaries
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
    const isLatest = idx === 0; // Since sorted DESC, the first item is the newest
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
  return {
    success: true,
    data: [
      { label: 'Earlier', items: earlierItems.reverse() },
      { label: 'Yesterday', items: yesterdayItems.reverse() },
      { label: 'Today', items: todayItems.reverse() }
    ]
  };
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
export async function getLatestActivity(contact_id: string, user?: User | string | null): Promise<any | null> {
    const { success, data: groups } = await getContactTimeline(contact_id, user);
    if (!success || !groups) return null;

    const reversedGroups = [...groups].reverse();
    for (const group of reversedGroups) {
        if (group.items.length > 0) {
            return group.items[group.items.length - 1];
        }
    }
    return null;
}

