import { getDB } from './database';
import { EventLog, User } from './types';
import { applyUserScope } from './query_utils';

/**
 * Persists an event log entry.
 */
export function persistEventLog(log: EventLog): EventLog {
    const db = getDB();
    
    db.prepare(`
        INSERT OR REPLACE INTO event_logs (
            id, user_id, event_name, payload, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        log.id,
        log.user_id,
        log.event_name,
        JSON.stringify(log.payload || {}),
        log.status,
        log.created_at
    );

    return log;
}

/**
 * Retrieves event logs for a contact or phone.
 * Because payload is JSON, we use LIKE for simple matching or fetch and filter in JS for precision.
 * For this exercise, we fetch and filter in JS to maintain reliability.
 */
export function getAllEventLogs(user?: User | string | null): EventLog[] {
    const db = getDB();
    const baseQuery = 'SELECT * FROM event_logs';
    const scoped = applyUserScope(baseQuery, user);
    const rows = db.prepare(`${scoped.sql} ORDER BY created_at ASC`).all(...scoped.params) as any[];
    
    return rows.map(row => ({
        ...row,
        payload: JSON.parse(row.payload)
    }));
}
