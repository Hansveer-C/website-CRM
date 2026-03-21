import { mockEventLogs, mockContacts, mockMessages, mockWebsiteSettings } from './db';
import { getDefaultLeadReply, sendMessageToContact } from './sms';

export interface AppEvent {
  event_name: string;
  payload: Record<string, any>;
  created_at: string; // ISO 8601 timestamp
}

export type EventListener = (payload: Record<string, any>) => Promise<void> | void;
const listeners: Record<string, EventListener[]> = {};

export function onEvent(name: string, callback: EventListener) {
  if (!listeners[name]) {
    listeners[name] = [];
  }
  listeners[name].push(callback);
}

/**
 * Creates a basic event object.
 */
export function createEvent(name: string, payload: Record<string, any> = {}): AppEvent {
  return {
    event_name: name,
    payload,
    created_at: new Date().toISOString(),
  };
}

/**
 * Simple in-memory storage for events.
 */
const eventLog: AppEvent[] = [];

/**
 * Emits an event, saves it to EventLogs collection and logs to console.
 */
export async function emitEvent(name: string, payload: Record<string, any> = {}): Promise<AppEvent | null> {
  // Simple Validation
  if (name === 'form_submitted' || name === 'lead_created') {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error('Invalid event payload', { event_name: name, payload });
      return null;
    }
  }

  const event = createEvent(name, payload);
  eventLog.push(event);

  // Persist to EventLogs collection (Initial state: pending)
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event_name: event.event_name,
    payload: event.payload,
    status: 'pending',
    created_at: event.created_at
  };
  mockEventLogs.push(logEntry);

  // Mark as processed (Synchronous for now)
  logEntry.status = 'processed';

  console.log('[Event Logged]:', event);
  
  // Trigger Listeners (Synchronously awaiting to prevent race conditions in tests)
  if (listeners[name]) {
    for (const fn of listeners[name]) {
      try {
        await fn(payload);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    }
  }

  return event;
}

/**
 * Returns all logged events.
 */
export function getEvents(): AppEvent[] {
  return [...eventLog];
}

// --- Register Business Logic Listeners ---
onEvent('lead_created', async (payload) => {
  // Global Toggle Check
  if (!mockWebsiteSettings.auto_lead_sms_enabled) {
    console.log('Automated lead SMS skipped: auto-response disabled globally');
    return;
  }

  console.log('Lead created event received');

  const contact_id = payload.contact_id;
  let phone = payload.phone;

  // If no phone in payload, fallback to DB
  if (!phone && contact_id) {
    const contact = mockContacts.find(c => c.id === contact_id);
    if (contact && contact.phone) {
      phone = contact.phone;
    }
  }

  if (!phone) {
    console.log('Automated lead SMS skipped: no phone');
    return;
  }

  // Fetch full contact object
  const contact = mockContacts.find(c => c.id === contact_id);
  if (!contact) {
    console.log('Contact not found for SMS');
    return;
  }

  // Generate automated message
  const template = mockWebsiteSettings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  
  // Prevent duplicate automated SMS (2 minute window)
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);
  
  const alreadySent = mockMessages.some(m => 
    m.contact_id === contact_id &&
    m.direction === 'outbound' &&
    new Date(m.created_at).getTime() >= twoMinutesAgo &&
    (m.content === message || m.content.includes("thanks for reaching out"))
  );

  if (alreadySent) {
    console.log('Automated lead SMS skipped: duplicate prevented');
    return;
  }

  // Trigger SMS
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  const result = await sendMessageToContact(contact_id, message, 'automation');
  
  if (result.success) {
    console.log('Automated lead SMS sent');
  } else {
    console.log('Auto SMS failed');
    contact.follow_up_required = true;
  }
});

