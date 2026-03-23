import { getDB } from './database';
import { Activity } from './types';

/**
 * Persists an activity to the SQLite database.
 */
export function persistActivity(activity: Activity): Activity {
    const db = getDB();
    
    db.prepare(`
        INSERT OR REPLACE INTO activities (
            id, contact_id, type, description, due_date, completed
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        activity.id,
        activity.contact_id,
        activity.type,
        activity.description,
        activity.due_date,
        activity.completed ? 1 : 0
    );

    return activity;
}

/**
 * Retrieves all activities for a specific contact.
 */
export function getActivitiesByContact(contact_id: string): Activity[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM activities WHERE contact_id = ?').all(contact_id) as any[];
    
    return rows.map(row => ({
        ...row,
        completed: row.completed === 1
    }));
}
