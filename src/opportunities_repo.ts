import { Opportunity, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

/**
 * Phase S3 - Batch 2: Opportunities Repository (Supabase).
 */
export const OpportunitiesRepo = {
  /**
   * Persists an opportunity to the Supabase database.
   */
  async createOpportunity(opportunity: Opportunity): Promise<RepoResponse<Opportunity>> {
    console.log(`[DB: SUPABASE OPPORTUNITY] Persisting ${opportunity.id} for contact ${opportunity.contact_id}.`);
    
    // 🛡️ MF.3: PREVENT CROSS-TENANT OVERWRITES
    const { data: existing } = await supabase.from('opportunities').select('user_id').eq('id', opportunity.id).maybeSingle();
    if (existing && existing.user_id !== opportunity.user_id) {
        return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
    }

    const payload = {
      ...opportunity,
      value: Number(opportunity.value) || 0
    };

    return safeDbCall('CREATE_OPPORTUNITY', opportunity.user_id, supabase
      .from('opportunities')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Alias for createOpportunity to maintain compatibility.
   */
  async persistOpportunity(opportunity: Opportunity): Promise<RepoResponse<Opportunity>> {
    return this.createOpportunity(opportunity);
  },

  /**
   * Retrieves all opportunities associated with a specific contact, scoped to the user context.
   */
  async getOpportunitiesByContact(contact_id: string, user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    return safeDbCall('GET_OPPORTUNITIES_BY_CONTACT', userId, supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Retrieves a single opportunity by ID, scoped to the user context.
   */
  async getOpportunityById(id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    return safeDbCall('GET_OPPORTUNITY', userId, supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    );
  },

  /**
   * Alias for getOpportunityById to maintain compatibility.
   */
  async getOpportunity(id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    return this.getOpportunityById(id, user);
  },

  /**
   * Retrieves all opportunities, scoped to the user context.
   */
  async getOpportunities(user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    return safeDbCall('GET_OPPORTUNITIES', userId, supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Retrieves an open opportunity for a contact, if one exists. (F1)
   */
  async getOpenOpportunityByContact(contact_id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    if (!userId) return { success: false, error: 'MISSING_USER_CONTEXT' };

    return safeDbCall('GET_OPEN_OPP', userId, supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .eq('status', 'open')
      .maybeSingle()
    );
  },

  /**
   * Alias for getOpportunities to maintain compatibility.
   */
  async getAllOpportunities(user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    return this.getOpportunities(user);
  },

  /**
   * Deletes an opportunity, scoped strictly to the user context. (MF.4)
   */
  async deleteOpportunity(id: string, user: User | string): Promise<RepoResponse<void>> {
    const userId = typeof user === 'string' ? user : user.id;

    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
};

/**
 * Resolves the owner of an opportunity. (Internal use)
 */
export async function resolveOpportunityOwner(opp_id: string): Promise<string | null> {
    const { data } = await supabase.from('opportunities').select('user_id').eq('id', opp_id).maybeSingle();
    return data?.user_id || null;
}

// --- Standard Individual Exports ---
/**
 * Persist opportunity to Supabase.
 */
export async function createOpportunity(opportunity: Opportunity): Promise<RepoResponse<Opportunity>> {
    return OpportunitiesRepo.createOpportunity(opportunity);
}

export async function persistOpportunity(opportunity: Opportunity): Promise<RepoResponse<Opportunity>> {
    return OpportunitiesRepo.createOpportunity(opportunity);
}

export async function getOpportunitiesByContact(contact_id: string, user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    return OpportunitiesRepo.getOpportunitiesByContact(contact_id, user);
}

export async function getOpportunityById(id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    return OpportunitiesRepo.getOpportunityById(id, user);
}

export async function getOpportunity(id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    return OpportunitiesRepo.getOpportunityById(id, user);
}

export async function getOpportunities(user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    return OpportunitiesRepo.getOpportunities(user);
}

export async function getAllOpportunities(user?: User | string | null): Promise<RepoResponse<Opportunity[]>> {
    return OpportunitiesRepo.getOpportunities(user);
}

export async function deleteOpportunity(id: string, user: User | string): Promise<RepoResponse<void>> {
    return OpportunitiesRepo.deleteOpportunity(id, user);
}

export async function getOpenOpportunityByContact(contact_id: string, user?: User | string | null): Promise<RepoResponse<Opportunity | null>> {
    return OpportunitiesRepo.getOpenOpportunityByContact(contact_id, user);
}

