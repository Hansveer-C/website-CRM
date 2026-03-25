import { Contact, User, RepoResponse } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall } from './utils/db/supabase';

/**
 * Persists a contact to the Supabase database.
 */
export async function createContact(contact: Contact): Promise<RepoResponse<Contact>> {
  console.log(`[DB: SUPABASE CONTACT] Creating/Updating ${contact.id} (${contact.name}).`);
  
  const payload = {
    ...contact,
    // Ensure correct types for Postgres
    invalid_phone: !!contact.invalid_phone,
    follow_up_required: !!contact.follow_up_required
  };

  const userId = contact.user_id;

  return safeDbCall('CREATE_CONTACT', userId, supabase
    .from('contacts')
    .upsert(payload)
    .select()
    .single()
  );
}

/**
 * Finds a contact by phone or email, scoped to the user context.
 */
export async function searchContacts(phone: string, email: string | null, user?: User | string | null): Promise<RepoResponse<Contact | null>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      console.warn('[DB: CONTACT] Search contact attempted without user context.');
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  let query = supabase.from('contacts')
    .select('*')
    .eq('user_id', userId);

  if (phone && email) {
      query = query.or(`phone.eq.${phone},email.eq.${email}`);
  } else if (phone) {
      query = query.eq('phone', phone);
  } else if (email) {
      query = query.eq('email', email);
  } else {
      return { success: true, data: null };
  }

  return safeDbCall('SEARCH_CONTACTS', userId, query.maybeSingle());
}

/**
 * Retrieves a contact by ID, scoped to the user context.
 */
export async function getContactById(id: string, user?: User | string | null): Promise<RepoResponse<Contact | null>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      console.warn('[DB: CONTACT] Get contact attempted without user context.');
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  return safeDbCall('GET_CONTACT', userId, supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  );
}



/**
 * Retrieves all contacts, scoped to the user context.
 */
export async function getContacts(user?: User | string | null): Promise<RepoResponse<Contact[]>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  return safeDbCall('GET_CONTACTS', userId, supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  );
}

// --- Aliases for Backward Compatibility ---
export const persistContact = createContact;
export const findContact = searchContacts;
export const getContact = getContactById;
export const getAllContacts = getContacts;

// Namespace export (common in some parts of the system)
export const ContactsRepo = {
  createContact,
  persistContact,
  searchContacts,
  findContact,
  getContactById,
  getContact,
  getContacts,
  getAllContacts
};



