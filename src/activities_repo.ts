import { getDB } from './database';
import { Activity, User } from './types';
import { applyUserScope } from './query_utils';

/**
 * Persists an activity to the SQLite database.
 */
export function persistActivity(activity: Activity): Activity {
    const db = getDB();
    
    db.prepare(`
        INSERT OR REPLACE INTO activities (
            id, user_id, contact_id, type, description, due_date, completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        activity.id,
        activity.user_id,
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
export function getActivitiesByContact(contact_id: string, user?: User | string | null): Activity[] {
    const db = getDB();
    const baseQuery = 'SELECT * FROM activities WHERE contact_id = ?';
    const scoped = applyUserScope(baseQuery, user);
    const rows = db.prepare(scoped.sql).all(contact_id, ...scoped.params) as any[];
    
    return rows.map(row => ({
        ...row,
        completed: row.completed === 1
    }));
}
