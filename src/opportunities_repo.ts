import { getDB } from './database';
import { Opportunity } from './types';

/**
 * Persists an opportunity to the SQLite database.
 */
export function persistOpportunity(opp: Opportunity): Opportunity {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT INTO opportunities (
        id, contact_id, pipeline_stage, status, value, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    opp.id,
    opp.contact_id,
    opp.pipeline_stage,
    opp.status,
    opp.value || 0,
    opp.source || null,
    opp.notes || null,
    opp.created_at
  );

  return opp;
}

/**
 * Retrieves all opportunities for a contact.
 */
export function getOpportunitiesByContact(contact_id: string): Opportunity[] {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM opportunities WHERE contact_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(contact_id) as any[];
  
  return rows.map(row => ({
    ...row,
    status: row.status as any
  }));
}

/**
 * Retrieves a single opportunity by ID.
 */
export function getOpportunity(id: string): Opportunity | null {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM opportunities WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    ...row,
    status: row.status as any
  };
}
