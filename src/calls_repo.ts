import { getDB } from './database';
import { Call, User } from './types';
import { applyUserScope } from './query_utils';

/**
 * Persists a call to the SQLite database.
 */
export function persistCall(call: Call): Call {
    const db = getDB();
    
    db.prepare(`
        INSERT OR REPLACE INTO calls (
            id, user_id, contact_id, opportunity_id, phone, direction, status, duration, recording_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        call.id,
        call.user_id,
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
export function getCallsForContact(contact_id: string, phone?: string, user?: User | string | null): Call[] {
    const db = getDB();
    const baseQuery = `
        SELECT * FROM calls 
        WHERE contact_id = ? 
           OR (phone IS NOT NULL AND phone != '' AND phone = ?)
    `;
    const scoped = applyUserScope(baseQuery, user);
    const rows = db.prepare(scoped.sql).all(contact_id, phone || '', ...scoped.params) as any[];
    
    return rows;
}

/**
 * Retrieves a single call by ID.
 */
export function getCall(id: string, user?: User | string | null): Call | null {
    const db = getDB();
    const baseQuery = 'SELECT * FROM calls WHERE id = ?';
    const scoped = applyUserScope(baseQuery, user);
    const row = db.prepare(scoped.sql).get(id, ...scoped.params) as any;
    if (!row) return null;
    return row as Call;
}
