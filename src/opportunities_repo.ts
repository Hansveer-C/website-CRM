import { getDB } from './database';
import { Opportunity, User } from './types';
import { applyUserScope } from './query_utils';

/**
 * Persists an opportunity to the SQLite database.
 */
export function persistOpportunity(opportunity: Opportunity): Opportunity {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO opportunities (
        id, user_id, contact_id, pipeline_stage, status, value, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    opportunity.id,
    opportunity.user_id,
    opportunity.contact_id,
    opportunity.pipeline_stage,
    opportunity.status,
    opportunity.value || 0,
    opportunity.source || null,
    opportunity.notes || null,
    opportunity.created_at
  );

  return opportunity;
}

/**
 * Retrieves all opportunities associated with a specific contact.
 */
export function getOpportunitiesByContact(contact_id: string, user?: User | string | null): Opportunity[] {
  const db = getDB();
  const baseQuery = 'SELECT * FROM opportunities WHERE contact_id = ?';
  const scoped = applyUserScope(baseQuery, user);
  const stmt = db.prepare(`${scoped.sql} ORDER BY created_at DESC`);
  const rows = stmt.all(contact_id, ...scoped.params) as any[];
  
  return rows.map(row => ({
    ...row,
    status: row.status as any,
    value: parseFloat(row.value) || 0
  }));
}

/**
 * Retrieves a single opportunity by ID.
 */
export function getOpportunity(id: string, user?: User | string | null): Opportunity | null {
  const db = getDB();
  const baseQuery = 'SELECT * FROM opportunities WHERE id = ?';
  const scoped = applyUserScope(baseQuery, user);
  const stmt = db.prepare(scoped.sql);
  const row = stmt.get(id, ...scoped.params) as any;
  if (!row) return null;

  return {
    ...row,
    status: row.status as any,
    value: parseFloat(row.value) || 0
  };
}

/**
 * Retrieves all opportunities in the system.
 */
export function getAllOpportunities(user?: User | string | null): Opportunity[] {
  const db = getDB();
  const baseQuery = 'SELECT * FROM opportunities';
  const scoped = applyUserScope(baseQuery, user);
  const stmt = db.prepare(`${scoped.sql} ORDER BY created_at DESC`);
  const rows = stmt.all(...scoped.params) as any[];
  
  return rows.map(row => ({
    ...row,
    status: row.status as any,
    value: parseFloat(row.value) || 0
  }));
}
