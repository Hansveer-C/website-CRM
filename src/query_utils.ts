import { User } from './types';

/**
 * Appends a user-scoped WHERE clause to a SQL query string.
 * This is a foundational helper for implementing Row-Level Security (RLS) 
 * in the CRM logic.
 * 
 * @param baseQuery The original SQL query (e.g., "SELECT * FROM contacts")
 * @param user The authenticated user object from the request
 * @returns { sql: string, params: any[] } - The scoped query and its associated parameters
 */
/**
 * Appends a user-scoped WHERE clause to a SQL query string.
 * @param baseQuery The original SQL query
 * @param user Context containing the owner (User object OR user_id string)
 * @returns { sql: string, params: any[] }
 */
export function applyUserScope(baseQuery: string, user: User | string | null | undefined): { sql: string, params: any[] } {
  // Special Case: Allow internal system tasks to ignore user scoping
  if (user === 'INTERNAL_SYSTEM_BYPASS') {
    return { sql: baseQuery, params: [] };
  }

  const userId = typeof user === 'string' ? user : (user?.id);

  // 1. Safe Fallback: If no user context, return a query that returns NO results 
  if (!userId) {
    console.error('[SECURITY WARNING] Query executed without user context; enforcing "empty" result set.');
    return {
      sql: `${baseQuery} ${baseQuery.toUpperCase().includes('WHERE') ? 'AND' : 'WHERE'} 1 = 0`,
      params: []
    };
  }

  // 2. Normal Scoping: Add user_id filter
  const hasWhere = baseQuery.toUpperCase().includes('WHERE');
  const connector = hasWhere ? 'AND' : 'WHERE';
  
  return {
    sql: `${baseQuery} ${connector} user_id = ?`,
    params: [userId]
  };
}
