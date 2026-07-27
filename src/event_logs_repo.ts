import { EventLog, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

export const mockEventLogs: EventLog[] = [];


/**
 * Persists an event log entry to Supabase.
 */
export async function createEventLog(log: EventLog): Promise<RepoResponse<EventLog>> {
  console.log(`[DB: SUPABASE EVENT] Logging ${log.event_name} (${log.id}).`);
  
  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      console.log('[DB MOCK FALLBACK: CREATE_EVENT_LOG] Saving to mockEventLogs:', log);
      const idx = mockEventLogs.findIndex(e => e.id === log.id);
      if (idx !== -1) {
          mockEventLogs[idx] = log;
      } else {
          mockEventLogs.push(log);
      }
      return { success: true, data: log };
  }

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

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const list = mockEventLogs.filter(e => e.user_id === userId);
      return { success: true, data: list };
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

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const list = mockEventLogs.filter(e => (e.contact_id === contact_id || (e.payload as any)?.contact_id === contact_id) && e.user_id === userId);
      return { success: true, data: list.slice(0, limit) };
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
  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const list = mockEventLogs.filter(e => e.user_id === userId && e.event_name === eventName && e.created_at > sinceIso);
      return { success: true, data: list };
  }

  return safeDbCall('GET_RECENT_EVENT_LOGS', userId, supabase
    .from('event_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('event_name', eventName)
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
  );
}
