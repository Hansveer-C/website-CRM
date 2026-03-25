import { supabase } from './supabase';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';

/**
 * Standard DB Module for Phase S3 (Supabase Transition).
 * Provides a hardened interface for backend database operations.
 */
export const DB = {
  /**
   * Performs a single-row lookat-up.
   */
  async findOne<T>(table: string, query: Record<string, any>): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .match(query)
      .maybeSingle();

    if (error) {
      console.error(`[DB MODULE] Error finding one in ${table}:`, error.message);
      throw new Error(`DB_FIND_ERROR: ${error.message}`);
    }

    return data as T | null;
  },

  /**
   * Generic upsert operation.
   */
  async upsert<T>(table: string, record: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(table)
      .upsert(record)
      .select()
      .single();

    if (error) {
      console.error(`[DB MODULE] Error upserting to ${table}:`, error.message);
      throw new Error(`DB_UPSERT_ERROR: ${error.message}`);
    }

    return data as T;
  },

  /**
   * Generic list-at-all operation with ordering.
   */
  async listAll<T>(table: string, orderField: string = 'created_at', ascending: boolean = true): Promise<T[]> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderField, { ascending });

    if (error) {
      console.error(`[DB MODULE] Error listing records from ${table}:`, error.message);
      throw new Error(`DB_LIST_ERROR: ${error.message}`);
    }

    return (data || []) as T[];
  },

  /**
   * Scoped query helper for cross-cutting concerns (like user_id scoping).
   */
  query(table: string) {
    return supabase.from(table);
  }
};
