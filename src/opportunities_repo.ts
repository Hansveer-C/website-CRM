import { getDB } from './database';
import { Opportunity } from './types';

/**
 * Persists an opportunity to the SQLite database.
 */
export function persistOpportunity(opportunity: Opportunity): Opportunity {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO opportunities (
        id, contact_id, pipeline_stage, status, value, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    opportunity.id,
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
export function getOpportunitiesByContact(contact_id: string): Opportunity[] {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM opportunities WHERE contact_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(contact_id) as any[];
  
  return rows.map(row => ({
    ...row,
    status: row.status as any,
    value: parseFloat(row.value) || 0
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
    status: row.status as any,
    value: parseFloat(row.value) || 0
  };
}

/**
 * Retrieves all opportunities in the system.
 */
export function getAllOpportunities(): Opportunity[] {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM opportunities ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    ...row,
    status: row.status as any,
    value: parseFloat(row.value) || 0
  }));
}
