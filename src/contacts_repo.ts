import { Contact, User } from './types';
import { supabase } from './utils/db/supabase';

/**
 * Persists a contact to the Supabase database.
 */
export async function createContact(contact: Contact): Promise<Contact> {
  console.log(`[DB: SUPABASE CONTACT] Creating/Updating ${contact.id} (${contact.name}). follow_up_required: ${contact.follow_up_required}`);
  
  const payload = {
    ...contact,
    // Ensure correct types for Postgres (booleans, jsonb handled by library)
    invalid_phone: !!contact.invalid_phone,
    follow_up_required: !!contact.follow_up_required
  };





  const { data, error } = await supabase
    .from('contacts')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('[DB: CONTACT] Failed to persist contact in Supabase:', error.message);
    throw new Error(`DB_PERSIST_CONTACT_ERROR: ${error.message}`);
  }

  return data as Contact;
}

/**
 * Finds a contact by phone or email, scoped to the user context.
 */
export async function searchContacts(phone: string, email: string | null, user?: User | string | null): Promise<Contact | null> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      console.warn('[DB: CONTACT] Search contact attempted without user context.');
      return null;
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
      return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
      console.error('[DB: CONTACT] Error searching contact in Supabase:', error.message);
      throw new Error(`DB_SEARCH_CONTACT_ERROR: ${error.message}`);
  }

  return data as Contact | null;
}

/**
 * Retrieves a contact by ID, scoped to the user context.
 */
export async function getContactById(id: string, user?: User | string | null): Promise<Contact | null> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      console.warn('[DB: CONTACT] Get contact attempted without user context.');
      return null;
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
      console.error('[DB: CONTACT] Error retrieving contact from Supabase:', error.message);
      throw new Error(`DB_GET_CONTACT_ERROR: ${error.message}`);
  }

  return data as Contact | null;
}

/**
 * Retrieves all contacts, scoped to the user context.
 */
export async function getContacts(user?: User | string | null): Promise<Contact[]> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      console.warn('[DB: CONTACT] Get all contacts attempted without user context.');
      return [];
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
      console.error('[DB: CONTACT] Error listing contacts from Supabase:', error.message);
      throw new Error(`DB_LIST_CONTACTS_ERROR: ${error.message}`);
  }

  return (data || []) as Contact[];
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



