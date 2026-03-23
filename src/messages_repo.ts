import { getDB } from './database';
import { Message } from './types';

/**
 * Persists a message to the database.
 * If the message already exists (by ID), it updates it.
 */
export function persistMessage(message: Message): Message {
    const db = getDB();
    
    // Check if message exists for upsert behavior
    const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(message.id);
    
    if (existing) {
        db.prepare(`
            UPDATE messages SET
                status = ?,
                retryable = ?,
                provider_message_id = ?
            WHERE id = ?
        `).run(
            message.status,
            message.retryable ? 1 : 0,
            message.provider_message_id || null,
            message.id
        );
    } else {
        db.prepare(`
            INSERT INTO messages (
                id, user_id, contact_id, opportunity_id, direction, type, content, 
                status, source, retryable, provider_message_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            message.id,
            message.user_id,
            message.contact_id,
            message.opportunity_id || null,
            message.direction,
            message.type,
            message.content,
            message.status,
            message.source || null,
            message.retryable ? 1 : 0,
            message.provider_message_id || null,
            message.created_at
        );
    }

    return message;
}

/**
 * Retrieves a message by its ID.
 */
export function getMessage(id: string): Message | null {
    const db = getDB();
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
    
    if (!row) return null;
    
    return {
        ...row,
        retryable: row.retryable === 1
    };
}

/**
 * Retrieves all messages for a specific contact.
 */
export function getMessagesByContact(contactId: string): Message[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC').all(contactId) as any[];
    
    return rows.map(row => ({
        ...row,
        retryable: row.retryable === 1
    }));
}

/**
 * Updates a message's status and provider info.
 */
export function updateMessageStatus(id: string, status: string, providerMessageId?: string, retryable?: boolean): void {
    const db = getDB();
    db.prepare(`
        UPDATE messages SET
            status = ?,
            provider_message_id = ?,
            retryable = ?
        WHERE id = ?
    `).run(
        status,
        providerMessageId || null,
        retryable ? 1 : 0,
        id
    );
}

/**
 * Counts recent outbound messages for rate limiting.
 */
export function countRecentOutboundMessages(contactId: string, sinceIso: string): number {
    const db = getDB();
    const result = db.prepare(`
        SELECT count(*) as total FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND created_at > ?
    `).get(contactId, sinceIso) as any;
    
    return result.total;
}

/**
 * Checks if a duplicate message was sent recently.
 */
export function checkDuplicateMessage(contactId: string, content: string, sinceIso: string): boolean {
    const db = getDB();
    const result = db.prepare(`
        SELECT id FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND content = ? AND created_at > ?
        LIMIT 1
    `).get(contactId, content, sinceIso);
    
    return !!result;
}

/**
 * Retrieves all messages in the entire system, sorted chronologically (ASC).
 */
export function getAllMessagesOrdered(): Message[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as any[];
    
    return rows.map(row => ({
        ...row,
        retryable: row.retryable === 1
    }));
}
