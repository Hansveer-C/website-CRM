export interface AppEvent {
  event_name: string;
  payload: Record<string, any>;
  created_at: string; // ISO 8601 timestamp
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
 * Logs an event to the in-memory store and to the console.
 */
export function logEvent(name: string, payload: Record<string, any> = {}): AppEvent {
  const event = createEvent(name, payload);
  eventLog.push(event);
  console.log('[Event Logged]:', event);
  return event;
}

/**
 * Returns all logged events.
 */
export function getEvents(): AppEvent[] {
  return [...eventLog];
}
