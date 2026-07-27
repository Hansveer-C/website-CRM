import { supabase, safeDbCall } from './utils/db/supabase';
import { Funnel, RepoResponse } from './types';
import { mockFunnels } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Funnels.
 */
export const FunnelsRepo = {
  /**
   * Creates a new funnel.
   */
  async createFunnel(userId: string, name: string, service_type?: string, city?: string): Promise<RepoResponse<Funnel>> {
    if (!hasSupabase) {
      const offlineFunnel: Funnel = {
        id: `fnl_${Date.now()}`,
        user_id: userId,
        name,
        status: 'draft',
        service_type,
        city,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockFunnels.push(offlineFunnel);
      return { success: true, data: offlineFunnel };
    }

    const funnel: Partial<Funnel> = {
      id: `fnl_${Date.now()}`,
      user_id: userId,
      name,
      status: 'draft',
      service_type,
      city,
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
    if (!hasSupabase) {
      return { success: true, data: mockFunnels.filter(f => f.user_id === userId) };
    }

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
    if (!hasSupabase) {
      const funnel = mockFunnels.find(f => f.id === funnelId && f.user_id === userId);
      return funnel ? { success: true, data: funnel } : { success: false, error: 'NOT_FOUND' };
    }

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
    if (!hasSupabase) {
      const idx = mockFunnels.findIndex(f => f.id === funnelId && f.user_id === userId);
      if (idx !== -1) {
        mockFunnels[idx] = {
          ...mockFunnels[idx],
          ...data,
          updated_at: new Date().toISOString()
        };
        return { success: true, data: mockFunnels[idx] };
      }
      return { success: false, error: 'NOT_FOUND' };
    }

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
