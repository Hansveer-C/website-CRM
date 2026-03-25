import { Opportunity, User } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

/**
 * Phase S3 - Batch 2: Opportunities Repository (Supabase).
 */
export const OpportunitiesRepo = {
  /**
   * Persists an opportunity to the Supabase database.
   */
  async createOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    console.log(`[DB: SUPABASE OPPORTUNITY] Persisting ${opportunity.id} for contact ${opportunity.contact_id}.`);
    
    const payload = {
      ...opportunity,
      // Map correctly to Postgres types
      value: Number(opportunity.value) || 0
    };

    const { data, error } = await supabase
      .from('opportunities')
      .upsert(payload)
      .select()
      .single();

    if (error) {
        console.error('[DB: OPPORTUNITY] Failed to persist opportunity in Supabase:', error.message);
        throw new Error(`DB_PERSIST_OPPORTUNITY_ERROR: ${error.message}`);
    }

    return data as Opportunity;
  },

  /**
   * Alias for createOpportunity to maintain compatibility.
   */
  async persistOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    return this.createOpportunity(opportunity);
  },

  /**
   * Retrieves all opportunities associated with a specific contact, scoped to the user context.
   */
  async getOpportunitiesByContact(contact_id: string, user?: User | string | null): Promise<Opportunity[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: OPPORTUNITY] Get by contact attempted without user context.');
        return [];
    }

    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB: OPPORTUNITY] Error listing opportunities in Supabase:', error.message);
        throw new Error(`DB_LIST_OPPORTUNITIES_CONTACT_ERROR: ${error.message}`);
    }

    return (data || []) as Opportunity[];
  },

  /**
   * Retrieves a single opportunity by ID, scoped to the user context.
   */
  async getOpportunityById(id: string, user?: User | string | null): Promise<Opportunity | null> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: OPPORTUNITY] Get opportunity attempted without user context.');
        return null;
    }

    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
        console.error('[DB: OPPORTUNITY] Error retrieving opportunity from Supabase:', error.message);
        throw new Error(`DB_GET_OPPORTUNITY_ERROR: ${error.message}`);
    }

    return data as Opportunity | null;
  },

  /**
   * Alias for getOpportunityById to maintain compatibility.
   */
  async getOpportunity(id: string, user?: User | string | null): Promise<Opportunity | null> {
    return this.getOpportunityById(id, user);
  },

  /**
   * Retrieves all opportunities, scoped to the user context.
   */
  async getOpportunities(user?: User | string | null): Promise<Opportunity[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: OPPORTUNITY] Get all opportunities attempted without user context.');
        return [];
    }

    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB: OPPORTUNITY] Error listing opportunities from Supabase:', error.message);
        throw new Error(`DB_LIST_OPPORTUNITIES_ERROR: ${error.message}`);
    }

    return (data || []) as Opportunity[];
  },

  /**
   * Alias for getOpportunities to maintain compatibility.
   */
  async getAllOpportunities(user?: User | string | null): Promise<Opportunity[]> {
    return this.getOpportunities(user);
  }
};

// --- Standard Individual Exports ---
/**
 * Persist opportunity to Supabase.
 */
export async function createOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    return OpportunitiesRepo.createOpportunity(opportunity);
}

/**
 * Persist opportunity to Supabase (Legacy Alias).
 */
export async function persistOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    return OpportunitiesRepo.createOpportunity(opportunity);
}

/**
 * Get opportunities by contact (Supabase).
 */
export async function getOpportunitiesByContact(contact_id: string, user?: User | string | null): Promise<Opportunity[]> {
    return OpportunitiesRepo.getOpportunitiesByContact(contact_id, user);
}

/**
 * Get single opportunity by ID (Supabase).
 */
export async function getOpportunityById(id: string, user?: User | string | null): Promise<Opportunity | null> {
    return OpportunitiesRepo.getOpportunityById(id, user);
}

/**
 * Get single opportunity by ID (Legacy Alias).
 */
export async function getOpportunity(id: string, user?: User | string | null): Promise<Opportunity | null> {
    return OpportunitiesRepo.getOpportunityById(id, user);
}

/**
 * List all opportunities (Supabase).
 */
export async function getOpportunities(user?: User | string | null): Promise<Opportunity[]> {
    return OpportunitiesRepo.getOpportunities(user);
}

/**
 * List all opportunities (Legacy Alias).
 */
export async function getAllOpportunities(user?: User | string | null): Promise<Opportunity[]> {
    return OpportunitiesRepo.getOpportunities(user);
}

