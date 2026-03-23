import { getDB } from './database';
import { Contact } from './types';

/**
 * Persists a contact to the SQLite database.
 */
export function persistContact(contact: Contact): Contact {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (
        id, name, phone, email, address, tags, source, service, status, notes, created_at, invalid_phone, lead_status, follow_up_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    contact.id,
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
