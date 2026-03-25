import { EventLog, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

/**
 * Standardized "New" badge logic.
 * Returns true if the provided date string is within the last 24 hours.
 */
function isNew(dateStr: string): boolean {
  if (!dateStr) return false;
  const now = new Date().getTime();
  const createdAt = new Date(dateStr).getTime();
  return (now - createdAt) < (24 * 60 * 60 * 1000);
}

/**
 * Persists an event log entry to Supabase.
 */
export async function createEventLog(log: EventLog): Promise<RepoResponse<EventLog>> {
  console.log(`[DB: SUPABASE EVENT] Logging ${log.event_name} (${log.id}).`);
  
  // Auto-extract contact_id if present in payload but not in log root
  const contact_id = log.contact_id || (log.payload as any)?.contact_id;

  return safeDbCall('CREATE_EVENT_LOG', log.user_id, supabase
    .from('event_logs')
    .upsert({ ...log, contact_id })
    .select()
    .single()
  );
}

/**
 * Alias for createEventLog to maintain compatibility.
 */
export async function persistEventLog(log: EventLog): Promise<RepoResponse<EventLog>> {
  return createEventLog(log);
}

/**
 * Retrieves all event logs, scoped to the user context.
 */
export async function getAllEventLogs(user?: User | string | null): Promise<RepoResponse<EventLog[]>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  return safeDbCall('GET_ALL_EVENT_LOGS', userId, supabase
    .from('event_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  );
}

/**
 * Retrieves event logs for a specific contact, scoped to user.
 */
export async function getEventLogsByContact(contact_id: string, user?: User | string | null, limit = 50): Promise<RepoResponse<EventLog[]>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  return safeDbCall('GET_EVENT_LOGS_BY_CONTACT', userId, supabase
    .from('event_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contact_id)
    .order('created_at', { ascending: false })
    .limit(limit)
  );
}

/**
 * Retrieves recent event logs for a specific event name and user.
 */
export async function getRecentEventLogs(eventName: string, userId: string, sinceIso: string): Promise<RepoResponse<EventLog[]>> {
  return safeDbCall('GET_RECENT_EVENT_LOGS', userId, supabase
    .from('event_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('event_name', eventName)
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
  );
}
