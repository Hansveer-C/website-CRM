import { mockEventLogs, mockContacts } from './db';

export interface AppEvent {
  event_name: string;
  payload: Record<string, any>;
  created_at: string; // ISO 8601 timestamp
}

export type EventListener = (payload: Record<string, any>) => void;
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
export function emitEvent(name: string, payload: Record<string, any> = {}): AppEvent | null {
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
  
  // Trigger Listeners
  if (listeners[name]) {
    listeners[name].forEach(fn => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    });
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
onEvent('lead_created', (payload) => {
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
    console.log('No phone available for SMS');
    return;
  }

  // Ready for SMS operations (no SMS triggered yet)
});

