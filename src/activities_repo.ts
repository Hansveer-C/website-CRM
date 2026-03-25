import { Activity, User } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

/**
 * Phase S3 - Batch 5: Activities Repository (Supabase).
 */
export const ActivitiesRepo = {
  /**
   * Persists an activity to Supabase.
   */
  async createActivity(activity: Activity): Promise<Activity> {
    console.log(`[DB: SUPABASE ACTIVITY] Persisting activity ${activity.id} for contact ${activity.contact_id}.`);
    
    const payload = {
        ...activity,
        completed: !!activity.completed
    };

    const { data, error } = await supabase
      .from('activities')
      .upsert(payload)
      .select()
      .single();

    if (error) {
        console.error('[DB: ACTIVITY] Failed to persist activity in Supabase:', error.message);
        throw new Error(`DB_PERSIST_ACTIVITY_ERROR: ${error.message}`);
    }

    return data as Activity;
  },

  /**
   * Alias for createActivity to maintain compatibility.
   */
  async persistActivity(activity: Activity): Promise<Activity> {
    return this.createActivity(activity);
  },

  /**
   * Retrieves all activities for a specific contact, scoped to user.
   */
  async getActivitiesByContact(contact_id: string, user?: User | string | null): Promise<Activity[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: ACTIVITY] Get by contact attempted without user context.');
        return [];
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .order('due_date', { ascending: false });

    if (error) {
        console.error('[DB: ACTIVITY] Error listing activities in Supabase:', error.message);
        throw new Error(`DB_LIST_ACTIVITIES_CONTACT_ERROR: ${error.message}`);
    }

    return (data || []) as Activity[];
  }
};

// --- Standard Individual Exports ---
/**
 * Persist activity to Supabase.
 */
export async function persistActivity(activity: Activity): Promise<Activity> {
    return ActivitiesRepo.createActivity(activity);
}

/**
 * Get all activities for a specific contact (Supabase).
 */
export async function getActivitiesByContact(contact_id: string, user?: User | string | null): Promise<Activity[]> {
    return ActivitiesRepo.getActivitiesByContact(contact_id, user);
}

