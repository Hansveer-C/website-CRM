import { getDB } from './database';
import { Contact } from './types';

/**
 * Persists a contact to the SQLite database.
 */
export function persistContact(contact: Contact): Contact {
  const db = getDB();
  
  console.log(`[DB: CONTACT] Persisting ${contact.id} (${contact.name}). follow_up_required: ${contact.follow_up_required}`);
  const stmt = db.prepare(`
    INSERT INTO contacts (
        id, user_id, name, phone, email, address, tags, source, service, status, notes, created_at, invalid_phone, lead_status, follow_up_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        tags = excluded.tags,
        source = excluded.source,
        service = excluded.service,
        status = excluded.status,
        notes = excluded.notes,
        created_at = excluded.created_at,
        invalid_phone = excluded.invalid_phone,
        lead_status = excluded.lead_status,
        follow_up_required = excluded.follow_up_required
  `);

  stmt.run(
    contact.id,
    contact.user_id,
    contact.name,
    contact.phone,
    contact.email,
    contact.address,
    JSON.stringify(contact.tags || []),
    contact.source,
    contact.service || null,
    contact.status,
    contact.notes || null,
    contact.created_at,
    contact.invalid_phone ? 1 : 0,
    contact.lead_status || null,
    contact.follow_up_required ? 1 : 0
  );

  return contact;
}

/**
 * Finds a contact by phone or email.
 */
export function findContact(phone: string, email: string | null): Contact | null {
  const db = getDB();
  
  const stmt = db.prepare(`
    SELECT * FROM contacts 
    WHERE (phone = ? AND phone != '') 
       OR (email = ? AND email != '')
    LIMIT 1
  `);

  const row = stmt.get(phone, email) as any;
  if (!row) return null;

  // Map SQLite row back to Contact interface
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}

/**
 * Retrieves a contact by ID.
 */
export function getContact(id: string): Contact | null {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}

/**
 * Retrieves all contacts from the database.
 */
export function getAllContacts(): Contact[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at ASC').all() as any[];
  
  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  }));
}
