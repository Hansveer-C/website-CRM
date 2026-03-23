import { getDB } from './database';
import { EventLog } from './types';

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
export function getAllEventLogs(): EventLog[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM event_logs ORDER BY created_at ASC').all() as any[];
    
    return rows.map(row => ({
        ...row,
        payload: JSON.parse(row.payload)
    }));
}
