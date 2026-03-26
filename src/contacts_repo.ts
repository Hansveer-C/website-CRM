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
  const userId = contact.user_id;

  const payload = {
    ...contact,
    invalid_phone: !!contact.invalid_phone,
    follow_up_required: !!contact.follow_up_required
  };

  // 🛡️ MF.3: PREVENT CROSS-TENANT OVERWRITES
  // Step 1: Check if the record already exists and who owns it
  const { data: existing } = await supabase
    .from('contacts')
    .select('user_id')
    .eq('id', contact.id)
    .maybeSingle();

  // Step 2: Ownership verification
  if (existing && existing.user_id !== userId) {
      console.error(`[SECURITY: MF.3] Access Denied: User ${userId} attempted to overwrite contact ${contact.id} owned by User ${existing.user_id}`);
      return { success: false, error: 'ACCESS_DENIED' };
  }

  // Step 3: Proceed with upsert only if ownership is confirmed or record is new
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

/**
 * Permanently deletes a contact, scoped to the user context.
 */
export async function deleteContact(id: string, user?: User | string | null): Promise<RepoResponse<null>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  return safeDbCall('DELETE_CONTACT', userId, supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
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
  getAllContacts,
  deleteContact,
  resolveOwnerId,
  resolveOwnerByPhone
};


async function resolveOwnerId(contactId: string): Promise<string | null> {
    const { data } = await supabase
      .from('contacts')
      .select('user_id')
      .eq('id', contactId)
      .maybeSingle();
    
    if (data) {
        console.log(`[SYSTEM AUTH] Resolved owner for contact ${contactId}: ${data.user_id}`);
    }
    return data?.user_id || null;
}

async function resolveOwnerByPhone(phone: string): Promise<string | null> {
    const { data } = await supabase
      .from('contacts')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (data) {
        console.log(`[SYSTEM AUTH] Resolved owner for phone ${phone}: ${data.user_id}`);
    }
    return data?.user_id || null;
}

export { resolveOwnerId as resolveContactOwner, resolveOwnerByPhone as resolveContactOwnerByPhone };
