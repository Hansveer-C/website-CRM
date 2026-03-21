import { mockEventLogs } from './db';

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
 * Emits an event, saves it to EventLogs collection and logs to console.
 */
export function emitEvent(name: string, payload: Record<string, any> = {}): AppEvent {
  const event = createEvent(name, payload);
  eventLog.push(event);

  // Persist to EventLogs collection
  mockEventLogs.push({
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event_name: event.event_name,
    payload: event.payload,
    created_at: event.created_at
  });

  console.log('[Event Logged]:', event);
  return event;
}

/**
 * Returns all logged events.
 */
export function getEvents(): AppEvent[] {
  return [...eventLog];
}
