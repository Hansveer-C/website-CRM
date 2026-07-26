import { Contact, User, RepoResponse } from './types';
import { mockContacts } from './db';
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
  console.log(`[DB: SUPABASE CONTACT] Persisting ${contact.id} (${contact.name}).`);
  
  const userId = contact.user_id;

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      console.log('[DB MOCK FALLBACK: CREATE_CONTACT] Saving to mockContacts:', contact);
      const idx = mockContacts.findIndex(c => c.id === contact.id);
      if (idx !== -1) {
          mockContacts[idx] = contact;
      } else {
          mockContacts.push(contact);
      }
      return { success: true, data: contact };
  }

  // 🛡️ MF.3: PREVENT CROSS-TENANT OVERWRITES
  // Before upserting, verify that if the record exists, it belongs to the same user.
  const { data: existing } = await supabase.from('contacts').select('user_id').eq('id', contact.id).maybeSingle();
  if (existing && existing.user_id !== userId) {
      console.error(`[SECURITY ALERT] Cross-tenant overwrite blocked: User ${userId} attempted to overwrite contact ${contact.id} owned by ${existing.user_id}`);
      return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
  }

  const payload = {
    ...contact,
    invalid_phone: !!contact.invalid_phone,
    follow_up_required: !!contact.follow_up_required
  };

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

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      console.log('[DB MOCK FALLBACK: SEARCH_CONTACTS] Finding in mockContacts');
      const contact = mockContacts.find(c => {
          if (c.user_id !== userId) return false;
          if (phone && c.phone === phone) return true;
          if (email && c.email === email) return true;
          return false;
      });
      return { success: true, data: contact || null };
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

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const contact = mockContacts.find(c => c.id === id && c.user_id === userId);
      return { success: true, data: contact || null };
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
export async function getContacts(user?: User | string | null, limit = 100): Promise<RepoResponse<Contact[]>> {
  const userId = typeof user === 'string' ? user : (user?.id);
  
  if (!userId) {
      return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const list = mockContacts.filter(c => c.user_id === userId);
      return { success: true, data: list };
  }

  return safeDbCall('GET_CONTACTS', userId, supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)
  );
}

/**
 * Deletes a contact, scoped strictly to the user context. (MF.4)
 */
export async function deleteContact(id: string, user: User | string): Promise<RepoResponse<void>> {
  const userId = typeof user === 'string' ? user : user.id;

  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
  if (!hasSupabase) {
      const idx = mockContacts.findIndex(c => c.id === id && c.user_id === userId);
      if (idx !== -1) {
          mockContacts.splice(idx, 1);
      }
      return { success: true };
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
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
  deleteContact,
  resolveContactOwner,
  resolveContactOwnerByPhone
};

/**
 * Resolves the owner of a contact. (Internal use)
 */
export async function resolveContactOwner(contact_id: string): Promise<string | null> {
    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const contact = mockContacts.find(c => c.id === contact_id);
        return contact?.user_id || null;
    }
    const { data } = await supabase.from('contacts').select('user_id').eq('id', contact_id).maybeSingle();
    return data?.user_id || null;
}

/**
 * Resolves the owner of a contact by phone number. (Internal use)
 */
export async function resolveContactOwnerByPhone(phone: string): Promise<string | null> {
    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const contact = mockContacts.find(c => c.phone === phone);
        return contact?.user_id || null;
    }
    const { data } = await supabase.from('contacts').select('user_id').eq('phone', phone).maybeSingle();
    return data?.user_id || null;
}




