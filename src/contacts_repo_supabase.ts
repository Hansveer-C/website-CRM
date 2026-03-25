import { DB } from './utils/db/db_module';
import { Contact, User } from './types';

/**
 * Phase S3 - Batch 1: Contacts Repository (Supabase).
 * Transitioned from SQLite implementation in contacts_repo.ts.
 */
export const ContactsRepo = {
  /**
   * Persists a contact to the Supabase database.
   */
  async persistContact(contact: Contact): Promise<Contact> {
    console.log(`[DB: SUPABASE CONTACT] Persisting ${contact.id} (${contact.name}). follow_up_required: ${contact.follow_up_required}`);
    
    // In Supabase (Postgres), we pass tags as an array (assuming JSONB or TEXT[])
    // and standard boolean values.
    const payload = {
      ...contact,
      // Ensure boolean values for consistency
      invalid_phone: !!contact.invalid_phone,
      follow_up_required: !!contact.follow_up_required
    };

    try {
      return await DB.upsert<Contact>('contacts', payload);
    } catch (e: any) {
      console.error('[DB: CONTACT] Failed to persist contact in Supabase:', e.message);
      throw e;
    }
  },

  /**
   * Finds a contact by phone or email, scoped to the user context.
   */
  async findContact(phone: string, email: string | null, user?: User | string | null): Promise<Contact | null> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    // Enforcement of User Scoping (RLS equivalent in code)
    if (!userId) {
        console.warn('[DB: CONTACT] Find contact attempted without user context; enforcing "empty" result.');
        return null;
    }

    let query = DB.query('contacts')
      .select('*')
      .eq('user_id', userId);

    // Dynamic filtering (Phone OR Email)
    if (phone && email) {
        query = query.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
        query = query.eq('phone', phone);
    } else if (email) {
        query = query.eq('email', email);
    } else {
        return null; // Both empty
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error('[DB: CONTACT] Error finding contact in Supabase:', error.message);
        throw new Error(`DB_FIND_ERROR: ${error.message}`);
    }

    return data as Contact | null;
  },

  /**
   * Retrieves a contact by ID, scoped to the user context.
   */
  async getContact(id: string, user?: User | string | null): Promise<Contact | null> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: CONTACT] Get contact attempted without user context.');
        return null;
    }

    const { data, error } = await DB.query('contacts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
        console.error('[DB: CONTACT] Error retrieving contact from Supabase:', error.message);
        throw new Error(`DB_GET_ERROR: ${error.message}`);
    }

    return data as Contact | null;
  },

  /**
   * Retrieves all contacts, scoped to the user context.
   */
  async getAllContacts(user?: User | string | null): Promise<Contact[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: CONTACT] Get all contacts attempted without user context.');
        return [];
    }

    const { data, error } = await DB.query('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[DB: CONTACT] Error listing contacts from Supabase:', error.message);
        throw new Error(`DB_LIST_ERROR: ${error.message}`);
    }

    return (data || []) as Contact[];
  }
};
