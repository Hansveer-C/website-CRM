import { supabase, safeDbCall } from './utils/db/supabase';
import { Funnel, RepoResponse, User } from './types';

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Funnels.
 */
export const FunnelsRepo = {
  /**
   * Creates a new funnel.
   */
  async createFunnel(userId: string, name: string): Promise<RepoResponse<Funnel>> {
    const funnel: Partial<Funnel> = {
      id: `fnl_${Date.now()}`,
      user_id: userId,
      name,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return safeDbCall('CREATE_FUNNEL', userId, supabase
      .from('funnels')
      .insert(funnel)
      .select()
      .maybeSingle()
    );
  },

  /**
   * Retrieves all funnels for a specific user.
   */
  async getFunnels(userId: string): Promise<RepoResponse<Funnel[]>> {
    return safeDbCall('GET_FUNNELS', userId, supabase
      .from('funnels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Retrieves a single funnel by ID, ensuring user ownership.
   */
  async getFunnelById(userId: string, funnelId: string): Promise<RepoResponse<Funnel>> {
    return safeDbCall('GET_FUNNEL_BY_ID', userId, supabase
      .from('funnels')
      .select('*')
      .eq('id', funnelId)
      .eq('user_id', userId)
      .maybeSingle()
    );
  },

  /**
   * Updates an existing funnel.
   */
  async updateFunnel(userId: string, funnelId: string, data: Partial<Funnel>): Promise<RepoResponse<Funnel>> {
    const payload = {
      ...data,
      updated_at: new Date().toISOString()
    };

    return safeDbCall('UPDATE_FUNNEL', userId, supabase
      .from('funnels')
      .update(payload)
      .eq('id', funnelId)
      .eq('user_id', userId)
      .select()
      .maybeSingle()
    );
  }
};
