import { Call, User } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

/**
 * Phase S3 - Batch 4: Calls Repository (Supabase).
 */
export const CallsRepo = {
  /**
   * Persists a call to the Supabase database.
   */
  async createCall(call: Call): Promise<Call> {
    console.log(`[DB: SUPABASE CALL] Persisting ${call.id} for phone ${call.phone}. Status: ${call.status}`);
    
    const { data, error } = await supabase
      .from('calls')
      .upsert(call)
      .select()
      .single();

    if (error) {
        console.error('[DB: CALL] Failed to persist call in Supabase:', error.message);
        throw new Error(`DB_PERSIST_CALL_ERROR: ${error.message}`);
    }

    return data as Call;
  },

  /**
   * Alias for createCall to maintain compatibility.
   */
  async persistCall(call: Call): Promise<Call> {
    return this.createCall(call);
  },

  /**
   * Retrieves a single call by its ID, scoped to the user context.
   */
  async getCall(id: string, user?: User | string | null): Promise<Call | null> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: CALL] Get call attempted without user context.');
        return null; // OR return record if system bypass?
    }

    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
        console.error('[DB: CALL] Error retrieving call from Supabase:', error.message);
        throw new Error(`DB_GET_CALL_ERROR: ${error.message}`);
    }

    return data as Call | null;
  },

  /**
   * Retrieves calls associated with a contact or phone number.
   * Scoped to user context for privacy.
   */
  async getCallsForContact(contact_id: string, phone?: string, user?: User | string | null): Promise<Call[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: CALL] Get calls by contact attempted without user context.');
        return [];
    }

    let query = supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId);

    if (phone) {
        query = query.or(`contact_id.eq.${contact_id},phone.eq.${phone}`);
    } else {
        query = query.eq('contact_id', contact_id);
    }

    const { data, error } = await supabase.from('calls').select('*')
            .eq('user_id', userId)
            .or(`contact_id.eq.${contact_id}${phone ? `,phone.eq.${phone}` : ''}`)
            .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB: CALL] Error listing calls in Supabase:', error.message);
        throw new Error(`DB_LIST_CALLS_CONTACT_ERROR: ${error.message}`);
    }

    return (data || []) as Call[];
  }
};

// --- Standard Individual Exports ---
/**
 * Persist call to Supabase.
 */
export async function createCall(call: Call): Promise<Call> {
    return CallsRepo.createCall(call);
}

/**
 * Persist call to Supabase (Legacy Alias).
 */
export async function persistCall(call: Call): Promise<Call> {
    return CallsRepo.createCall(call);
}

/**
 * Get call by ID (Supabase).
 */
export async function getCall(id: string, user?: User | string | null): Promise<Call | null> {
    return CallsRepo.getCall(id, user);
}

/**
 * Get calls for contact or phone (Supabase).
 */
export async function getCallsForContact(contact_id: string, phone?: string, user?: User | string | null): Promise<Call[]> {
    return CallsRepo.getCallsForContact(contact_id, phone, user);
}

