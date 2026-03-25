import { EventLog, User } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

/**
 * Phase S3 - Batch 5: EventLogs Repository (Supabase).
 */
export const EventLogsRepo = {
  /**
   * Persists an event log entry to Supabase.
   */
  async createEventLog(log: EventLog): Promise<EventLog> {
    console.log(`[DB: SUPABASE EVENT] Logging ${log.event_name} (${log.id}).`);
    
    const { data, error } = await supabase
      .from('event_logs')
      .upsert(log)
      .select()
      .single();

    if (error) {
        console.error('[DB: EVENT_LOG] Failed to persist event log in Supabase:', error.message);
        throw new Error(`DB_PERSIST_EVENT_LOG_ERROR: ${error.message}`);
    }

    return data as EventLog;
  },

  /**
   * Alias for createEventLog to maintain compatibility.
   */
  async persistEventLog(log: EventLog): Promise<EventLog> {
    return this.createEventLog(log);
  },

  /**
   * Retrieves all event logs, scoped to the user context.
   */
  async getAllEventLogs(user?: User | string | null): Promise<EventLog[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: EVENT_LOG] Get all event logs attempted without user context.');
        return [];
    }

    const { data, error } = await supabase
      .from('event_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[DB: EVENT_LOG] Error listing event logs from Supabase:', error.message);
        throw new Error(`DB_LIST_EVENT_LOGS_ERROR: ${error.message}`);
    }

    return (data || []) as EventLog[];
  }
};

// --- Standard Individual Exports ---
/**
 * Persist event log to Supabase.
 */
export async function persistEventLog(log: EventLog): Promise<EventLog> {
    return EventLogsRepo.createEventLog(log);
}

/**
 * List all event logs (Supabase).
 */
export async function getAllEventLogs(user?: User | string | null): Promise<EventLog[]> {
    return EventLogsRepo.getAllEventLogs(user);
}

