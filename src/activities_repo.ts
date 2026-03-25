import { Activity, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

/**
 * Phase S3 - Batch 5: Activities Repository (Supabase).
 */
export const ActivitiesRepo = {
  /**
   * Persists an activity to Supabase.
   */
  async createActivity(activity: Activity): Promise<RepoResponse<Activity>> {
    console.log(`[DB: SUPABASE ACTIVITY] Persisting activity ${activity.id} for contact ${activity.contact_id}.`);
    
    const payload = {
        ...activity,
        completed: !!activity.completed
    };

    return safeDbCall('CREATE_ACTIVITY', activity.user_id, supabase
      .from('activities')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Alias for createActivity to maintain compatibility.
   */
  async persistActivity(activity: Activity): Promise<RepoResponse<Activity>> {
    return this.createActivity(activity);
  },

  /**
   * Retrieves all activities for a specific contact, scoped to user.
   */
  async getActivitiesByContact(contact_id: string, user?: User | string | null, limit = 50): Promise<RepoResponse<Activity[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    return safeDbCall('GET_ACTIVITIES_BY_CONTACT', userId, supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .order('due_date', { ascending: false })
      .limit(limit)
    );
  }
};

// --- Standard Individual Exports ---
/**
 * Persist activity to Supabase.
 */
export async function createActivity(activity: Activity): Promise<RepoResponse<Activity>> {
    return ActivitiesRepo.createActivity(activity);
}

export async function persistActivity(activity: Activity): Promise<RepoResponse<Activity>> {
    return ActivitiesRepo.createActivity(activity);
}

export async function getActivitiesByContact(contact_id: string, user?: User | string | null, limit = 50): Promise<RepoResponse<Activity[]>> {
    return ActivitiesRepo.getActivitiesByContact(contact_id, user, limit);
}

