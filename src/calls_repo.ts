import { Call, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

/**
 * Phase S3 - Batch 4: Calls Repository (Supabase).
 */
export const CallsRepo = {
  /**
   * Persists a call to the Supabase database.
   */
  async createCall(call: Call): Promise<RepoResponse<Call>> {
    console.log(`[DB: SUPABASE CALL] Persisting ${call.id} for phone ${call.phone}.`);
    
    return safeDbCall('CREATE_CALL', call.user_id, supabase
      .from('calls')
      .upsert(call)
      .select()
      .single()
    );
  },

  /**
   * Alias for createCall to maintain compatibility.
   */
  async persistCall(call: Call): Promise<RepoResponse<Call>> {
    return this.createCall(call);
  },

  /**
   * Retrieves a single call by its ID, scoped to the user context.
   */
  async getCall(id: string, user?: User | string | null): Promise<RepoResponse<Call | null>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    return safeDbCall('GET_CALL', userId, supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    );
  },

  /**
   * Retrieves calls associated with a contact or phone number.
   * Scoped to user context for privacy.
   */
  async getCallsForContact(contact_id: string, phone?: string, user?: User | string | null, limit = 50): Promise<RepoResponse<Call[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
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

    return safeDbCall('GET_CALLS_BY_CONTACT', userId, query
            .order('created_at', { ascending: false })
            .limit(limit)
    );
  }
};

// --- Standard Individual Exports ---
/**
 * Persist call to Supabase.
 */
export async function createCall(call: Call): Promise<RepoResponse<Call>> {
    return CallsRepo.createCall(call);
}

export async function persistCall(call: Call): Promise<RepoResponse<Call>> {
    return CallsRepo.createCall(call);
}

export async function getCall(id: string, user?: User | string | null): Promise<RepoResponse<Call | null>> {
    return CallsRepo.getCall(id, user);
}

export async function getCallsForContact(contact_id: string, phone?: string, user?: User | string | null, limit = 50): Promise<RepoResponse<Call[]>> {
    return CallsRepo.getCallsForContact(contact_id, phone, user, limit);
}

