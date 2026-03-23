import { getDB } from './database';
import { Call } from './types';

/**
 * Persists a call to the SQLite database.
 */
export function persistCall(call: Call): Call {
    const db = getDB();
    
    db.prepare(`
        INSERT OR REPLACE INTO calls (
            id, contact_id, opportunity_id, phone, direction, status, duration, recording_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        call.id,
        call.contact_id || null,
        call.opportunity_id || null,
        call.phone,
        call.direction,
        call.status,
        call.duration || 0,
        call.recording_url || null,
        call.created_at
    );

    return call;
}

/**
 * Retrieves calls for a contact or phone.
 */
export function getCallsForContact(contact_id: string, phone?: string): Call[] {
    const db = getDB();
    const rows = db.prepare(`
        SELECT * FROM calls 
        WHERE contact_id = ? 
           OR (phone IS NOT NULL AND phone != '' AND phone = ?)
    `).all(contact_id, phone || '') as any[];
    
    return rows;
}

/**
 * Retrieves a single call by ID.
 */
export function getCall(id: string): Call | null {
    const db = getDB();
    const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(id) as any;
    if (!row) return null;
    return row as Call;
}
