import { mockMessages, mockEventLogs, mockCalls } from './db';

/**
 * Developer-safe test scenario to verify cross-day timeline grouping.
 * Populates mock data for a specific contact across Today, Yesterday, and Earlier buckets.
 */
export function loadTimelineTestData(contact_id: string) {
    const now = new Date();
    
    // ISO string for now (Today)
    const today = now.toISOString();
    
    // Yesterday
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toISOString();
    
    // Earlier (5 days ago)
    const earlierDate = new Date(now);
    earlierDate.setDate(now.getDate() - 5);
    const earlier = earlierDate.toISOString();

    // 1. Earlier Item
    mockMessages.push({
        id: `t-msg-earlier-${Date.now()}`,
        contact_id,
        direction: 'inbound',
        type: 'sms',
        content: 'Historical message from 5 days ago.',
        status: 'sent',
        created_at: earlier
    });

    // 2. Yesterday Item
    mockEventLogs.push({
        id: `t-event-yesterday-${Date.now()}`,
        event_name: 'form_submitted',
        payload: { contact_id, source: 'testing' },
        status: 'processed',
        created_at: yesterday
    });

    // 3. Today Item (Morning)
    const todayMorning = new Date(now);
    todayMorning.setHours(9, 0, 0, 0);
    mockCalls.push({
        id: `t-call-today-1-${Date.now()}`,
        contact_id,
        direction: 'inbound',
        phone: '555-TEST',
        status: 'answered',
        duration: 45,
        created_at: todayMorning.toISOString()
    });

    // 4. Today Item (Now)
    mockMessages.push({
        id: `t-msg-today-2-${Date.now()}`,
        contact_id,
        direction: 'outbound',
        type: 'sms',
        content: 'Instant message sent just now.',
        status: 'sent',
        created_at: today
    });

    console.log(`[TEST SCENARIO] Populated 4 timeline items for contact: ${contact_id}`);
}
